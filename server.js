/**
 * SYNAPSE SPPU PYQ — Main Server (MongoDB + Cloudinary)
 */
require('dotenv').config();
const express   = require('express');
const session   = require('express-session');
const mongoose  = require('mongoose');
const path      = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Connect MongoDB ───────────────────────────────────────────────────────────
// ── Connect MongoDB ───────────────────────────────────────────────────────────
let cachedConnection = null;

const connectDB = async () => {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }

  try {
    console.log('⏳ Connecting to MongoDB...');
    const db = await mongoose.connect(process.env.MONGODB_URI, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 10000, // Increased for stability
      socketTimeoutMS: 45000,
    });
    cachedConnection = db;
    console.log('✅ MongoDB connected');
    return db;
  } catch (err) {
    console.error('❌ MongoDB error:', err);
    throw err;
  }
};

// Initial connect for local dev or first Vercel invocation
connectDB();

// Middleware to ensure DB is connected for every request
app.use(async (req, res, next) => {
  await connectDB();
  next();
});

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const MongoStore = require('connect-mongo').default || require('connect-mongo');

app.use(session({
  secret: process.env.SESSION_SECRET || 'synapse-sppu-secret-2024',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions',
    ttl: 24 * 60 * 60, // 1 day
    autoRemove: 'native'
  }),
  cookie: { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }
}));

// ── Static files ──────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── SEO Files ─────────────────────────────────────────────────────────────────
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *
Allow: /

Sitemap: https://sppupyq-synapse.vercel.app/sitemap.xml`);
});

app.get('/sitemap.xml', (req, res) => {
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url>
<loc>https://sppupyq-synapse.vercel.app/</loc>
<lastmod>2026-05-07</lastmod>
<changefreq>weekly</changefreq>
<priority>1.0</priority>
</url>
<url>
<loc>https://sppupyq-synapse.vercel.app/student-login.html</loc>
<lastmod>2026-05-07</lastmod>
<changefreq>monthly</changefreq>
<priority>0.8</priority>
</url>
</urlset>`;
  res.header('Content-Type', 'text/xml');
  res.send(sitemap.trim());
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/auth',    require('./routes/auth'));
app.use('/api',     require('./routes/api'));
app.use('/admin',   require('./routes/admin'));
app.use('/student', require('./routes/student'));

// ── Catch-all ─────────────────────────────────────────────────────────────────
app.get('*', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

// ── Local dev server ──────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n🧠 SYNAPSE running at http://localhost:${PORT}`);
  });
}

// ── Export for Vercel serverless ──────────────────────────────────────────────
module.exports = app;
