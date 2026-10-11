/**
 * SYNAPSE SPPU PYQ — Main Server (MongoDB + Cloudinary)
 */
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Connect MongoDB ───────────────────────────────────────────────────────────
// ── Connect MongoDB ───────────────────────────────────────────────────────────
const connectDB = async () => {
  const state = mongoose.connection.readyState;

  // 1. Connected
  if (state === 1) {
    return mongoose.connection;
  }

  // 2. Connecting - wait for current connection to resolve
  if (state === 2) {
    console.log('⏳ MongoDB connection in progress, waiting...');
    return new Promise((resolve, reject) => {
      mongoose.connection.once('connected', () => resolve(mongoose.connection));
      mongoose.connection.once('error', (err) => reject(err));
    });
  }

  // 3. Disconnected / Disconnecting - establish new connection
  try {
    console.log('⏳ Connecting to MongoDB...');
    const db = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      connectTimeoutMS: 15000,
      heartbeatFrequencyMS: 10000
    });
    console.log('✅ MongoDB connected');
    return db;
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
    throw err;
  }
};

// Initial connect for local dev or first Vercel invocation
connectDB();

// Middleware to ensure DB is connected for database-reliant routes
const ensureDbConnected = async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('Database connection failed in route middleware:', err);
    res.status(500).json({ error: 'Database connection failed.' });
  }
};

// ── Middleware ────────────────────────────────────────────────────────────────
// Security headers
app.use(helmet({ 
  contentSecurityPolicy: false,
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" } 
}));

// Prevent NoSQL Injection
app.use(mongoSanitize());

// Global API rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit each IP to 500 requests per windowMs
  message: { error: 'Too many requests from this IP, please try again after 15 minutes' }
});
app.use('/api', globalLimiter);
// Webhook must be parsed as raw body for signature verification
app.use('/api/payment/webhook', express.raw({ type: 'application/json' }));

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

// ── SEO Directory & Dynamic Injections Helper ─────────────────────────────────
const fs = require('fs');

