export interface Source {
  id: string;
  name: string;
  url: string;
  logoUrl?: string; // Custom logo for the source
  type: 'rss' | 'url' | 'xml';
  active: boolean;
}

export interface NewsItem {
  id: string;
  sourceId: string;
  sourceName: string; // Display name
  originalUrl: string; // Link to the original article
  title: string;
  summary: string;
  content: string; // Full content or longer summary
  tags: string[];
  imageUrl?: string;
  imageType: 'photo' | 'logo'; // Distinguish between generated photo and source logo
  publishedAt: string;
  views: number;
  isTrending?: boolean;
}

export type ViewState = 'feed' | 'admin-login' | 'admin-dashboard' | 'article-view';

export const ADMIN_USER = 'admin';
export const ADMIN_PASS = '12345678';