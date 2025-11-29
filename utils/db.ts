
import { NewsItem, Source } from '../types';

const DB_NAME = 'YemenNewsDB';
const DB_VERSION = 2;
const STORE_NEWS = 'news';
const STORE_SOURCES = 'sources';

export class NewsDB {
  private db: IDBDatabase | null = null;

  async connect(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // News Store
        if (!db.objectStoreNames.contains(STORE_NEWS)) {
          const store = db.createObjectStore(STORE_NEWS, { keyPath: 'id' });
          store.createIndex('publishedAt', 'publishedAt', { unique: false });
          store.createIndex('views', 'views', { unique: false });
        }

        // Sources Store
        if (!db.objectStoreNames.contains(STORE_SOURCES)) {
          db.createObjectStore(STORE_SOURCES, { keyPath: 'id' });
        }
      };
    });
  }

  async getAllNews(): Promise<NewsItem[]> {
    const db = await this.connect();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NEWS, 'readonly');
      const store = transaction.objectStore(STORE_NEWS);
      const request = store.getAll();
      request.onsuccess = () => {
          // Sort manually since IndexedDB sorting is basic
          const items = request.result as NewsItem[];
          resolve(items.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()));
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveNewsItems(items: NewsItem[]): Promise<void> {
    const db = await this.connect();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NEWS, 'readwrite');
      const store = transaction.objectStore(STORE_NEWS);
      
      items.forEach(item => store.put(item)); // put updates if exists, adds if new

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getNewsById(id: string): Promise<NewsItem | undefined> {
      const db = await this.connect();
      return new Promise((resolve, reject) => {
          const transaction = db.transaction(STORE_NEWS, 'readonly');
          const store = transaction.objectStore(STORE_NEWS);
          const request = store.get(id);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
      });
  }

  async getAllSources(): Promise<Source[]> {
    const db = await this.connect();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_SOURCES, 'readonly');
      const store = transaction.objectStore(STORE_SOURCES);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async saveSources(sources: Source[]): Promise<void> {
    const db = await this.connect();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_SOURCES, 'readwrite');
      const store = transaction.objectStore(STORE_SOURCES);
      
      // Clear old sources to ensure sync
      store.clear(); 
      
      sources.forEach(source => store.add(source));

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
  
  async clearNews(): Promise<void> {
      const db = await this.connect();
      return new Promise((resolve, reject) => {
          const transaction = db.transaction(STORE_NEWS, 'readwrite');
          const store = transaction.objectStore(STORE_NEWS);
          const request = store.clear();
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
      });
  }
}

export const db = new NewsDB();
