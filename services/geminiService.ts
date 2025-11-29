
import { GoogleGenAI } from "@google/genai";
import { NewsItem, Source } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// CORS Proxy
const CORS_PROXY = "https://api.allorigins.win/raw?url=";

const fetchWithEncoding = async (url: string, forceEncoding?: string): Promise<string> => {
  // Add cache busting to prevent stale RSS
  const urlWithCache = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
  const response = await fetch(`${CORS_PROXY}${encodeURIComponent(urlWithCache)}`);
  if (!response.ok) throw new Error(`Failed to fetch: ${url}`);
  
  const buffer = await response.arrayBuffer();
  
  let decoder;
  if (forceEncoding) {
    decoder = new TextDecoder(forceEncoding);
  } else if (url.includes('marebpress')) {
    decoder = new TextDecoder('windows-1256');
  } else {
    decoder = new TextDecoder('utf-8');
  }
  
  return decoder.decode(buffer);
};

const scrapeFullContent = async (originalUrl: string, customSelector?: string): Promise<string | null> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); 

    const response = await fetch(`${CORS_PROXY}${encodeURIComponent(originalUrl)}`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) return null;
    
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // --- Helper to extract text from a specific element ---
    const extractCleanText = (element: Element): string | null => {
         // Remove junk inside the specific element first
         const junk = element.querySelectorAll('script, style, iframe, .share, .ads, .related, .meta, .author-box, button, input');
         junk.forEach(el => el.remove());

         const paragraphs = Array.from(element.querySelectorAll('p, div'));
         
         // If no paragraphs found, try getting direct text content if it's a specific block
         if (paragraphs.length === 0 && element.textContent && element.textContent.length > 100) {
             return element.textContent.trim();
         }

         const cleanText = paragraphs
            .map(p => p.textContent?.trim())
            .filter(text => {
                if (!text) return false;
                if (text.length < 30) return false;
                if (text.includes('حقوق النشر') || text.includes('جميع الحقوق محفوظة')) return false;
                if (text.includes('تابعنا على') || text.includes('اشترك في')) return false;
                if (text.includes('اقرأ أيضاً') || text.includes('مواضيع ذات صلة')) return false;
                return true;
            }) 
            .join('\n\n');
         
         return cleanText.length > 100 ? cleanText : null;
    };

    // 0. Use Custom Selector (CSS or XPath) if provided (Admin Priority)
    if (customSelector) {
        try {
            let el: Element | null = null;
            const selector = customSelector.trim();

            // Check if it looks like an XPath (starts with / or ( )
            if (selector.startsWith('/') || selector.startsWith('(')) {
                const result = doc.evaluate(selector, doc, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
                el = result.singleNodeValue as Element;
            } else {
                // Assume CSS Selector
                el = doc.querySelector(selector);
            }

            if (el) {
                const text = extractCleanText(el);
                if (text) return text;
            } else {
                console.warn(`Element not found for selector: ${selector}`);
            }
        } catch (e) {
            console.warn("Invalid Selector provided:", customSelector, e);
        }
    }

    // 1. Specific Logic for Yemen Future (yemenfuture.net)
    if (originalUrl.includes('yemenfuture.net')) {
        const yfContainer = doc.querySelector('.details') || doc.querySelector('.entry-content');
        if (yfContainer) {
            // Remove specific unwanted elements in Yemen Future
            const junk = yfContainer.querySelectorAll('.share-buttons, .related-news, .tags, .author-box, .post-meta, div[style*="background"]');
            junk.forEach(el => el.remove());
            
            const paragraphs = Array.from(yfContainer.querySelectorAll('p'));
            return paragraphs
                .map(p => p.textContent?.trim())
                .filter(text => text && text.length > 40 && !text.includes('يمن فيوتشر') && !text.includes('تابعنا'))
                .join('\n\n');
        }
    }

    // 2. Generic Cleaning (Global)
    const scripts = doc.querySelectorAll('script, style, nav, header, footer, .sidebar, .comments, .ads, .advertisement, .share, .related, .meta, .author-info, iframe, button, input, form');
    scripts.forEach(s => s.remove());

    const selectors = [
      'article', '.article-content', '.entry-content', '#article-body', '.post-content', '.details', '.news-details', '.body-text',
      '.detail-content', '#content'
    ];

    let contentElement: Element | null = null;
    let maxScore = 0;
    
    // Check specific selectors first
    for (const selector of selectors) {
      const el = doc.querySelector(selector);
      if (el) {
          const pCount = el.querySelectorAll('p').length;
          const textLen = el.textContent?.length || 0;
          const score = pCount * 50 + textLen;
          if (score > maxScore) {
              maxScore = score;
              contentElement = el;
          }
      }
    }

    if (!contentElement) contentElement = doc.body;
    if (!contentElement) return null;

    return extractCleanText(contentElement);

  } catch (e) {
    return null;
  }
};

/**
 * Helper: Fetch single RSS feed
 */
