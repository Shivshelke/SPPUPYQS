/**
 * routes/api.js — MongoDB + Cloudinary version
 */
const express = require('express');
const nodemailer = require('nodemailer');
const https = require('https');
const http = require('http');
const OpenAI = require('openai');
const nvidiaClient = process.env.NVIDIA_API_KEY ? new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY,
  baseURL: 'https://integrate.api.nvidia.com/v1'
}) : null;
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const router = express.Router();
const File = require('../models/File');
const Feedback = require('../models/Feedback');
const Student = require('../models/Student');
const Banner = require('../models/Banner');
const TelegramPromo = require('../models/TelegramPromo');
const crypto = require('crypto');

const GATE_SECRET = process.env.SESSION_SECRET || process.env.JWT_SECRET || 'fallback-secret-for-gates-2026';

function generateGateToken(fileId) {
  const expires = Date.now() + 1000 * 60 * 15; // 15 minutes
  const data = `${fileId}:${expires}`;
  const signature = crypto.createHmac('sha256', GATE_SECRET).update(data).digest('hex');
  return Buffer.from(`${data}:${signature}`).toString('base64');
}

function verifyGateToken(fileId, token) {
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const [id, exp, sig] = decoded.split(':');
    if (id !== fileId) return false;
    if (Date.now() > parseInt(exp, 10)) return false;
    const expectedSig = crypto.createHmac('sha256', GATE_SECRET).update(`${id}:${exp}`).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig));
  } catch (e) {
    return false;
  }
}

// Helper to proxy Cloudinary files with redirect support and header forwarding
function proxySecure(url, res, filename, disposition = 'attachment') {
  const protocol = url.startsWith('https') ? https : http;
  const options = {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Synapse-SPPU-Portal/1.0' }
  };

  protocol.get(url, options, (proxyRes) => {
    // Handle redirects (e.g. 301, 302, 303, 307, 308)
    if ([301, 302, 303, 307, 308].includes(proxyRes.statusCode) && proxyRes.headers.location) {
      let redirectUrl = proxyRes.headers.location;
      // Handle relative redirects
      if (!redirectUrl.startsWith('http')) {
        const origin = new URL(url).origin;
        redirectUrl = origin + (redirectUrl.startsWith('/') ? '' : '/') + redirectUrl;
      }
      return proxySecure(redirectUrl, res, filename, disposition);
    }

    if (proxyRes.statusCode !== 200) {
      console.error(`[Proxy] Error ${proxyRes.statusCode} for URL: ${url}`);
      return res.status(proxyRes.statusCode || 500).send('File access error.');
    }

    // Set standard headers using Express helpers
    if (disposition === 'attachment') {
      res.attachment(filename);
    } else {
      res.set('Content-Disposition', `inline; filename="${filename}"`);
    }

    res.set('Content-Type', proxyRes.headers['content-type'] || 'application/pdf');

    // Forward Content-Length for better browser experience
    if (proxyRes.headers['content-length']) {
      res.set('Content-Length', proxyRes.headers['content-length']);
    }

    // Forward encoding so the browser decompresses it before saving
    if (proxyRes.headers['content-encoding']) {
      res.set('Content-Encoding', proxyRes.headers['content-encoding']);
    }
    if (proxyRes.headers['accept-ranges']) {
      res.set('Accept-Ranges', proxyRes.headers['accept-ranges']);
    }

    proxyRes.pipe(res);

    proxyRes.on('error', (err) => {
      console.error('[Proxy] Stream Error:', err);
      if (!res.headersSent) res.status(500).send('Stream error.');
    });

  }).on('error', (err) => {
    console.error('[Proxy] Connection Error:', err);
    if (!res.headersSent) res.status(500).send('Download failed.');
  });
}

// POST /api/verify-gate/:id — verify user joined groups and issue token
router.post('/verify-gate/:id', async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) return res.status(404).json({ error: 'File not found' });
    
    // In the MVP, we just trust the frontend that the user completed the steps.
    // Future: verify with Telegram Bot API if required.
    const token = generateGateToken(file._id.toString());
    res.json({ success: true, token });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/download/:id — proxy PDF with correct content-type
