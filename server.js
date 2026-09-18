const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { checkDecency } = require('./moderation');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data', 'database.json');
const SEED_FILE = path.join(__dirname, 'data', 'seed.json');

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Initialize persistent database from seed if not exists
function loadDatabase() {
  if (!fs.existsSync(DB_FILE)) {
    const seedData = fs.readFileSync(SEED_FILE, 'utf-8');
    fs.writeFileSync(DB_FILE, seedData, 'utf-8');
    return JSON.parse(seedData);
  }
  try {
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    const seedData = fs.readFileSync(SEED_FILE, 'utf-8');
    fs.writeFileSync(DB_FILE, seedData, 'utf-8');
    return JSON.parse(seedData);
  }
}

function saveDatabase(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// Ensure database file is ready
let db = loadDatabase();

// Helper: Extract domain from email
function extractDomain(email) {
  if (!email || !email.includes('@')) return null;
  return email.split('@')[1].toLowerCase().trim();
}

// Helper: Check if domain is allowed
function isCompanyDomain(domain) {
  if (!domain) return false;
  const blockedPersonalDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'protonmail.com'];
  if (blockedPersonalDomains.includes(domain)) return false;
  return domain.includes('.');
}

// Helper: Get organization by domain
function getOrgByDomain(domain) {
  let org = db.organizations.find(o => o.domain === domain);
  if (!org) {
    // Dynamically instantiate an isolated workspace for newly verified corporate domain
    const orgId = 'org_' + domain.replace(/[^a-z0-9]/g, '_');
    org = {
      id: orgId,
      name: domain.split('.')[0].toUpperCase() + ' Workspace',
      domain: domain,
      tagline: 'Isolated Workspace Banter Arena',
      accentColor: '#FF5722',
      memberCount: 1
    };
    db.organizations.push(org);
    saveDatabase(db);
  }
  return org;
}

// -------------------------------------------------------------
// REST API Endpoints
// -------------------------------------------------------------

// 1. Domain Check / Verification Endpoint (US-001)
app.post('/api/auth/verify-domain', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email address is required.' });
  }
  const domain = extractDomain(email);
  if (!domain || !isCompanyDomain(domain)) {
    return res.status(400).json({
      valid: false,
      error: 'Personal email domains (@gmail.com, @yahoo.com) are prohibited. Please use your official corporate (@company.com) or university (@institute.edu.in) email to claim an isolated workspace.'
    });
  }
  const org = getOrgByDomain(domain);
  res.json({
    valid: true,
    domain: domain,
    organization: org,
    message: `Domain verified. Joining ${org.name}.`
  });
});

// 2. Auth Login / Claim Desk (SCR-01)
app.post('/api/auth/login', (req, res) => {
  const { email, alias } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  const domain = extractDomain(email);
  if (!isCompanyDomain(domain)) {
    return res.status(400).json({ error: 'Invalid enterprise domain' });
  }

  const org = getOrgByDomain(domain);
  const username = email.split('@')[0];
  const formattedName = username.charAt(0).toUpperCase() + username.slice(1);

  const currentUser = {
    name: formattedName,
    email: email,
    domain: domain,
    role: 'Team Member',
    alias: alias || `Anonymous Chai Pe Charcha #${Math.floor(100 + Math.random() * 900)}`,
    karma: 100,
    streak: 1,
    isPremium: false
  };

  db.userSettings.orgId = org.id;
  db.userSettings.currentUser = currentUser;
  saveDatabase(db);

  res.json({
    success: true,
    user: currentUser,
    organization: org
  });
});

// 3. Switch Domain (For testing multi-tenant isolation)
app.post('/api/auth/switch-domain', (req, res) => {
  const { domain } = req.body;
  if (!domain) {
    return res.status(400).json({ error: 'Domain is required' });
  }
  const org = getOrgByDomain(domain);
  db.userSettings.orgId = org.id;
  db.userSettings.currentUser.domain = domain;
  db.userSettings.currentUser.email = `user@${domain}`;
  saveDatabase(db);
  res.json({ success: true, organization: org, currentUser: db.userSettings.currentUser });
});

// 4. Get Current User & Organizations
app.get('/api/auth/me', (req, res) => {
  const currentOrg = db.organizations.find(o => o.id === db.userSettings.orgId) || db.organizations[0];
  res.json({
    currentUser: db.userSettings.currentUser,
    organization: currentOrg,
    availableOrgs: db.organizations,
    privacy: db.userSettings.privacy,
    contentFilter: db.userSettings.contentFilter
  });
});

