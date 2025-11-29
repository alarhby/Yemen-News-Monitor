
import { NewsItem, Source } from '../types';
import { db } from '../utils/db';

// Helper to generate favicon URL
const getFavicon = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

// Initial Mock Data
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
    logoUrl: getFavicon('yemenfuture.net')
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

export const getSources = async (): Promise<Source[]> => {
  const sources = await db.getAllSources();
  if (sources.length > 0) {
    return sources;
  }
  // Initialize defaults if empty
  await db.saveSources(DEFAULT_SOURCES);
  return DEFAULT_SOURCES;
};

export const saveSources = async (sources: Source[]) => {
  await db.saveSources(sources);
};

export const getNews = async (): Promise<NewsItem[]> => {
  return await db.getAllNews();
};

export const saveNews = async (news: NewsItem[]) => {
  await db.saveNewsItems(news);
};

export const incrementViewCount = async (id: string): Promise<NewsItem[]> => {
  const item = await db.getNewsById(id);
  if (item) {
      item.views = (item.views || 0) + 1;
      await db.saveNewsItems([item]);
  }
  return await db.getAllNews();
};

export const clearNews = async () => {
    await db.clearNews();
}