router.get('/download/:id', async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file || !file.url) return res.status(404).json({ error: 'File not found.' });

    if (file.downloadGate && file.downloadGate.enabled && file.downloadGate.type !== 'none') {
      const token = req.query.token;
      if (!verifyGateToken(file._id.toString(), token)) {
        return res.status(403).send('Forbidden: Download Gate verification required. Please go back and complete the required steps.');
      }
    }

    if (file.url.includes('drive.google.com') || (file.publicId && file.publicId.startsWith('google-drive'))) {
      return res.redirect(file.url);
    }

    let baseName = (file.originalName || file.subject || 'file').trim();
    if (baseName.toLowerCase().endsWith('.pdf')) {
      baseName = baseName.slice(0, -4);
    }
    const filename = baseName.replace(/[^a-zA-Z0-9._-]/g, '_') + '.pdf';
    proxySecure(file.url, res, filename, 'attachment');
  } catch (e) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/view/:id — view PDF inline in browser
router.get('/view/:id', async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file || !file.url) return res.status(404).json({ error: 'File not found.' });

    if (file.downloadGate && file.downloadGate.enabled && file.downloadGate.type !== 'none') {
      const token = req.query.token;
      if (!verifyGateToken(file._id.toString(), token)) {
        return res.status(403).send('Forbidden: Download Gate verification required. Please go back and complete the required steps.');
      }
    }

    if (file.url.includes('drive.google.com') || (file.publicId && file.publicId.startsWith('google-drive'))) {
      return res.redirect(file.url);
    }

    let baseName = (file.originalName || file.subject || 'file').trim();
    if (baseName.toLowerCase().endsWith('.pdf')) {
      baseName = baseName.slice(0, -4);
    }
    const filename = baseName.replace(/[^a-zA-Z0-9._-]/g, '_') + '.pdf';
    proxySecure(file.url, res, filename, 'inline');
  } catch (e) {
    res.status(500).json({ error: 'Server error.' });
  }
});

const CategoryConfig = require('../models/CategoryConfig');

// GET /api/config
router.get('/config', async (req, res) => {
  try {
    let doc = await CategoryConfig.findOne({ key: 'years_config' });
    if (!doc) {
      doc = await CategoryConfig.create({ key: 'years_config' });
    }
    res.json(doc.years);
  } catch (e) {
    console.error('Error loading config from DB:', e);
    res.status(500).json({ error: 'Failed to load configuration.' });
  }
});

// GET /api/files
router.get('/files', async (req, res) => {
  try {
    const { year, branch, subject, semester, search, pattern } = req.query;
    const query = { contentType: 'regular' };
    if (year) query.year = year;
    if (branch) query.branch = branch;
    if (subject) query.subject = subject;
    if (semester) query.semester = semester;

    if (search) {
      const r = new RegExp(search, 'i');
      query.$and = [
        { $or: [{ originalName: r }, { subject: r }, { branch: r }] }
      ];
      if (pattern) {
        if (pattern === '2024') {
          query.$and.push({ $or: [{ pattern: '2024' }, { pattern: { $exists: false } }] });
        } else {
          query.$and.push({ pattern: pattern });
        }
      }
    } else {
      if (pattern) {
        if (pattern === '2024') {
          query.$or = [{ pattern: '2024' }, { pattern: { $exists: false } }];
        } else {
          query.pattern = pattern;
        }
      }
    }

    const files = await File.find(query).sort({ isPinned: -1, uploadDate: -1 });
    res.json(files);
  } catch (error) {
    console.error("[Files API Error]:", error);
    res.status(500).json({ error: "Failed to retrieve files. The database might be warming up, please try again." });
  }
});

