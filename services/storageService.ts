import { NewsItem, Source } from '../types';
import { db } from '../utils/db'; // Import local DB wrapper

// API BASE URL - Points to Node.js server
const API_URL = '/api';

// Helper to generate favicon URL (Fallback)
const getFavicon = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

// Initial Default Sources
const DEFAULT_SOURCES: Source[] = [
  { 
    id: '1', 
    name: 'مأرب برس', 
    url: 'https://marebpress.net/news_rss.php?lang=arabic&top=2', 
    type: 'rss', 
    active: true,
    logoUrl: getFavicon('marebpress.net')
  },
  { 
    id: '2', 
    name: 'المصدر أونلاين', 
    url: 'https://almasdaronline.com/rss', 
    type: 'rss', 
    active: true,
    logoUrl: getFavicon('almasdaronline.com')
  },
  { 
    id: '3', 
    name: 'بوست 24', 
    url: 'https://www.24-post.com/rss.php?cat=1', 
    type: 'rss', 
    active: true,
    logoUrl: getFavicon('24-post.com')
  },
  { 
    id: '4', 
    name: 'البلاد الان', 
    url: 'https://albiladn.net/feed/', 
    type: 'rss', 
    active: true,
    logoUrl: getFavicon('albiladn.net')
  },
  { 
    id: '5', 
    name: 'أوام أونلاين', 
    url: 'http://www.awamonline.net/rss', 
    type: 'rss', 
    active: true,
    logoUrl: getFavicon('awamonline.net')
  },
  { 
    id: '6', 
    name: 'يمن فيوتشر', 
    url: 'https://yemenfuture.net/rss.php?cat=1', 
    type: 'rss', 
    active: true,
    logoUrl: getFavicon('yemenfuture.net'),
    contentSelector: '.details'
  },
  { 
    id: '7', 
    name: 'كريتر سكاي', 
    url: 'https://crater-sky.com/feed/categories', 
    type: 'rss', 
    active: true,
    logoUrl: getFavicon('crater-sky.com')
  },
  { 
    id: '8', 
    name: 'السدة نيوز', 
    url: 'http://sedda.news/rss/category/أخبار--محلية', 
    type: 'rss', 
    active: true,
    logoUrl: getFavicon('sedda.news')
  }
];

// --- API HELPER ---
const apiFetch = async (endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any) => {
    try {
        const options: RequestInit = {
            method,
            headers: { 'Content-Type': 'application/json' }
        };
        if (body) options.body = JSON.stringify(body);
        
        const response = await fetch(`${API_URL}${endpoint}`, options);
        
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("text/html")) {
             throw new Error("API returned HTML (Server error or 404)");
        }

        if (!response.ok) throw new Error('Network response was not ok');
        return await response.json();
    } catch (error) {
        console.warn(`API (${endpoint}) unavailable, falling back to local DB.`); 
        return null;
    }
};

export const getSources = async (): Promise<Source[]> => {
  // 1. Try Remote Node API
  const remoteSources = await apiFetch('/sources');
  if (remoteSources && Array.isArray(remoteSources) && remoteSources.length > 0) {
    await db.saveSources(remoteSources);
    return remoteSources;
  }

  // 2. Fallback to Local DB
  const localSources = await db.getAllSources();
  if (localSources && localSources.length > 0) {
      return localSources;
  }

  // 3. Fallback to Defaults
  await db.saveSources(DEFAULT_SOURCES);
  return DEFAULT_SOURCES;
};

export const saveSources = async (sources: Source[]) => {
  await db.saveSources(sources);
  await apiFetch('/sources', 'POST', sources);
};

export const getNews = async (): Promise<NewsItem[]> => {
  const remoteNews = await apiFetch('/news?limit=200');
  if (remoteNews && Array.isArray(remoteNews)) {
    return remoteNews;
  }
  return await db.getAllNews();
};

export const saveNews = async (news: NewsItem[]) => {
  if (news.length === 0) return;
  
  await db.saveNewsItems(news);
  await apiFetch('/news', 'POST', news);
};

export const incrementViewCount = async (id: string): Promise<NewsItem[]> => {
  apiFetch(`/news/${id}/view`, 'POST', {});
  return []; 
};

export const clearNews = async () => {
    await db.clearNews();
    await apiFetch('/news/clear', 'POST', {});
};