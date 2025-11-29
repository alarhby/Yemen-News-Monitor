import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './db.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Support large payloads

// --- API ROUTES ---

// 1. Get Sources
app.get('/api/sources', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM sources');
    // Convert active tinyint to boolean
    const sources = rows.map(s => ({ ...s, active: !!s.active }));
    res.json(sources);
  } catch (error) {
    console.error('Error fetching sources:', error);
    res.status(500).json({ error: 'Failed to fetch sources' });
  }
});

// 2. Save/Update Sources
app.post('/api/sources', async (req, res) => {
  const sources = req.body;
  if (!Array.isArray(sources) || sources.length === 0) return res.json({ success: true });

  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    
    // Clear old sources strategy or Upsert?
    // Strategy: Upsert based on ID
    const query = `
      INSERT INTO sources (id, name, url, logo_url, content_selector, type, active)
      VALUES ?
      ON DUPLICATE KEY UPDATE
      name = VALUES(name), url = VALUES(url), logo_url = VALUES(logo_url), 
      content_selector = VALUES(content_selector), type = VALUES(type), active = VALUES(active)
    `;

    const values = sources.map(s => [
      s.id, s.name, s.url, s.logoUrl || null, s.contentSelector || null, s.type, s.active ? 1 : 0
    ]);

    await connection.query(query, [values]);
    await connection.commit();
    res.json({ success: true, message: 'Sources saved' });
  } catch (error) {
    await connection.rollback();
    console.error('Error saving sources:', error);
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});

// 3. Get News
app.get('/api/news', async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit) : 200;
    const [rows] = await db.query('SELECT * FROM news ORDER BY published_at DESC LIMIT ?', [limit]);
    
    // Parse tags JSON or string
    const news = rows.map(item => ({
      id: item.id,
      sourceId: item.source_id,
      sourceName: item.source_name,
      originalUrl: item.original_url,
      title: item.title,
      summary: item.summary,
      content: item.content,
      tags: item.tags ? item.tags.split(',') : [],
      imageUrl: item.image_url,
      imageType: item.image_type,
      publishedAt: item.published_at,
      views: item.views
    }));
    
    res.json(news);
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ error: 'Failed to fetch news' });
  }
});

// 4. Save News (Deduplication handled by MySQL UNIQUE constraint on original_url)
app.post('/api/news', async (req, res) => {
  const newsItems = req.body;
  if (!Array.isArray(newsItems) || newsItems.length === 0) return res.json({ success: true });

  try {
    const query = `
      INSERT INTO news 
      (id, source_id, source_name, original_url, title, summary, content, tags, image_url, image_type, published_at, views)
      VALUES ?
      ON DUPLICATE KEY UPDATE
      title = VALUES(title), summary = VALUES(summary), content = VALUES(content), 
      tags = VALUES(tags), image_url = VALUES(image_url), published_at = VALUES(published_at)
    `;

    // Map data to array of arrays
    const values = newsItems.map(item => [
      item.id,
      item.sourceId || null,
      item.sourceName,
      item.originalUrl,
      item.title,
      item.summary,
      item.content,
      Array.isArray(item.tags) ? item.tags.join(',') : '',
      item.imageUrl,
      item.imageType,
      new Date(item.publishedAt).toISOString().slice(0, 19).replace('T', ' '), // Format MySQL Datetime
      item.views || 0
    ]);

    await db.query(query, [values]);
    res.json({ success: true, count: newsItems.length });
  } catch (error) {
    console.error('Error saving news:', error);
    res.status(500).json({ error: error.message });
  }
});

// 5. Increment View
app.post('/api/news/:id/view', async (req, res) => {
  try {
    await db.query('UPDATE news SET views = views + 1 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update view' });
  }
});

// 6. Clear News
app.post('/api/news/clear', async (req, res) => {
  try {
    await db.query('TRUNCATE TABLE news');
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clear news' });
  }
});

// --- Serve Static Frontend in Production ---
// If running in production mode, serve the React build files
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});