// 5. Colleague Directory (SCR-02) - Domain Isolated (FR-001)
app.get('/api/directory', (req, res) => {
  const orgId = req.query.orgId || db.userSettings.orgId;
  const department = req.query.department;
  const search = (req.query.search || '').toLowerCase();

  let colleagues = db.colleagues.filter(c => c.orgId === orgId);

  if (department && department !== 'All' && department !== 'All (48) 🔥') {
    colleagues = colleagues.filter(c => c.department.toLowerCase().includes(department.toLowerCase()));
  }

  if (search) {
    colleagues = colleagues.filter(c => 
      c.name.toLowerCase().includes(search) || 
      c.handle.toLowerCase().includes(search) || 
      c.quirk.toLowerCase().includes(search) ||
      c.designation.toLowerCase().includes(search)
    );
  }

  res.json(colleagues);
});

// 6. Colleague Profile & Dedicated Roasts (SCR-03)
app.get('/api/directory/:id', (req, res) => {
  const colleague = db.colleagues.find(c => c.id === req.params.id);
  if (!colleague) {
    return res.status(404).json({ error: 'Colleague not found' });
  }
  // Get roasts specifically targeted at this colleague
  const roasts = db.posts.filter(p => p.targetColleagueId === colleague.id && p.reportCount < 3);
  res.json({
    colleague,
    roasts
  });
});

// 7. Posts / Gossip Feed (SCR-05 & Option 3) - Domain Isolated + Author ID Stripped (FR-001 & FR-002)
app.get('/api/posts', (req, res) => {
  const orgId = req.query.orgId || db.userSettings.orgId;
  const filter = req.query.filter || 'all';

  // Strict domain row isolation
  let posts = db.posts.filter(p => p.orgId === orgId && (p.reportCount || 0) < 3);

  if (filter === 'trending' || filter === 'spiciest') {
    posts = [...posts].sort((a, b) => ((b.reactions.roasts + b.reactions.masala) - (a.reactions.roasts + a.reactions.masala)));
  } else if (filter === 'memes') {
    posts = posts.filter(p => p.meme !== null);
  } else {
    // Latest first
    posts = [...posts].reverse();
  }

  // Author Token Stripping: Strip any author credentials or real identity unless unmask requested with premium
  const sanitizedPosts = posts.map(p => {
    const { author_id, author_email, ...safePost } = p;
    return safePost;
  });

  res.json(sanitizedPosts);
});

// 8. Create Anonymous Roast / Post with Decency Engine Check (US-003, US-004, FR-004)
app.post('/api/posts', (req, res) => {
  const {
    targetColleagueId,
    targetColleagueName,
    roastSubject,
    content,
    meme,
    tags
  } = req.body;

  if (!content && !meme) {
    return res.status(400).json({ error: 'Roast content or meme template is required.' });
  }

  // DECENCY ENGINE CHECK (PRD Section 18)
  const textsToScan = [
    content,
    roastSubject,
    meme ? meme.topText : '',
    meme ? meme.bottomText : ''
  ].filter(Boolean).join(' ');

  const decencyResult = checkDecency(textsToScan);
  if (!decencyResult.allowed) {
    return res.status(422).json({
      error: 'DECENCY_INTERCEPT',
      reason: decencyResult.reason,
      flaggedWords: decencyResult.flaggedWords,
      category: decencyResult.category
    });
  }

  const orgId = db.userSettings.orgId;
  const newPostId = 'post_' + Date.now();

  const newPost = {
    id: newPostId,
    orgId: orgId,
    maskedAuthor: db.userSettings.currentUser.alias || 'Incognito Biryani #404',
    avatarIcon: meme ? '🎬' : '🌶️',
    timestamp: 'Just now',
    targetColleagueId: targetColleagueId || null,
    targetColleagueName: targetColleagueName || null,
    roastSubject: roastSubject || 'Workplace Banter',
    content: content || '',
    meme: meme || null,
    tags: tags || ['WorkplaceRoast', 'HinglishBanter'],
    reactions: {
      roasts: 1,
      masala: 0,
      chai: 0,
      salty: 0
    },
    reportCount: 0,
    comments: []
  };

  db.posts.unshift(newPost);

  // If target colleague exists, bump their roast counter
  if (targetColleagueId) {
    const target = db.colleagues.find(c => c.id === targetColleagueId);
    if (target) {
      target.roastCount = (target.roastCount || 0) + 1;
    }
  }

  // Increment user's karma
  db.userSettings.currentUser.karma = (db.userSettings.currentUser.karma || 100) + 15;

  saveDatabase(db);

  // Return sanitized post
  const { author_id, author_email, ...safePost } = newPost;
  res.status(201).json({
    success: true,
    post: safePost,
    message: 'Roast posted anonymously and verified safe!'
  });
});

