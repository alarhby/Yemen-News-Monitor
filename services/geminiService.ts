
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

const scrapeFullContent = async (originalUrl: string): Promise<string | null> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); 

    const response = await fetch(`${CORS_PROXY}${encodeURIComponent(originalUrl)}`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) return null;
    
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Remove clutter
    const scripts = doc.querySelectorAll('script, style, nav, header, footer, .sidebar, .comments, .ads, .advertisement');
    scripts.forEach(s => s.remove());

    // Try specific selectors for Yemeni news sites
    const selectors = [
      'article', '.article-content', '.entry-content', '#article-body', '.post-content', '.details', '.news-details', '.body-text',
      '.detail-content'
    ];

    let contentElement: Element | null = null;
    for (const selector of selectors) {
      const el = doc.querySelector(selector);
      if (el && el.textContent && el.textContent.length > 500) {
        contentElement = el;
        break;
      }
    }

    if (!contentElement) contentElement = doc.body;
    if (!contentElement) return null;

    // Extract text from paragraphs to maintain structure
    const paragraphs = Array.from(contentElement.querySelectorAll('p, div'));
    const cleanText = paragraphs
      .map(p => p.textContent?.trim())
      .filter(text => text && text.length > 30) // Filter short snippets
      .join('\n\n');

    return cleanText.length > 300 ? cleanText : null;
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
      
      if (encodedContent && encodedContent.length > summary.length) {
        // Use encoded content if available (remove HTML tags for clean reading)
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = encodedContent;
        fullContent = tempDiv.textContent || summary;
      } else {
        fullContent = summary;
        // Scrape as fallback if content is too short (uncommented for "Max Detail")
        if (link && link !== '#' && fullContent.length < 500) {
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
        summary: summary.substring(0, 200) + '...', // Keep summary short for card
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