export const fetchRSSFeed = async (source: Source): Promise<NewsItem[]> => {
  try {
    const text = await fetchWithEncoding(source.url);
    const parser = new DOMParser();
    const xml = parser.parseFromString(text, "text/xml");
    
    const items = Array.from(xml.querySelectorAll("item"));
    
    // Process only top 10 per source
    const newsPromises = items.slice(0, 10).map(async (item) => { 
      const title = item.querySelector("title")?.textContent?.trim() || "بدون عنوان";
      const link = item.querySelector("link")?.textContent || "#";
      
      // Try to get content:encoded for full article, otherwise description
      const encodedContent = item.getElementsByTagNameNS("*", "encoded")[0]?.textContent;
      const descriptionRaw = item.querySelector("description")?.textContent || "";
      
      // Clean up description for summary
      const div = document.createElement("div");
      div.innerHTML = descriptionRaw;
      let summary = div.textContent?.trim() || descriptionRaw;
      
      // Image Extraction
      const enclosure = item.querySelector("enclosure");
      let imageUrl = enclosure?.getAttribute("url");
      if (!imageUrl) {
         // Try finding image in description/content
         const contentForImg = encodedContent || descriptionRaw;
         const imgMatch = contentForImg.match(/src="([^"]+)"/);
         if (imgMatch) imageUrl = imgMatch[1];
      }

      const sourceLogo = source.logoUrl || `https://www.google.com/s2/favicons?domain=${new URL(source.url).hostname}&sz=128`;
      const finalImageUrl = imageUrl || sourceLogo;
      const imageType = imageUrl ? 'photo' : 'logo';
      const pubDateNode = item.querySelector("pubDate")?.textContent;
      const pubDate = pubDateNode ? new Date(pubDateNode).toISOString() : new Date().toISOString();

      // Determine Full Content
      let fullContent = "";
      
      // Strict clean for summary to remove "read more" links
      summary = summary.replace(/اقرأ المزيد.*/g, '').replace(/Read more.*/g, '').substring(0, 200) + '...';

      // Decide whether to use RSS content or Scrape
      // Priority: 1. Scrape if customSelector exists. 2. Use RSS encoded if long enough. 3. Scrape if short.
      
      const hasCustomSelector = !!source.contentSelector && source.contentSelector.trim().length > 0;

      if (hasCustomSelector) {
           // Always attempt scrape if selector provided
           if (link && link !== '#') {
               const scraped = await scrapeFullContent(link, source.contentSelector);
               if (scraped) {
                   fullContent = scraped;
               } else {
                   // Fallback to RSS if scraping fails
                   fullContent = (encodedContent && encodedContent.length > summary.length) ? encodedContent : summary;
               }
           }
      } else if (encodedContent && encodedContent.length > summary.length) {
        // Use encoded content if available and no custom selector forced
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = encodedContent;
        fullContent = tempDiv.textContent || summary;
      } else {
        fullContent = summary;
        // Scrape as fallback for short content
        if ((link && link !== '#') && fullContent.length < 500) {
           const scraped = await scrapeFullContent(link); 
           if (scraped) fullContent = scraped;
        }
      }

      // Generate a deterministic ID based on URL
      const id = `news_${btoa(link).substring(0, 30)}`;

      return {
        id: id,
        sourceId: source.name,
        sourceName: source.name,
        originalUrl: link,
        title: title,
        summary: summary,
        content: fullContent, // Keep full content for modal
        tags: ["أخبار"], 
        imageUrl: finalImageUrl,
        imageType: imageType as 'photo' | 'logo',
        publishedAt: pubDate,
        views: 0,
        isTrending: false
      };
    });

    return await Promise.all(newsPromises);

  } catch (error) {
    console.warn(`Error fetching RSS for ${source.name}:`, error);
    return [];
  }
};

/**
 * PHASE 1: Fast Fetch - Gets RSS data and tries to find full content
 */
export const fetchRawRSS = async (sources: Source[]): Promise<NewsItem[]> => {
  const activeSources = sources.filter(s => s.active);
  if (activeSources.length === 0) return [];

  // Parallel Fetch
  const rssPromises = activeSources.map(source => fetchRSSFeed(source));
  const rawResults = await Promise.all(rssPromises);
  
  let allNews: NewsItem[] = [];
  rawResults.forEach(items => {
    allNews = [...allNews, ...items];
  });

  return allNews;
};

/**
 * ADMIN UTILITY: Check health of sources
 */
export interface SourceHealth {
    sourceId: string;
    count: number;
    status: 'success' | 'empty' | 'error';
}

export const checkSourcesHealth = async (sources: Source[]): Promise<SourceHealth[]> => {
    const promises = sources.map(async (source) => {
        try {
            const items = await fetchRSSFeed(source);
            return {
                sourceId: source.id,
                count: items.length,
                status: items.length > 0 ? 'success' as const : 'empty' as const
            };
        } catch (e) {
            return {
                sourceId: source.id,
                count: 0,
                status: 'error' as const
            };
        }
    });
    return Promise.all(promises);
};

/**
 * PHASE 2: AI Enhancement
 */
export const enhanceNewsBatch = async (newsItems: NewsItem[]): Promise<NewsItem[]> => {
  if (newsItems.length === 0) return [];

  // Limit batch size
  const itemsToProcess = newsItems.slice(0, 15);
  
  const inputs = itemsToProcess.map((item, idx) => ({
    index: idx,
    title: item.title,
    summarySnippet: item.summary.substring(0, 100)
  }));

  const prompt = `
    You are a news classifier for Yemen News.
    Data: ${JSON.stringify(inputs)}
    
    Tasks:
    1. Generate 2-3 Arabic tags (e.g., #سياسة, #صنعاء).
    2. Identify if it is "urgent" (contains عاجل, هام, killing, explosion).
    
    Output JSON array:
    [ { "index": 0, "tags": ["tag1"], "isUrgent": false } ]
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { responseMimeType: "application/json" }
    });

    const enhancements = JSON.parse(response.text || "[]");
    
    return itemsToProcess.map((item, idx) => {
      const enhancement = enhancements.find((e: any) => e.index === idx);
      if (enhancement) {
        const extraTags = enhancement.isUrgent ? ['عاجل'] : [];
        return {
          ...item,
          tags: [...(enhancement.tags || []), ...extraTags],
        };
      }
      return item;
    });

  } catch (e) {
    console.error("AI Enhancement failed", e);
    return itemsToProcess;
  }
};