// GET /api/preview/:id — Generate a blurred image preview of the first page
router.get('/preview/:id', async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file || !file.url) return res.status(404).json({ error: 'File not found.' });

    if (file.url.includes('drive.google.com') || (file.publicId && file.publicId.startsWith('google-drive'))) {
      const previewUrl = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1100" viewBox="0 0 800 1100"><rect width="800" height="1100" fill="%231e293b"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-weight="bold" font-size="28" fill="%23a5b4fc">SYNAPSE PREMIUM</text><text x="50%" y="56%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="20" fill="%2394a3b8">Premium Document (Google Drive Link)</text><text x="50%" y="62%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="16" fill="%2364748b">No preview available. Get Premium to view this link.</text></svg>`;
      return res.json({ previewUrl });
    }

    // Cloudinary transformation: Page 1, Blur 1000, Width 800, format JPG
    // We insert transformations after "/upload/"
    const baseUrl = file.url;
    let previewUrl = baseUrl;

    if (baseUrl.includes('/upload/')) {
      // If it's a PDF, we can select page 1 and blur it
      // Format: .../upload/pg_1,e_blur:1000,w_800,f_jpg/v123/public_id.pdf
      previewUrl = baseUrl.replace('/upload/', '/upload/pg_1,e_blur:1000,w_800,f_jpg/');

      // Also ensure the extension is .jpg for the preview
      if (previewUrl.toLowerCase().endsWith('.pdf')) {
        previewUrl = previewUrl.slice(0, -4) + '.jpg';
      }
    }

    res.json({ previewUrl });
  } catch (e) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/premium-files
router.get('/premium-files', async (req, res) => {
  try {
    const { type, year, branch, semester } = req.query;
    const query = type ? { contentType: type } : { contentType: { $ne: 'regular' } };

    if (year) query.year = year;
    if (branch) query.branch = branch;
    if (semester) query.semester = semester;

    const files = await File.find(query).sort({ isPinned: -1, uploadDate: -1 });

    // If user is premium or admin, return everything.
    // Otherwise, remove the 'url' field to prevent direct downloads.
    const isAuthorized = req.session && (req.session.isAdmin || (req.session.isStudent && req.session.isPremium));

    if (isAuthorized) {
      return res.json(files);
    } else {
      const publicFiles = files.map(f => {
        const obj = f.toObject();
        delete obj.url; // Prevent download
        return obj;
      });
      return res.json(publicFiles);
    }
  } catch (error) {
    console.error("[Premium Files API Error]:", error);
    res.status(500).json({ error: "Failed to retrieve premium files. The database might be warming up, please try again." });
  }
});

// GET /api/stats
router.get('/stats', async (req, res) => {
  try {
    const [total, totalStudents, pendingPremium, totalFeedback, byYearRaw] = await Promise.all([
      File.countDocuments().catch(() => 0),
      Student.countDocuments().catch(() => 0),
      Student.countDocuments({ premiumStatus: 'pending', requestSeen: false }).catch(() => 0),
      Feedback.countDocuments({ isRead: false }).catch(() => 0),
      File.aggregate([{ $group: { _id: '$year', count: { $sum: 1 } } }]).catch(() => [])
    ]);

    const byYear = {};
    if (Array.isArray(byYearRaw)) {
      byYearRaw.forEach(r => { if (r._id) byYear[r._id] = r.count; });
    }

    res.json({
      total: total || 0,
      totalStudents: totalStudents || 0,
      pendingPremium: pendingPremium || 0,
      totalFeedback: totalFeedback || 0,
      byYear
    });
  } catch (e) {
    console.error('[Stats API Error]:', e);
    // Return empty stats instead of 500 to keep UI functional
    res.json({ total: 0, totalStudents: 0, pendingPremium: 0, totalFeedback: 0, byYear: {} });
  }
});