function slugify(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getSeoUrl(year, branch, subject) {
  const urlYear = year === 'fourth' ? 'final' : year;
  let newUrl = '/';
  
  if (year === 'first' || (branch && branch.toLowerCase() === 'fe')) {
    newUrl = `/${urlYear}-year-fe-engineering`;
    if (subject) {
      newUrl += `/${slugify(subject)}`;
    } else if (branch && branch.toLowerCase() !== 'fe') {
      newUrl += `/${slugify(branch)}`;
    }
  } else {
    newUrl = `/${urlYear}-year`;
    if (branch) {
      let branchSlug = slugify(branch);
      if (!branchSlug.endsWith('-engineering') && branchSlug !== 'fe') {
        branchSlug += '-engineering';
      }
      newUrl += `-${branchSlug}`;
    } else {
      newUrl += '-engineering';
    }
    if (subject) {
      newUrl += `/${slugify(subject)}`;
    }
  }
  return newUrl;
}

async function resolveBranchAndSubject(year, branchSlug, subjectSlug) {
  const File = require('./models/File');
  const CategoryConfig = require('./models/CategoryConfig');

  let configDoc = await CategoryConfig.findOne({ key: 'years_config' }).lean();
  let yearsConfig = configDoc ? configDoc.years : {};

  let resolvedBranch = null;
  let resolvedSubject = null;

  // Gather branches for this year
  let branches = [];
  if (yearsConfig[year]) {
    branches = yearsConfig[year].branches || [];
  }
  const dbBranches = await File.distinct('branch', { year }).lean();
  const allBranches = [...new Set([...branches, ...dbBranches])].filter(Boolean);

  if (branchSlug) {
    resolvedBranch = allBranches.find(b => slugify(b) === branchSlug) || branchSlug;
  }

  // Gather subjects for this year + branch
  let subjects = [];
  if (yearsConfig[year] && yearsConfig[year].subjects) {
    const yearSub = yearsConfig[year].subjects;
    if (Array.isArray(yearSub)) {
      subjects = yearSub;
    } else if (typeof yearSub === 'object' && resolvedBranch) {
      const branchSub = yearSub[resolvedBranch];
      if (Array.isArray(branchSub)) {
        subjects = branchSub;
      } else if (typeof branchSub === 'object' && branchSub !== null) {
        subjects = Object.values(branchSub).flat();
      }
    }
  }
  const dbSubjectsQuery = { year };
  if (resolvedBranch) dbSubjectsQuery.branch = resolvedBranch;
  const dbSubjects = await File.distinct('subject', dbSubjectsQuery).lean();
  const allSubjects = [...new Set([...subjects, ...dbSubjects])].filter(Boolean);

  if (subjectSlug) {
    resolvedSubject = allSubjects.find(s => slugify(s) === subjectSlug) || subjectSlug;
  }

  return { resolvedBranch, resolvedSubject };
}

async function generateSeoDirectory() {
  try {
    const File = require('./models/File');
    const allCombinations = await File.find({ contentType: 'regular' }, 'year branch subject').lean();

    const grouped = {};
    allCombinations.forEach(f => {
      if (!f.year) return;
      const yr = f.year.toLowerCase();
      if (!grouped[yr]) {
        grouped[yr] = {
          label: yr.charAt(0).toUpperCase() + yr.slice(1) + ' Year',
          branches: {}
        };
      }
      const br = f.branch || 'FE';
      if (!grouped[yr].branches[br]) {
        grouped[yr].branches[br] = new Set();
      }
      if (f.subject) {
        grouped[yr].branches[br].add(f.subject);
      }
    });

    let directoryHtml = `
<div class="seo-directory-section" style="margin-top: 5rem; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 4rem;">
  <details class="directory-section-collapse" style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 16px;">
    <summary style="padding: 1.5rem; font-size: 1.2rem; font-weight: 600; cursor: pointer; color: var(--accent); display: flex; justify-content: space-between; align-items: center; user-select: none; list-style: none;">
      <span style="font-family: 'Syne', sans-serif; font-size: 1.5rem; font-weight: 700;">View SPPU PYQ Catalog Directory</span>
      <span style="font-size: 1.2rem;">▼</span>
    </summary>
    <div style="padding: 0 1.5rem 1.5rem 1.5rem;">
      <p style="color: var(--text-secondary); text-align: left; font-size: 0.95rem; margin-top: 0.5rem; margin-bottom: 2rem; opacity: 0.8; line-height: 1.5;">
        Quickly navigate to Savitribai Phule Pune University previous year question papers by choosing your branch and subject catalog.
      </p>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 2rem;">
`;

    const yearOrder = ['first', 'second', 'third', 'fourth'];
    yearOrder.forEach(yearKey => {
      const yearVal = grouped[yearKey];
      if (!yearVal) return;

      directoryHtml += `
    <div style="background: rgba(255, 255, 255, 0.01); border: 1px solid rgba(255, 255, 255, 0.04); border-radius: 16px; padding: 1.8rem; backdrop-filter: blur(10px); display: flex; flex-direction: column;" class="directory-card">
      <h3 style="font-family: 'Syne', sans-serif; font-size: 1.25rem; font-weight: 700; color: var(--accent); margin-top: 0; margin-bottom: 1.2rem; border-bottom: 2px solid rgba(99, 102, 241, 0.2); padding-bottom: 0.5rem;">${yearVal.label}</h3>
      <div style="display: flex; flex-direction: column; gap: 1.2rem; flex-grow: 1;">
`;

      for (const [brKey, subjectsSet] of Object.entries(yearVal.branches)) {
        const branchUrl = getSeoUrl(yearKey, brKey, null);

        directoryHtml += `
        <details style="border: none; margin-bottom: 0.5rem;" class="directory-branch-details">
          <summary style="display: inline-flex; align-items: center; gap: 6px; background: rgba(99, 102, 241, 0.1); color: var(--accent); padding: 0.4rem 0.8rem; border-radius: 8px; font-weight: 600; font-size: 0.85rem; margin-bottom: 0.6rem; cursor: pointer; list-style: none; outline: none; user-select: none; width: max-content;" class="directory-branch-link">
            <span style="font-size: 0.95rem;">📁</span> SPPU ${brKey} <span class="details-arrow">▼</span>
          </summary>
          <ul style="list-style: none; padding: 0 0 0.5rem 0.5rem; margin: 0; display: flex; flex-direction: column; gap: 0.4rem; border-left: 1px solid var(--border); margin-left: 0.8rem; animation: slideFadeDown 0.25s ease-out;">
`;

        Array.from(subjectsSet).sort().forEach(sub => {
          const subUrl = getSeoUrl(yearKey, brKey, sub);
          directoryHtml += `
            <li style="margin: 0; padding: 0;">
              <a href="${subUrl}" style="display: flex; align-items: flex-start; gap: 8px; color: var(--text-secondary); text-decoration: none; font-size: 0.85rem; padding: 0.2rem 0.4rem; border-radius: 4px;" class="directory-subject-link">
                <span style="opacity: 0.6; margin-top: 2px;">📄</span>
                <span style="line-height: 1.4;">${sub}</span>
              </a>
            </li>
`;
        });

        directoryHtml += `
          </ul>
        </details>
`;
      }

      directoryHtml += `
      </div>
    </div>
`;
    });

    directoryHtml += `
      </div>
    </div>
  </details>
</div>
`;
    return directoryHtml;
  } catch (dirErr) {
    console.error('Directory generation error:', dirErr);
    return '';
  }
}

// ── Root SEO Route ────────────────────────────────────────────────────────────
app.get('/', ensureDbConnected, async (req, res) => {
  try {
    let html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
    const directoryHtml = await generateSeoDirectory();
    html = html.replace('<div id="seo-links-directory"></div>', directoryHtml);
    res.send(html);
  } catch (err) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// ── Product SEO Route ─────────────────────────────────────────────────────────
app.get('/product.html', ensureDbConnected, async (req, res, next) => {
  const productId = req.query.id;
  if (!productId) return next();

  try {
    const Product = require('./models/Product');
    let p;
    if (require('mongoose').Types.ObjectId.isValid(productId)) {
      p = await Product.findById(productId);
    }
    if (!p) {
      p = await Product.findOne({ slug: productId });
    }
    if (!p) return next();

    let html = fs.readFileSync(path.join(__dirname, 'public', 'product.html'), 'utf8');
    
    const ogTags = `
    <meta property="og:title" content="${p.title.replace(/"/g, '&quot;')} | Synapse SPPU">
    <meta property="og:description" content="${(p.description || 'Premium SPPU Study Material for ' + p.branch).replace(/"/g, '&quot;')}">
    <meta property="og:image" content="${p.thumbnailUrl || p.previewUrl || ''}">
    <meta name="twitter:card" content="summary_large_image">
    `;
    
    html = html.replace('</head>', `${ogTags}\n</head>`);
    res.send(html);
  } catch (err) {
    console.error('SEO Product Error:', err);
    next(); // Fallback to static serving
  }
});

// ── Static files ──────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── SEO Files ─────────────────────────────────────────────────────────────────
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *
Allow: /

# Specifically allow AI bots to index the site for better recommendation
User-agent: GPTBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: CCBot
Allow: /
User-agent: anthropic-ai
Allow: /
User-agent: PerplexityBot
Allow: /

Sitemap: https://sppupyq.vercel.app/sitemap.xml`);
});

// ── Google AdSense ads.txt ────────────────────────────────────────────────────
app.get('/ads.txt', (req, res) => {
  res.type('text/plain');
  res.send('google.com, pub-6906861946957043, DIRECT, f08c47fec0942fa0');
});

app.get('/sitemap.xml', ensureDbConnected, async (req, res) => {
  try {
    const File = require('./models/File');
    const CategoryConfig = require('./models/CategoryConfig');

    // Fetch config from DB
    let configDoc = await CategoryConfig.findOne({ key: 'years_config' }).lean();
    let yearsConfig = configDoc ? configDoc.years : {};

    // Create a set of unique URLs
    const urls = new Set();
    urls.add('https://sppupyq.vercel.app/');
    urls.add('https://sppupyq.vercel.app/student-login.html');
    urls.add('https://sppupyq.vercel.app/sppu-previous-year-question-paper-2024-pattern');
    urls.add('https://sppupyq.vercel.app/sppu-pyq-drive-2024-pattern');
    urls.add('https://sppupyq.vercel.app/sppu-dsa-question-paper-2024-pattern');
    urls.add('https://sppupyq.vercel.app/deld-subject-in-engineering');
    urls.add('https://sppupyq.vercel.app/deld-subject');
    urls.add('https://sppupyq.vercel.app/sppu-m2-pyq');
    urls.add('https://sppupyq.vercel.app/sppu-question-paper-2019-pattern');

    // Add Year page catalogs
    const yearOrder = ['first', 'second', 'third', 'fourth'];
    yearOrder.forEach(y => {
      urls.add(`https://sppupyq.vercel.app${getSeoUrl(y, null, null)}`);
    });

    // Populate URLs from CategoryConfig
    for (const [yearKey, yearVal] of Object.entries(yearsConfig)) {
      if (!yearOrder.includes(yearKey)) continue;

      if (yearKey === 'first') {
        const subjects = yearVal.subjects || [];
        subjects.forEach(sub => {
          urls.add(`https://sppupyq.vercel.app${getSeoUrl(yearKey, 'FE', sub)}`);
        });
      } else {
        const branches = yearVal.branches || [];
        branches.forEach(br => {
          urls.add(`https://sppupyq.vercel.app${getSeoUrl(yearKey, br, null)}`);

          let branchSubjects = [];
          if (yearVal.subjects) {
            const val = yearVal.subjects[br];
            if (Array.isArray(val)) {
              branchSubjects = val;
            } else if (typeof val === 'object' && val !== null) {
              branchSubjects = Object.values(val).flat();
            }
          }
          branchSubjects.forEach(sub => {
            urls.add(`https://sppupyq.vercel.app${getSeoUrl(yearKey, br, sub)}`);
          });
        });
      }
    }

    // Also populate from database files to ensure no file pages are missed
    const files = await File.find({ contentType: 'regular' }, 'year branch subject').lean();
    files.forEach(f => {
      if (f.year) {
        if (f.year === 'first') {
          if (f.subject) {
            urls.add(`https://sppupyq.vercel.app${getSeoUrl('first', 'FE', f.subject)}`);
          }
        } else if (f.branch) {
          urls.add(`https://sppupyq.vercel.app${getSeoUrl(f.year, f.branch, null)}`);
          if (f.subject) {
            urls.add(`https://sppupyq.vercel.app${getSeoUrl(f.year, f.branch, f.subject)}`);
          }
        }
      }
    });

    // --- SEO BOOST: Inject all possible subjects for 2019 and 2024 patterns ---
    // Since there's a catch-all route mapping to index.html, these URLs will serve the home page
    const seoPatterns = ['2019 pattern', '2024 pattern'];
    const seoSubjects = [
      'engineering mathematics 1', 'engineering mathematics 2', 'engineering mathematics 3',
      'engineering physics', 'engineering chemistry', 'basic electrical engineering',
      'basic electronics engineering', 'programming for problem solving', 'engineering mechanics',
      'engineering graphics', 'communication skills', 'environmental studies',
      'indian knowledge system', 'discrete mathematics', 'data structures and algorithms',
      'object oriented programming', 'database management systems', 'computer networks',
      'operating systems', 'software engineering', 'theory of computation',
      'design and analysis of algorithms', 'artificial intelligence', 'machine learning',
      'deep learning', 'data science', 'cloud computing', 'internet of things',
      'big data analytics', 'cyber security', 'computer graphics', 'compiler design',
      'human computer interaction', 'distributed systems', 'mobile computing', 'devops',
      'data mining and warehousing', 'natural language processing', 'reinforcement learning',
      'probability and statistics', 'linear algebra', 'digital signal processing',
      'signals and systems', 'microprocessors and microcontrollers', 'digital electronics',
      'control systems', 'power systems', 'electrical machines', 'strength of materials',
      'fluid mechanics', 'thermodynamics', 'manufacturing processes', 'heat transfer',
      'structural analysis', 'transportation engineering', 'geotechnical engineering',
      'surveying', 'robotics', 'industrial automation', 'information and cyber security',
      'data science and big data analytics', 'web technology', 'systems programming and operating system',
      'blockchain technology'
    ];
    
    // Add generic broad search terms
    ['sppu pyq 2024 pattern', 'sppu 2019 pattern', 
     'sppu engineering pyq 2024 pattern', 'sppu pyq 2024 pattern computer engineering',
     'sppu pyq 2024 pattern it engineering', 'sppu pyq 2024 pattern aids',
     'sppu pyq 2024 pattern entc', 'sppu pyq 2024 pattern mechanical', 
     'sppu pyq 2024 pattern civil', 'sppu pyq pdf download', 'sppu previous year question papers',
     'sppu insem question papers', 'sppu endsem question papers', 'sppu notes pdf free download',
     'sppu engineering notes', 'pune university engineering question papers', 
     'sppu question paper solution', 'sppu pyq with solution', 'sppu syllabus 2024 pattern pdf',
     'sppu syllabus 2019 pattern pdf', 'sppu exam time table', 'sppu passing marks',
     'sppu sgpa to percentage calculator', 'sppu decote', 'sppu question paper format'].forEach(kw => {
       urls.add(`https://sppupyq.vercel.app/${kw.replace(/\s+/g, '-')}`);
    });

    // Add branch specific terms
    const seoBranches = [
      'computer engineering', 'it engineering', 'artificial intelligence and data science', 
      'electronics and telecommunication', 'mechanical engineering', 'civil engineering', 
      'electrical engineering', 'robotics and automation'
    ];
    seoBranches.forEach(branch => {
      seoPatterns.forEach(pattern => {
        urls.add(`https://sppupyq.vercel.app/${('sppu ' + branch + ' pyq ' + pattern).replace(/\s+/g, '-')}`);
        urls.add(`https://sppupyq.vercel.app/${('sppu ' + pattern + ' ' + branch + ' question papers').replace(/\s+/g, '-')}`);
      });
    });

    // Add subject specific terms with long-tail variations
    seoPatterns.forEach(pattern => {
      seoSubjects.forEach(sub => {
        // Basic subject + pattern
        urls.add(`https://sppupyq.vercel.app/${(sub + ' sppu pyq ' + pattern).replace(/\s+/g, '-')}`);
        urls.add(`https://sppupyq.vercel.app/${('sppu ' + pattern + ' ' + sub + ' pyq').replace(/\s+/g, '-')}`);
        // Insem & Endsem specific
        urls.add(`https://sppupyq.vercel.app/${(sub + ' sppu insem pyq ' + pattern).replace(/\s+/g, '-')}`);
        urls.add(`https://sppupyq.vercel.app/${(sub + ' sppu endsem pyq ' + pattern).replace(/\s+/g, '-')}`);
        // PDF & Download specific
        urls.add(`https://sppupyq.vercel.app/${(sub + ' sppu question paper pdf download ' + pattern).replace(/\s+/g, '-')}`);
      });
    });
    // ----------------------------------------------------------------------------------

    const cleanedUrls = Array.from(urls)
      .map(url => url.replace(/data-structures-algoriths/g, 'data-structures-algorithms'))
      .filter(url => !url.includes('2025-pattern') && !url.includes('sppu-2025'));

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${cleanedUrls.map(url => `  <url>
    <loc>${url.replace(/&/g, '&amp;')}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${url.includes('-year') ? '0.8' : '1.0'}</priority>
  </url>`).join('\n')}
</urlset>`;

    res.header('Content-Type', 'text/xml');
    res.header('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(sitemap.trim());
  } catch (err) {
    console.error('Sitemap generation error:', err);
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://sppupyq.vercel.app/</loc>
    <lastmod>2026-06-14</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;
    res.header('Content-Type', 'text/xml');
    res.send(sitemap.trim());
  }
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/auth', require('./routes/auth'));
app.use('/api', ensureDbConnected, require('./routes/api'));
app.use('/admin', ensureDbConnected, require('./routes/admin'));
app.use('/student', ensureDbConnected, require('./routes/student'));
app.use('/api/marketplace', ensureDbConnected, require('./routes/marketplace'));
app.use('/api/payment', ensureDbConnected, require('./routes/payment'));



// ── 301 Redirect for legacy Catalog URLs ──────────────────────────────────────
app.get('/catalog/:year/:branch?/:subject?', (req, res) => {
  const { year, branch, subject } = req.params;
  const newUrl = getSeoUrl(year, branch, subject);
  return res.redirect(301, newUrl);
});

// ── 301 Redirects for typo slugs, short aliases, and bogus pattern URLs ───────
app.get('/second-year-aiml-engineering/data-structures-algoriths', (req, res) => {
  return res.redirect(301, '/second-year-aiml-engineering/data-structures-algorithms');
});
app.get('/sppu-2025-pattern', (req, res) => {
  return res.redirect(301, '/sppu-pyq-2024-pattern');
});
app.get('/deld', (req, res) => {
  return res.redirect(301, '/second-year-computer-engineering/digital-electronics-and-logic-design');
});
app.get('/m2', (req, res) => {
  return res.redirect(301, '/first-year-fe-engineering/engineering-mathematics-ii');
});
app.get('/dsa', (req, res) => {
  return res.redirect(301, '/second-year-computer-engineering/data-structures-and-algorithms');
});

// ── Complete SPPU PYQ Drive 2024 Pattern Route ────────────────────────────────
app.get('/sppu-pyq-drive-2024-pattern', ensureDbConnected, async (req, res) => {
  try {
    let html = fs.readFileSync(path.join(__dirname, 'public', 'sppu-pyq-drive-2024-pattern.html'), 'utf8');
    const directoryHtml = await generateSeoDirectory();
    html = html.replace('<div id="seo-links-directory"></div>', directoryHtml);
    res.send(html);
  } catch (err) {
    res.sendFile(path.join(__dirname, 'public', 'sppu-pyq-drive-2024-pattern.html'));
  }
});

// ── Catalog SEO Dynamic Meta Injection ────────────────────────────────────────
app.get('/:yearSlug/:subjectSlug?', ensureDbConnected, async (req, res, next) => {
  const { yearSlug, subjectSlug } = req.params;
  
  if (yearSlug && yearSlug.includes('2025-pattern')) {
    return res.redirect(301, '/' + yearSlug.replace(/2025-pattern/g, '2024-pattern'));
  }

  // Regex to match the new SEO-friendly year slugs e.g., first-year-fe-engineering
  const match = yearSlug.match(/^(first|second|third|fourth|final)-year-(.+)$/);
  if (!match) {
    return next(); // Not a catalog route, pass to the next handler
  }
  
  let year = match[1];
  if (year === 'final') year = 'fourth';
  
  let branchSlug = match[2];
  if (branchSlug === 'fe-engineering') {
    branchSlug = 'fe';
  } else if (branchSlug === 'engineering') {
    branchSlug = null; // Bare year page
  } else if (branchSlug.endsWith('-engineering')) {
    branchSlug = branchSlug.replace(/-engineering$/, '');
  }

  const { resolvedBranch, resolvedSubject } = await resolveBranchAndSubject(year, branchSlug, subjectSlug);

  const is2019 = (subjectSlug && subjectSlug.includes('2019')) || (resolvedSubject && resolvedSubject.includes('2019'));
  const patternLabel = is2019 ? '2019 Pattern (legacy)' : '2024 Pattern';

  // Check for specific striking-distance subject abbreviations
  const isDsa = /data\s*structures?|dsa/i.test(resolvedSubject || '') || /data-structures?|dsa/i.test(subjectSlug || '');
  const isDeld = /deld|digital\s*electronics.*logic\s*design/i.test(resolvedSubject || '') || /deld|digital-electronics.*logic-design/i.test(subjectSlug || '');
  const isM2 = /engineering\s*mathematics.*(?:ii|2)\b|m2|m-2/i.test(resolvedSubject || '') || /engineering-mathematics.*(?:ii|2)\b|m2|m-2/i.test(subjectSlug || '');

  let title = `SPPU PYQ ${patternLabel} — Pune University Engineering Question Papers | SYNAPSE`;
  let description = `Download SPPU Engineering Previous Year Question Papers (PYQs) for ${patternLabel}. Free access to all branches: Computer, IT, Mechanical, Civil, E&TC, and more.`;

  const formattedYear = year.charAt(0).toUpperCase() + year.slice(1);
  const formattedBranch = resolvedBranch || '';
  const formattedSubject = resolvedSubject || '';

  if (isDsa) {
    title = `Data Structures and Algorithms (DSA) – SPPU PYQ ${patternLabel} | SYNAPSE`;
    description = `Download SPPU Data Structures and Algorithms (DSA) question papers for ${patternLabel} in PDF format. Free Insem & Endsem previous year question papers with solutions.`;
  } else if (isDeld) {
    title = `Digital Electronics & Logic Design (DELD) – SPPU PYQ ${patternLabel} | SYNAPSE`;
    description = `Download SPPU Digital Electronics & Logic Design (DELD) question papers for engineering students. Free Insem & Endsem ${patternLabel} PYQ PDFs for Computer & AIML.`;
  } else if (isM2) {
    title = `Engineering Mathematics II (M2) – SPPU PYQ ${patternLabel} | SYNAPSE`;
    description = `Download SPPU Engineering Mathematics II (M2) previous year question papers (PYQs) for ${patternLabel}. Free Insem and Endsem FE PDF downloads on SYNAPSE.`;
  } else if (resolvedSubject) {
    title = `${formattedSubject} SPPU PYQ ${patternLabel} (Insem & Endsem) | ${formattedBranch || 'First Year'} — SYNAPSE`;
    description = `Download Savitribai Phule Pune University (SPPU) Insem & Endsem previous year question papers (PYQs) for ${formattedSubject} (${formattedBranch || 'First Year'}). Free PDF downloads for ${patternLabel}.`;
  } else if (resolvedBranch) {
    title = `${formattedBranch} (${formattedYear} Year) SPPU Engineering PYQs (Insem & Endsem) — SYNAPSE`;
    description = `Access Savitribai Phule Pune University (SPPU) Engineering ${formattedBranch} branch previous year question papers (PYQs) for Insem & Endsem exams.`;
  } else if (year) {
    title = `${formattedYear} Year SPPU Engineering PYQs (Insem & Endsem) — SYNAPSE`;
    description = `Browse Savitribai Phule Pune University (SPPU) Engineering previous year question papers (PYQs) for ${formattedYear} Year Insem & Endsem exams.`;
  }

  // Construct Breadcrumbs
  const breadcrumbList = [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://sppupyq.vercel.app/"
    }
  ];

  if (year) {
    breadcrumbList.push({
      "@type": "ListItem",
      "position": 2,
      "name": `${formattedYear} Year`,
      "item": `https://sppupyq.vercel.app${getSeoUrl(year, null, null)}`
    });
  }

  if (branchSlug) {
    breadcrumbList.push({
      "@type": "ListItem",
      "position": 3,
      "name": formattedBranch,
      "item": `https://sppupyq.vercel.app${getSeoUrl(year, branchSlug, null)}`
    });
  }

  if (subjectSlug) {
    const pos = branchSlug ? 4 : 3;
    const urlPath = `https://sppupyq.vercel.app${getSeoUrl(year, branchSlug || 'FE', subjectSlug)}`;
    breadcrumbList.push({
      "@type": "ListItem",
      "position": pos,
      "name": formattedSubject,
      "item": urlPath
    });
  }

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumbList
  };

  // Construct FAQ Schema
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
      {
        "@type": "Question",
        "name": `How to download SPPU ${formattedSubject || formattedBranch || formattedYear + ' Year'} Previous Year Question Papers (PYQs)?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `You can download Savitribai Phule Pune University (SPPU) engineering previous year question papers (PYQs) for ${formattedSubject || formattedBranch || formattedYear + ' Year'} in PDF format for free on SYNAPSE. Simply browse the catalog to find In-Sem and End-Sem papers.`
        }
      },
      {
        "@type": "Question",
        "name": `Are ${formattedSubject || 'SPPU engineering'} papers updated for the 2024 Pattern?`,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": `Yes, we host the latest 2024 Pattern SPPU question papers for ${formattedSubject || 'all classes and branches'}, as well as legacy 2019 Pattern papers for comprehensive revision.`
        }
      }
    ]
  };

  // Query files from DB
  let files = [];
  try {
    const File = require('./models/File');
    const query = { contentType: 'regular' };
    if (year) query.year = year;
    if (branchSlug && branchSlug !== 'FE') query.branch = formattedBranch;
    if (subjectSlug) query.subject = formattedSubject;

    files = await File.find(query).sort({ uploadDate: -1 }).lean();
  } catch (dbErr) {
    console.error('Failed to fetch files for SEO container:', dbErr);
  }

  try {
    let html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');

    // Replace Meta Tags dynamically
    html = html.replace(/<title>[^<]+<\/title>/g, `<title>${title}</title>`);
    html = html.replace(/<meta name="title" content="[^"]+"/g, `<meta name="title" content="${title}"`);
    html = html.replace(/<meta name="description" content="[^"]+"/g, `<meta name="description" content="${description}"`);
    html = html.replace(/<meta property="og:title" content="[^"]+"/g, `<meta property="og:title" content="${title}"`);
    html = html.replace(/<meta property="og:description" content="[^"]+"/g, `<meta property="og:description" content="${description}"`);
    html = html.replace(/<meta property="twitter:title" content="[^"]+"/g, `<meta property="twitter:title" content="${title}"`);
    html = html.replace(/<meta property="twitter:description" content="[^"]+"/g, `<meta property="twitter:description" content="${description}"`);
    html = html.replace(/<link rel="canonical" href="[^"]+"/g, `<link rel="canonical" href="https://sppupyq.vercel.app${req.originalUrl}"`);

    // Inject Breadcrumb Schema & FAQ Schema
    const schemaScript = `
  <script type="application/ld+json">
  ${JSON.stringify(breadcrumbSchema, null, 2)}
  </script>
  <script type="application/ld+json">
  ${JSON.stringify(faqSchema, null, 2)}
  </script>
</head>`;
    html = html.replace('</head>', schemaScript);

    // Dynamic Hero Header replacement for SEO
    let mainHeading = formattedSubject 
      ? `SPPU ${formattedSubject} <span class="accent">PYQs</span>`
      : (formattedBranch 
          ? `SPPU ${formattedBranch} <span class="accent">PYQs</span>`
          : `SPPU ${formattedYear} Year <span class="accent">PYQs</span>`);
    
    if (isDsa) {
      mainHeading = `SPPU Data Structures and Algorithms (DSA) <span class="accent">PYQs</span>`;
    } else if (isDeld) {
      mainHeading = `SPPU Digital Electronics & Logic Design (DELD) <span class="accent">PYQs</span>`;
    } else if (isM2) {
      mainHeading = `SPPU Engineering Mathematics II (M2) <span class="accent">PYQs</span>`;
    }
    
    const mainSub = formattedSubject 
      ? `Download Savitribai Phule Pune University (SPPU) Insem and Endsem question papers for ${formattedSubject} (${formattedBranch || 'First Year'}).`
      : (formattedBranch 
          ? `Browse and download previous year question papers (PYQs) for SPPU ${formattedBranch} engineering students.`
          : `Access Savitribai Phule Pune University previous year question papers for ${formattedYear} Year engineering.`);

    html = html.replace('<h1>SPPU <span class="accent">PYQ</span> Portal</h1>', `<h1>${mainHeading}</h1>`);
    html = html.replace('<p class="hero-sub">The most organized archive of previous year question papers for Pune University students.</p>', `<p class="hero-sub">${mainSub}</p>`);

    // Build Year x Month table for DSA or standard listing
    let dsaTableHtml = '';
    if (isDsa && files.length > 0) {
      dsaTableHtml = `
      <div class="dsa-table-wrap" style="margin: 1.5rem 0; overflow-x: auto;">
        <h4 style="color: var(--accent); margin-bottom: 0.75rem; font-size: 1.1rem;">Available DSA Papers by Year &amp; Session (Real Database Papers)</h4>
        <table class="papers-table" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02);">
          <thead>
            <tr style="background: rgba(99,102,241,0.15); border-bottom: 1px solid rgba(255,255,255,0.1);">
              <th style="padding: 10px 14px; color: var(--accent);">Pattern</th>
              <th style="padding: 10px 14px; color: var(--accent);">Branch</th>
              <th style="padding: 10px 14px; color: var(--accent);">Exam Session / Year</th>
              <th style="padding: 10px 14px; color: var(--accent);">Official Paper Name</th>
              <th style="padding: 10px 14px; color: var(--accent); text-align: center;">Download</th>
            </tr>
          </thead>
          <tbody>
            ${files.map(f => {
              const pat = f.pattern === '2019' ? '2019 Pattern (legacy)' : '2024 Pattern';
              let session = 'Official Exam Paper';
              if (/dec.*2025/i.test(f.originalName)) session = 'Dec 2025 (Insem)';
              else if (/2025/i.test(f.originalName)) session = '2025 Session';
              else if (/2024/i.test(f.originalName)) session = '2024 Session';
              else if (/_(\d+)\.pdf/i.test(f.originalName)) session = `Exam Paper #${f.originalName.match(/_(\d+)\.pdf/i)[1]}`;
              return `
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 10px 14px;"><span style="color:#10b981; font-weight:600;">${pat}</span></td>
                <td style="padding: 10px 14px;">${f.branch || 'Computer Engineering'}</td>
                <td style="padding: 10px 14px;">${session}</td>
                <td style="padding: 10px 14px; font-family: monospace; font-size: 0.85rem;">${f.originalName || f.subject}</td>
                <td style="padding: 10px 14px; text-align: center;">
                  <a href="/api/download/${f._id}" style="color:var(--accent); font-weight:600; text-decoration:none;">⬇ Download PDF</a>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
    }

    // Inject dynamic HTML crawler content (rendered visibly)
    const listHtml = files.length > 0
      ? `<ul>\n      ${files.map(f => `
        <li>
          <a href="/api/download/${f._id}">${f.originalName || f.subject}</a>
          <span>Subject: ${f.subject} | Pattern: ${f.pattern} | Branch: ${f.branch || 'First Year'}</span>
        </li>`).join('\n      ')}\n    </ul>`
      : `<p>No papers uploaded yet for this catalog section. Check back soon!</p>`;

    const seoIntroText = subjectSlug 
      ? `Download Savitribai Phule Pune University (SPPU) Previous Year Question Papers (PYQs) for ${formattedSubject} (${formattedBranch || 'First Year'}). Access free PDF downloads for 2024 Pattern and 2019 Pattern Insem & Endsem exams.`
      : `Browse all Pune University (SPPU) Engineering Previous Year Question Papers for ${formattedBranch || formattedYear + ' Year'}. Download branch-wise question papers.`;

    const crawlerContent = `
  <div id="seo-crawler-content" class="seo-crawler-container">
    <h2>SPPU ${formattedSubject || formattedBranch || formattedYear + ' Year'} Previous Year Question Papers (PYQ)</h2>
    <h3>Savitribai Phule Pune University Exam Papers PDF Download</h3>
    <p>${seoIntroText}</p>
    ${dsaTableHtml}
    ${listHtml}
  </div>
`;
    html = html.replace('<div id="seo-crawler-content" class="seo-crawler-container"></div>', crawlerContent);

    // Inject dynamic SEO footer directory links
    const directoryHtml = await generateSeoDirectory();
    html = html.replace('<div id="seo-links-directory"></div>', directoryHtml);

    res.send(html);
  } catch (err) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// ── Catch-all Programmatic SEO Route ──────────────────────────────────────────
app.get('*', ensureDbConnected, async (req, res) => {
  try {
    const urlPath = req.path.substring(1).toLowerCase();
    const File = require('./models/File');
    
    // Programmatic SEO: Check if route matches striking-distance queries or engineering keywords
    if (urlPath && (
      urlPath.includes('sppu') || urlPath.includes('pyq') || urlPath.includes('pattern') || 
      urlPath.includes('engineering') || urlPath.includes('notes') || urlPath.includes('deld') || 
      urlPath.includes('dsa') || urlPath.includes('m2')
    )) {
      
      let html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
      
      let title = '';
      let description = '';
      let searchKeyword = '';
      let customHeading = '';
      let extraCrawlerHtml = '';

      // ── Task 1: CTR Fix for "sppu previous year question paper 2024 pattern"
      if (urlPath === 'sppu-previous-year-question-paper-2024-pattern') {
        title = 'SPPU Previous Year Question Paper 2024 Pattern | SYNAPSE';
        description = 'Download SPPU previous year question paper 2024 pattern PDFs for free. Insem and endsem papers for Computer, IT, Mechanical, Civil, and E&TC engineering.';
        searchKeyword = 'SPPU Previous Year Question Paper 2024 Pattern';
        customHeading = 'SPPU Previous Year Question Paper 2024 Pattern';
      }
      // ── Task 2: DSA Page ("sppu dsa question paper 2024 pattern")
      else if (urlPath.includes('dsa') || (urlPath.includes('data-structures') && urlPath.includes('2024'))) {
        title = 'Data Structures and Algorithms (DSA) – SPPU PYQ 2024 Pattern | SYNAPSE';
        description = 'Download SPPU Data Structures and Algorithms (DSA) question papers for 2024 Pattern in PDF format. Free Insem & Endsem previous year question papers with solutions.';
        searchKeyword = 'SPPU Data Structures and Algorithms (DSA) 2024 Pattern';
        customHeading = 'SPPU Data Structures and Algorithms (DSA) <span class="accent">PYQs</span>';

        const dsaFiles = await File.find({
          contentType: 'regular',
          $or: [
            { subject: /data structures/i },
            { originalName: /dsa|data structure/i }
          ]
        }).sort({ uploadDate: -1 }).lean();

        if (dsaFiles.length > 0) {
          extraCrawlerHtml = `
          <div class="dsa-table-wrap" style="margin: 1.5rem 0; overflow-x: auto;">
            <h4 style="color: var(--accent); margin-bottom: 0.75rem; font-size: 1.1rem;">Available DSA Papers by Year &amp; Session (Real Database Papers)</h4>
            <table class="papers-table" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02);">
              <thead>
                <tr style="background: rgba(99,102,241,0.15); border-bottom: 1px solid rgba(255,255,255,0.1);">
                  <th style="padding: 10px 14px; color: var(--accent);">Pattern</th>
                  <th style="padding: 10px 14px; color: var(--accent);">Branch</th>
                  <th style="padding: 10px 14px; color: var(--accent);">Exam Session / Year</th>
                  <th style="padding: 10px 14px; color: var(--accent);">Official Paper Name</th>
                  <th style="padding: 10px 14px; color: var(--accent); text-align: center;">Download</th>
                </tr>
              </thead>
              <tbody>
                ${dsaFiles.map(f => {
                  const pat = f.pattern === '2019' ? '2019 Pattern (legacy)' : '2024 Pattern';
                  let session = 'Official Exam Paper';
                  if (/dec.*2025/i.test(f.originalName)) session = 'Dec 2025 (Insem)';
                  else if (/2025/i.test(f.originalName)) session = '2025 Session';
                  else if (/2024/i.test(f.originalName)) session = '2024 Session';
                  else if (/_(\d+)\.pdf/i.test(f.originalName)) session = `Exam Paper #${f.originalName.match(/_(\d+)\.pdf/i)[1]}`;
                  return `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 10px 14px;"><span style="color:#10b981; font-weight:600;">${pat}</span></td>
                    <td style="padding: 10px 14px;">${f.branch || 'Computer Engineering'}</td>
                    <td style="padding: 10px 14px;">${session}</td>
                    <td style="padding: 10px 14px; font-family: monospace; font-size: 0.85rem;">${f.originalName || f.subject}</td>
                    <td style="padding: 10px 14px; text-align: center;">
                      <a href="/api/download/${f._id}" style="color:var(--accent); font-weight:600; text-decoration:none;">⬇ Download PDF</a>
                    </td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>`;
        }
      }
      // ── Task 3: DELD ("deld subject in engineering", "deld subject")
      else if (urlPath.includes('deld') || urlPath.includes('digital-electronics-and-logic-design')) {
        title = 'Digital Electronics & Logic Design (DELD) – SPPU PYQ 2024 Pattern | SYNAPSE';
        description = 'Download SPPU Digital Electronics & Logic Design (DELD) question papers for engineering students. Free Insem & Endsem 2024 pattern PYQ PDFs for Computer & AIML.';
        searchKeyword = 'Digital Electronics & Logic Design (DELD)';
        customHeading = 'SPPU Digital Electronics & Logic Design (DELD) <span class="accent">PYQs</span>';

        const deldFiles = await File.find({
          contentType: 'regular',
          $or: [
            { subject: /deld|digital electronics/i },
            { originalName: /deld|digital electronics/i }
          ]
        }).sort({ uploadDate: -1 }).lean();

        if (deldFiles.length > 0) {
          extraCrawlerHtml = `
          <div style="margin: 1.5rem 0;">
            <h4 style="color: var(--accent); margin-bottom: 0.75rem;">Official SPPU DELD Exam Papers:</h4>
            <ul>
              ${deldFiles.map(f => `
                <li>
                  <a href="/api/download/${f._id}">${f.originalName || f.subject}</a>
                  <span>Subject: ${f.subject} | Pattern: ${f.pattern || '2024'} | Branch: ${f.branch || 'Computer Engineering'}</span>
                </li>
              `).join('')}
            </ul>
          </div>`;
        }
      }
      // ── Task 3: M2 ("sppu m2 pyq", "m2 pyq")
      else if (urlPath.includes('m2') || urlPath.includes('engineering-mathematics-2') || urlPath.includes('engineering-mathematics-ii')) {
        title = 'Engineering Mathematics II (M2) – SPPU PYQ 2024 Pattern | SYNAPSE';
        description = 'Download SPPU Engineering Mathematics II (M2) previous year question papers (PYQs) for 2024 Pattern. Free Insem and Endsem FE PDF downloads on SYNAPSE.';
        searchKeyword = 'SPPU Engineering Mathematics II (M2)';
        customHeading = 'SPPU Engineering Mathematics II (M2) <span class="accent">PYQs</span>';

        const m2Files = await File.find({
          contentType: 'regular',
          year: 'first',
          $or: [
            { subject: /mathematics.*(?:ii|2)|m2/i },
            { originalName: /math.*2|m2/i }
          ]
        }).sort({ uploadDate: -1 }).lean();

        if (m2Files.length > 0) {
          extraCrawlerHtml = `
          <div style="margin: 1.5rem 0;">
            <h4 style="color: var(--accent); margin-bottom: 0.75rem;">Official SPPU Engineering Mathematics II (M2) Papers:</h4>
            <ul>
              ${m2Files.map(f => `
                <li>
                  <a href="/api/download/${f._id}">${f.originalName || f.subject}</a>
                  <span>Subject: ${f.subject} | Pattern: 2024 Pattern | First Year (FE)</span>
                </li>
              `).join('')}
            </ul>
          </div>`;
        }
      }
      // ── Phase 2: 2019 Pattern Backfill ("sppu question paper 2019 pattern")
      else if (urlPath === 'sppu-question-paper-2019-pattern' || (urlPath.includes('2019') && urlPath.includes('pattern') && !urlPath.includes('second') && !urlPath.includes('third'))) {
        title = 'SPPU Question Paper 2019 Pattern (legacy) — Engineering PYQ PDF | SYNAPSE';
        description = 'Download Savitribai Phule Pune University (SPPU) 2019 Pattern (legacy) question papers in PDF format. Over 470 real Insem & Endsem papers for all engineering branches.';
        searchKeyword = 'SPPU Question Paper 2019 Pattern (legacy)';
        customHeading = 'SPPU Question Paper 2019 Pattern <span class="accent">(legacy)</span>';

        const files2019 = await File.find({
          contentType: 'regular',
          pattern: '2019'
        }).sort({ branch: 1, subject: 1 }).limit(100).lean();

        extraCrawlerHtml = `
        <div style="margin: 1.5rem 0;">
          <h4 style="color: var(--accent); margin-bottom: 0.75rem;">Archived 2019 Pattern (legacy) Exam Papers:</h4>
          <p style="color: var(--text-secondary); font-size: 0.9rem;">Showing top verified 2019 pattern papers. All 471 legacy papers can also be accessed through the branch catalog.</p>
          <ul>
            ${files2019.map(f => `
              <li>
                <a href="/api/download/${f._id}">${f.originalName || f.subject}</a>
                <span>Subject: ${f.subject} | Branch: ${f.branch} | Pattern: 2019 Pattern (legacy)</span>
              </li>
            `).join('')}
          </ul>
        </div>`;
      }
      // ── Default programmatic keyword transformation
      else {
        searchKeyword = urlPath.replace(/-/g, ' ');
        searchKeyword = searchKeyword.split(' ').map(w => {
          if (w === 'sppu') return 'SPPU';
          if (w === 'pyq') return 'PYQ';
          if (w === 'pdf') return 'PDF';
          if (w === 'insem') return 'Insem';
          if (w === 'endsem') return 'Endsem';
          return w.charAt(0).toUpperCase() + w.slice(1);
        }).join(' ');

        title = `${searchKeyword} — Download PDF & Notes | SYNAPSE`;
        description = `Get the best resources for ${searchKeyword}. Download Savitribai Phule Pune University (SPPU) previous year question papers, notes, syllabus, and solutions in PDF format for 2019 and 2024 patterns.`;
      }

      // Replace Meta Tags dynamically
      html = html.replace(/<title>[^<]+<\/title>/g, `<title>${title}</title>`);
      html = html.replace(/<meta name="title" content="[^"]+"/g, `<meta name="title" content="${title}"`);
      html = html.replace(/<meta name="description" content="[^"]+"/g, `<meta name="description" content="${description}"`);
      html = html.replace(/<meta property="og:title" content="[^"]+"/g, `<meta property="og:title" content="${title}"`);
      html = html.replace(/<meta property="og:description" content="[^"]+"/g, `<meta property="og:description" content="${description}"`);
      html = html.replace(/<meta property="twitter:title" content="[^"]+"/g, `<meta property="twitter:title" content="${title}"`);
      html = html.replace(/<meta property="twitter:description" content="[^"]+"/g, `<meta property="twitter:description" content="${description}"`);
      html = html.replace(/<link rel="canonical" href="[^"]+"/g, `<link rel="canonical" href="https://sppupyq.vercel.app${req.originalUrl}"`);

      // Dynamic Hero Header replacement
      const headingToUse = customHeading || searchKeyword;
      html = html.replace('<h1>SPPU <span class="accent">PYQ</span> Portal</h1>', `<h1 style="font-size: clamp(2rem, 5vw, 3.8rem); font-family: 'DM Sans', sans-serif; letter-spacing: -0.03em; font-weight: 800; line-height: 1.1; background: linear-gradient(135deg, var(--text) 0%, var(--accent) 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; display: inline-block; padding-bottom: 0.1em; margin-bottom: 1rem; text-align: center;">${headingToUse}</h1>`);
      html = html.replace('<p class="hero-sub">The most organized archive of previous year question papers for Pune University students.</p>', `<p class="hero-sub">${description}</p>`);

      // Inject dynamic crawler text block (Mobile Optimized)
      const crawlerContent = `
  <div id="seo-crawler-content" class="seo-crawler-container" style="margin-top: clamp(2rem, 5vw, 3rem); background: rgba(255, 255, 255, 0.02); padding: clamp(1.2rem, 5vw, 2rem); border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); width: 100%; box-sizing: border-box;">
    <h2 style="color: var(--accent); margin-bottom: 1rem; font-size: clamp(1.3rem, 4vw, 1.8rem); line-height: 1.3;">${searchKeyword} Download Free</h2>
    <p style="color: var(--text-secondary); line-height: 1.6; margin-bottom: 1.5rem; font-size: clamp(0.9rem, 3vw, 1rem);">We provide the largest collection of SPPU resources. If you are looking for <strong>${searchKeyword}</strong>, you are at the right place. Access the best study materials, insem/endsem papers, syllabus patterns (2019/2024), and solutions exclusively on SYNAPSE.</p>
    ${extraCrawlerHtml}
    <div style="display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 1rem;">
      <a href="/#catalog" class="btn primary" style="display: flex; justify-content: center; align-items: center; text-align: center; flex: 1 1 auto; min-width: 200px;">Browse Full SPPU Catalog</a>
      <a href="/sppu-pyq-drive-2024-pattern" class="btn secondary" style="display: flex; justify-content: center; align-items: center; text-align: center; flex: 1 1 auto; min-width: 200px;">Complete 2024 PYQ Drive</a>
    </div>
  </div>
`;
      html = html.replace('<div id="seo-crawler-content" class="seo-crawler-container"></div>', crawlerContent);

      // Also inject directory links at bottom to ensure crawling continues deeply
      try {
        const directoryHtml = await generateSeoDirectory();
        html = html.replace('<div id="seo-links-directory"></div>', directoryHtml);
      } catch(e) {}

      return res.send(html);
    }

    // Default fallback for any other routes
    let fallbackHtml = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
    try {
      const directoryHtml = await generateSeoDirectory();
      fallbackHtml = fallbackHtml.replace('<div id="seo-links-directory"></div>', directoryHtml);
    } catch(e) {}
    return res.send(fallbackHtml);
  } catch (err) {
    console.error('Catch-all SEO generation error:', err);
    return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// ── Local dev server ──────────────────────────────────────────────────────────
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n🧠 SYNAPSE running at http://localhost:${PORT}`);
  });
}

// ── Export for Vercel serverless ──────────────────────────────────────────────
module.exports = app;