// 9. React to Post (🔥 Roasts, 😂 Masala, ☕ Chai, 🧂 Salty)
app.post('/api/posts/:id/react', (req, res) => {
  const { type } = req.body;
  const post = db.posts.find(p => p.id === req.params.id);
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  if (type === 'roasts' || type === 'fire') {
    post.reactions.roasts = (post.reactions.roasts || 0) + 1;
  } else if (type === 'masala' || type === 'laugh') {
    post.reactions.masala = (post.reactions.masala || 0) + 1;
  } else if (type === 'chai' || type === 'sip') {
    post.reactions.chai = (post.reactions.chai || 0) + 1;
  } else if (type === 'salty') {
    post.reactions.salty = (post.reactions.salty || 0) + 1;
  }

  saveDatabase(db);
  res.json({ success: true, reactions: post.reactions });
});

// 10. Comment on Post with Decency Check
app.post('/api/posts/:id/comment', (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Comment text required' });
  }

  const decencyResult = checkDecency(text);
  if (!decencyResult.allowed) {
    return res.status(422).json({
      error: 'DECENCY_INTERCEPT',
      reason: decencyResult.reason,
      flaggedWords: decencyResult.flaggedWords
    });
  }

  const post = db.posts.find(p => p.id === req.params.id);
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  const newComment = {
    author: db.userSettings.currentUser.name || 'Anonymous Chai Lover',
    handle: `@${db.userSettings.currentUser.alias.replace(/\s+/g, '_').toLowerCase()}`,
    text: text.trim()
  };

  post.comments = post.comments || [];
  post.comments.push(newComment);
  saveDatabase(db);

  res.status(201).json({ success: true, comment: newComment, comments: post.comments });
});

// 11. Report Post (Decency Guardrail - Auto quarantine on 3 flags)
app.post('/api/posts/:id/report', (req, res) => {
  const { reason } = req.body;
  const post = db.posts.find(p => p.id === req.params.id);
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  post.reportCount = (post.reportCount || 0) + 1;
  const quarantined = post.reportCount >= 3;

  saveDatabase(db);

  res.json({
    success: true,
    reportCount: post.reportCount,
    quarantined,
    message: quarantined
      ? 'Post has received 3 moderation flags and has been automatically quarantined from the feed.'
      : 'Thank you for keeping our workplace safe. Moderation team alerted.'
  });
});

// 12. Meme Datasets & Curated Indian Library (SCR-04)
app.get('/api/memes', (req, res) => {
  const universe = req.query.universe;
  let memes = db.memes;

  if (universe && universe !== 'All' && universe !== 'All Memes (42)') {
    memes = memes.filter(m => m.universe.toLowerCase().includes(universe.toLowerCase()));
  }

  res.json(memes);
});

// 13. Watercooler Whispers (Chai-Sutta Whispers)
app.get('/api/whispers', (req, res) => {
  const orgId = req.query.orgId || db.userSettings.orgId;
  const whispers = db.whispers.filter(w => w.orgId === orgId);
  res.json(whispers);
});

app.post('/api/whispers', (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Whisper text required' });
  }

  const decencyResult = checkDecency(text);
  if (!decencyResult.allowed) {
    return res.status(422).json({
      error: 'DECENCY_INTERCEPT',
      reason: decencyResult.reason,
      flaggedWords: decencyResult.flaggedWords
    });
  }

  const orgId = db.userSettings.orgId;
  const newWhisper = {
    id: 'whisp_' + Date.now(),
    orgId: orgId,
    author: db.userSettings.privacy.fakeLocation ? 'Pantry Ghost' : 'Anonymous Colleague',
    text: text.trim(),
    time: 'Just now'
  };

  db.whispers.unshift(newWhisper);
  saveDatabase(db);

  res.status(201).json({ success: true, whisper: newWhisper });
});

// 14. Settings & Privacy Controls (SCR-04 / Settings)
app.get('/api/settings', (req, res) => {
  res.json(db.userSettings);
});

app.put('/api/settings', (req, res) => {
  const { privacy, contentFilter, notifications, currentUser } = req.body;

  if (privacy) db.userSettings.privacy = { ...db.userSettings.privacy, ...privacy };
  if (contentFilter) db.userSettings.contentFilter = { ...db.userSettings.contentFilter, ...contentFilter };
  if (notifications) db.userSettings.notifications = { ...db.userSettings.notifications, ...notifications };
  if (currentUser) db.userSettings.currentUser = { ...db.userSettings.currentUser, ...currentUser };

  saveDatabase(db);
  res.json({ success: true, settings: db.userSettings });
});

// 15. Decency Live Checker API (for real-time input verification)
app.post('/api/decency/check', (req, res) => {
  const { text } = req.body;
  const result = checkDecency(text || '');
  res.json(result);
});

// Fallback all other routes to index.html for SPA client navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start listening
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🌶️  Roast Your Workspace Server listening on port ${PORT}`);
  console.log(`   URL: http://localhost:${PORT}`);
  console.log(`   Design System: Tadka & Chai (Stitch 2958853130171067856)`);
  console.log(`=======================================================`);
});