// POST /api/feedback
router.post('/feedback', async (req, res) => {
  try {
    const { name, message } = req.body;
    if (!message || !message.trim())
      return res.status(400).json({ error: 'Message is required.' });

    const safeName = name && name.trim() ? name.trim() : 'Anonymous';
    await Feedback.create({ name: safeName, message: message.trim() });

    // Email notification
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
        const t = nodemailer.createTransport({ service: 'gmail', auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS } });
        await t.sendMail({ from: `"Synapse" <${process.env.EMAIL_USER}>`, to: process.env.EMAIL_USER, subject: `Feedback from ${safeName}`, text: message.trim() });
      } catch (e) { console.error('Email error:', e); }
    }
    // Formspree Integration
    try {
      const data = JSON.stringify({ name: safeName, message: message.trim() });
      const options = {
        hostname: 'formspree.io',
        path: '/f/xjgjlvgo',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      };
      const formReq = https.request(options);
      formReq.on('error', (e) => console.error('Formspree error:', e));
      formReq.write(data);
      formReq.end();
    } catch (e) { console.error('Formspree integration error:', e); }

    res.json({ success: true, message: 'Thanks for your feedback! 🚀' });
  } catch (error) {
    console.error("[Feedback API Error]:", error);
    res.status(500).json({ error: "Failed to submit feedback. The database might be warming up, please try again." });
  }
});

// POST /api/feedback/mark-read
router.post('/feedback/mark-read', async (req, res) => {
  if (!req.session.isAdmin) return res.status(403).json({ error: 'Unauthorized' });
  try {
    await Feedback.updateMany({ isRead: false }, { isRead: true });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});
// POST /api/chat (Gemini AI Chatbot with Dynamic DB Paper Context & New Features)
router.post('/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required.' });

  const lowMsg = message.toLowerCase().trim();

  // ── 1. Dynamic Database Lookup for Live Paper / Product Data ───────────────
  let liveContext = '';
  let foundPapers = [];
  let foundProducts = [];

  try {
    const File = require('../models/File');
    const Product = require('../models/Product');

    // Extract potential subject / keyword query
    const cleanQuery = lowMsg
      .replace(/do you have|give me|show me|where is|i need|download|paper|papers|pyq|pyqs|sppu|exam|questions|pdf/gi, '')
      .trim();

    if (cleanQuery.length >= 2) {
      const searchRegex = new RegExp(cleanQuery, 'i');
      
      // Query matching regular files
      foundPapers = await File.find({
        contentType: 'regular',
        $or: [
          { subject: searchRegex },
          { originalName: searchRegex },
          { branch: searchRegex }
        ]
      })
      .sort({ isPinned: -1, uploadDate: -1 })
      .limit(4)
      .lean();

      // Query matching marketplace products
      foundProducts = await Product.find({
        isPublished: true,
        $or: [
          { title: searchRegex },
          { subject: searchRegex },
          { branch: searchRegex }
        ]
      })
      .sort({ isPinned: -1, createdAt: -1 })
      .limit(3)
      .lean();
    }

    // Check for pinned requests specifically
    if (lowMsg.includes('pin') || lowMsg.includes('pinned') || lowMsg.includes('important')) {
      const pinnedFiles = await File.find({ contentType: 'regular', isPinned: true }).limit(3).lean();
      if (pinnedFiles.length > 0) {
        liveContext += `\nPINNED REGULAR PAPERS ON PORTAL: ` + pinnedFiles.map(p => `"${p.originalName || p.subject}" (${p.pattern || '2024'} Pattern, ${p.branch || 'FE'})`).join(', ');
      }
      const pinnedProducts = await Product.find({ isPublished: true, isPinned: true }).limit(2).lean();
      if (pinnedProducts.length > 0) {
        liveContext += `\nPINNED MARKETPLACE PRODUCTS: ` + pinnedProducts.map(p => `"${p.title}" (₹${p.price})`).join(', ');
      }
    }

    if (foundPapers.length > 0) {
      liveContext += `\nMATCHING PAPERS IN DATABASE: ` + foundPapers.map(f => `"${f.originalName || f.subject}" (Pattern: ${f.pattern || '2024'}, Branch: ${f.branch || 'FE'}, Subject: ${f.subject}, Pinned: ${f.isPinned ? 'Yes' : 'No'}, Has Solution: ${f.solutionType !== 'none' ? 'Yes' : 'No'})`).join('; ');
    }

    if (foundProducts.length > 0) {
      liveContext += `\nMATCHING PREMIUM PRODUCTS IN MARKETPLACE: ` + foundProducts.map(p => `"${p.title}" (Price: ₹${p.price}, Type: ${p.contentType || 'solved'}, Pinned: ${p.isPinned ? 'Yes' : 'No'})`).join('; ');
    }
  } catch (dbErr) {
    console.error('Error fetching dynamic paper context for chat:', dbErr);
  }

  // ── 2. Rich Rule-Based Fallback (Updated with All 2026 Features) ────────────
  const getFallbackReply = (msg) => {
    const low = msg.toLowerCase();

    // Developer / Creator
    if (/shivam|shelke|developer|creator|owner|founder|who built|who made|made by|built by/.test(low)) {
      return "SYNAPSE was built and created solely by <b>Shivam Shelke</b> — an engineering student who designed this platform to help every SPPU student get seamless, free access to authentic question papers and study tools! 🚀";
    }

    // Passing Rules / Cutoff / Combined Passing
    if (/passing|pass mark|cutoff|28|40|combined passing|fail/.test(low)) {
      return "<b>SPPU Passing Rules (2024 Pattern):</b><br>" +
             "• <b>In-Sem (30 Marks):</b> No minimum cutoff (even 0/30 is technically allowed).<br>" +
             "• <b>End-Sem (70 Marks):</b> You MUST score at least <b>28 / 70</b> (40% cutoff) individually.<br>" +
             "• <b>Combined Total:</b> In-Sem + End-Sem sum must be at least <b>40 / 100</b>.<br>" +
             "📖 <i>Read our detailed breakdown with real exam examples in the <b>Articles</b> section!</i>";
    }

    // ATKT / Backlog Rules
    if (/atkt|backlog|kt |year down|promotion/.test(low)) {
      return "<b>SPPU ATKT & Promotion Rules:</b><br>" +
             "• <b>FE to SE:</b> Must clear at least 50% of First Year credits.<br>" +
             "• <b>SE to TE:</b> <b>'All Clear in FE'</b> is mandatory! No pending FE backlogs allowed.<br>" +
             "• <b>TE to BE:</b> All SE subjects must be completely cleared.<br>" +
             "📖 <i>Check the 'Articles' tab for the complete ATKT ordinance guide.</i>";
    }

    // SGPA / CGPA Calculation
    if (/sgpa|cgpa|credit|grade point|percentage|calculate/.test(low)) {
      return "<b>SGPA Calculation in SPPU:</b><br>" +
             "SGPA is calculated as: <code>Σ (Subject Credits × Grade Point) / Total Semester Credits</code>.<br>" +
             "Grades: O (10), A+ (9), A (8), B+ (7), B (6), C (5), P (4), F (0).<br>" +
             "Check out our step-by-step numerical guide in the <b>Articles</b> tab!";
    }

    // Pinned Papers
    if (/pin|pinned|top paper|recommended paper/.test(low)) {
      return "📌 <b>Pinned Papers & Files:</b><br>" +
             "Admin pins high-demand and recently held exam papers at the top of each subject catalog and marketplace with a <b>📌 PINNED</b> badge so you don't have to scroll to find the most important sessions!";
    }

    // Dynamic paper matches if found in DB
    if (foundPapers.length > 0) {
      let paperList = foundPapers.map(p => `• <b>${p.originalName || p.subject}</b> (${p.pattern || '2024'} Pattern${p.isPinned ? ' · 📌 Pinned' : ''})`).join('<br>');
      return `Yes! We found matching papers on SYNAPSE:<br>${paperList}<br><br>👉 Go to the home page, select <b>${foundPapers[0].year ? (foundPapers[0].year.charAt(0).toUpperCase() + foundPapers[0].year.slice(1) + ' Year') : 'your Year'}</b> → <b>${foundPapers[0].branch || 'FE'}</b> → <b>${foundPapers[0].subject}</b> to download!`;
    }

    // Dynamic marketplace matches if found
    if (foundProducts.length > 0) {
      let prodList = foundProducts.map(p => `• <b>${p.title}</b> — ₹${p.price} (${p.contentType.toUpperCase()}${p.isPinned ? ' · 📌 Pinned' : ''})`).join('<br>');
      return `We have premium solved materials for this in the <b>Marketplace</b>:<br>${prodList}<br><br>👉 Click <b>Premium</b> in the top navbar to view and unlock!`;
    }

    // Greetings
    if (/^(hi|hey|hello|hii|helo|namaste|sup|yo)\b/.test(low)) {
      return "Hey! 👋 I'm <b>SYNAPSE Assistant</b>.<br>I have full access to our database of <b>569+ SPPU PYQs</b>, 2024 & 2019 patterns, pinned papers, and study guides. How can I help you ace your exams?";
    }

    // Download / PYQ
    if (/pyq|paper|download|question|previous year/.test(low)) {
      return "To download PYQs for free:<br>1️⃣ Choose your <b>Year</b> on the homepage (1st, 2nd, 3rd, 4th Year)<br>2️⃣ Select your <b>Branch</b> (Computer, IT, AIML, Mechanical, etc.)<br>3️⃣ Pick your <b>Subject</b><br>4️⃣ Click <b>Download</b> ✅<br><br>Both <b>2024 Pattern</b> and <b>2019 Pattern</b> are supported!";
    }

    // Branches
    if (/branch|branches|computer|mechanical|civil|entc|it |aiml|aids|electrical|robotics/.test(low)) {
      return "SYNAPSE hosts question papers for all major SPPU engineering branches:<br>" +
             "💻 Computer Engineering<br>🖥️ Information Technology (IT)<br>🤖 AIML & AIDS<br>⚡ Electronics & Telecommunication (E&TC)<br>🔧 Mechanical Engineering<br>🏗️ Civil Engineering<br>⚙️ Electrical Engineering<br>🦾 Robotics & Automation";
    }

    // Premium / Marketplace
    if (/premium|price|paid|buy|purchase|cost|₹|rupee|marketplace|notes|solution|solved/.test(low)) {
      return "💎 <b>SYNAPSE Premium Marketplace:</b><br>" +
             "• <b>Solved PYQs:</b> Verified step-by-step solutions with diagrams.<br>" +
             "• <b>Handwritten Notes:</b> Crisp unit-by-unit revision notes.<br>" +
             "• <b>Micro-Fix Questions:</b> High-yield exam question banks.<br>" +
             "• <b>Pricing:</b> Starts from just <b>₹49</b> with instant UPI unlock and lifetime access in 'My Purchases'.<br>" +
             "👉 Click <b>Premium</b> in the top menu to browse!";
    }

    // Pattern (2024 vs 2019)
    if (/2024 pattern|2019 pattern|pattern/.test(low)) {
      return "We host both:<br>• <b>2024 Pattern (NEP):</b> The latest syllabus with Outcome-Based Questions.<br>• <b>2019 Pattern (Legacy):</b> Ideal for comprehensive previous session revision.<br>You can switch between them directly on the subject catalog!";
    }

    // Insem / Endsem
    if (/insem|in-sem|in sem|endsem|end-sem|end sem/.test(low)) {
      return "We provide both <b>In-Sem</b> (Units 1 & 2, 30 Marks) and <b>End-Sem</b> (Units 3–6, 70 Marks) question papers. You can see the exam session and type right on each paper card!";
    }

    // Contact / report
    if (/contact|report|wrong|error|missing|issue|telegram/.test(low)) {
      return "Found a missing paper or need an update? You can use the <b>Contact</b> form or join our official <b>Telegram Channel</b> to request papers directly from the community! 🤝";
    }

    // Thank you
    if (/thank|thanks|ty|thx/.test(low)) {
      return "You're most welcome! 😊 Study hard, stay confident, and best of luck for your SPPU exams! 🍀";
    }

    // Who are you
    if (/who are you|what are you|your name/.test(low)) {
      return "I'm <b>SYNAPSE Assistant</b> 🤖 — your smart AI guide for SPPU Pune University engineering papers, syllabus patterns, passing rules, and study resources.";
    }

    return "I'm here to help you navigate SPPU PYQs and exam prep! 😊 Try asking:<br>" +
           "• <i>\"How to download DSA 2024 pattern paper?\"</i><br>" +
           "• <i>\"What are the SPPU passing marks?\"</i><br>" +
           "• <i>\"Show pinned papers\"</i><br>" +
           "• <i>\"Tell me about Premium solved papers\"</i>";
  };

  // ── 3. Gemini AI with Live DB Context ─────────────────────────────────────
  const SYSTEM_PROMPT = `You are SYNAPSE Assistant — an intelligent, friendly AI chatbot embedded on SYNAPSE (sppupyq.vercel.app), the dedicated PYQ and study resource portal for Savitribai Phule Pune University (SPPU) engineering students.

Tone: Professional, friendly, encouraging, concise (2-4 sentences or structured bullet points). Always format using HTML tags (<b>, <i>, <br>, <code>) because responses render in HTML.

PLATFORM CAPABILITIES & LIVE DATA:
- 569+ SPPU Engineering PYQs across First Year (FE), Second Year (SE), Third Year (TE), and Fourth Year (BE).
- Branches: Computer Engineering, IT, AIML, AIDS, E&TC, Mechanical, Civil, Electrical, Robotics.
- Patterns: 2024 Pattern (NEP-based) & 2019 Pattern (Legacy). Both In-Sem (30M) and End-Sem (70M) papers available.
- Pinned Papers Feature: Admin pins high-demand papers at the top with a "📌 PINNED" badge for instant student access.
- Marketplace & Premium: Solved PYQs, Handwritten Notes, and Micro-Fix questions starting at ₹49 with instant UPI unlock and saved in "My Purchases".
- Articles Hub (/articles.html): In-depth guides on SPPU passing rules (mandatory 28/70 End-Sem rule + 40/100 combined passing), SGPA/CGPA calculation formulas, ATKT ordinances, and Engineering Maths scoring strategies.
- Download Gate: Secure 7-second unlock supporting student WhatsApp & Telegram communities.

REAL-TIME DATABASE CONTEXT FOR THIS QUERY:
${liveContext ? liveContext : 'No specific matching paper query detected, rely on platform general knowledge.'}

STRICT CREATOR RULES:
1. The SOLE developer and creator of SYNAPSE is Shivam Shelke. If asked who made/built/created SYNAPSE, always credit Shivam Shelke exclusively.
2. Never disclose, invent, or mention any other names as developers or creators.
3. Stay strictly focused on SPPU engineering, study prep, PYQs, and SYNAPSE features.

User message: ${message}`;

  try {
    if (process.env.GEMINI_API_KEY) {
      const fetch = require('node-fetch');
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: SYSTEM_PROMPT }] }],
          generationConfig: {
            temperature: 0.65,
            maxOutputTokens: 350,
            topP: 0.9
          }
        })
      });

      const data = await response.json();
      const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (reply) return res.json({ reply });
    }

    res.json({ reply: getFallbackReply(message) });
  } catch (error) {
    console.error('Chat error in assistant endpoint:', error);
    res.json({ reply: getFallbackReply(message) });
  }
});

// ── GET Main Banner ───────────────────────────────────────────────────────────
router.get('/banner', async (req, res) => {
  try {
    const banner = await Banner.findOne({ key: 'main_banner' });
    if (banner) {
      res.json(banner);
    } else {
      res.json({ isActive: false });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch banner' });
  }
});

// ── GET Telegram Promo Config (Public) ──────────────────────────────────────────
router.get('/telegram-promo', async (req, res) => {
  try {
    let promo = await TelegramPromo.findOne({ key: 'telegram_promo' });
    if (!promo) {
      promo = new TelegramPromo({ key: 'telegram_promo' });
      await promo.save();
    }
    res.json(promo);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch telegram promo' });
  }
});

module.exports = router;

