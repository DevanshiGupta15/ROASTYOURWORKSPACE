// =========================================================================
// ROAST YOUR WORKSPACE — SERVER ENGINE
// Multi-Tenant Room Isolation, Ephemeral Feeds & Interactive Banter Backend
// =========================================================================

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { checkDecency } = require('./moderation');

// Optional dotenv loading if .env file exists
try {
  require('dotenv').config();
} catch (e) {
  // dotenv optional
}

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data', 'database.json');
const SEED_FILE = path.join(__dirname, 'data', 'seed.json');

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// -------------------------------------------------------------
// Database Persistence Layer (with Multi-Tenant Isolation)
// -------------------------------------------------------------
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
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving database:', err);
  }
}

let db = loadDatabase();

// Periodic 2-Hour Auto-TTL Whisper Cleanup
function purgeExpiredWhispers() {
  const now = new Date();
  if (Array.isArray(db.whispers)) {
    const beforeCount = db.whispers.length;
    db.whispers = db.whispers.filter(w => {
      if (!w.expires_at) return true; // Keep if no expiry set
      return new Date(w.expires_at) > now;
    });
    if (db.whispers.length !== beforeCount) {
      saveDatabase(db);
    }
  }
}
setInterval(purgeExpiredWhispers, 60 * 1000); // Check every minute

// -------------------------------------------------------------
// Multi-Tenancy & Room Isolation Helpers
// -------------------------------------------------------------
function extractDomain(email) {
  if (!email || !email.includes('@')) return null;
  return email.split('@')[1].toLowerCase().trim();
}

function isCompanyDomain(domain) {
  if (!domain) return false;
  const blocked = [
    'gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com',
    'icloud.com', 'protonmail.com', 'aol.com', 'zoho.com'
  ];
  if (blocked.includes(domain.toLowerCase())) return false;
  return domain.includes('.');
}

// Find organization by Code (e.g. 'SWIGGY-101') OR Domain (e.g. 'swiggy.in') OR ID ('org_swiggy')
function findOrg(codeOrDomainOrId) {
  if (!codeOrDomainOrId) return null;
  const query = codeOrDomainOrId.trim().toLowerCase();
  return db.organizations.find(o => 
    (o.id && o.id.toLowerCase() === query) ||
    (o.code && o.code.toLowerCase() === query) ||
    (o.domain && o.domain.toLowerCase() === query)
  ) || null;
}

// Ensure an organization exists, or provision a new isolated workspace room
function getOrCreateOrg(codeOrDomain) {
  let org = findOrg(codeOrDomain);
  if (org) return org;

  const raw = codeOrDomain.trim();
  const isDomainFormat = raw.includes('.');
  const domain = isDomainFormat ? raw.toLowerCase() : `${raw.toLowerCase().replace(/[^a-z0-9]/g, '')}.internal`;
  const code = isDomainFormat ? raw.split('.')[0].toUpperCase() + '-101' : raw.toUpperCase();
  const orgId = 'org_' + raw.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const orgName = (isDomainFormat ? raw.split('.')[0] : raw).toUpperCase() + ' Tech Arena';

  org = {
    id: orgId,
    code: code,
    name: orgName,
    domain: domain,
    tagline: 'Isolated Workspace Banter Arena',
    accentColor: '#FF5722',
    memberCount: 1
  };

  db.organizations.push(org);

  // Initialize a default Chai Tapri poll for this new organization
  if (!db.polls) db.polls = [];
  db.polls.push({
    id: `poll_${orgId}_1`,
    org_id: orgId,
    question: `What is the biggest office trope at ${org.name}?`,
    options: [
      { id: 'opt_1', text: 'Quick 2-minute sync extending to 1 hour', votes: 12 },
      { id: 'opt_2', text: 'Deploying Friday 5:58 PM without testing', votes: 18 },
      { id: 'opt_3', text: 'Staging database mysteriously wiped out', votes: 7 }
    ],
    total_votes: 37,
    user_votes: {}
  });

  saveDatabase(db);
  return org;
}

// Extract active org_id from request headers, query, or active session
function getRequestOrgId(req) {
  return (
    req.headers['x-org-id'] ||
    req.query.orgId ||
    req.query.org_id ||
    (req.body && (req.body.orgId || req.body.org_id)) ||
    db.userSettings.orgId ||
    'org_swiggy'
  );
}

// -------------------------------------------------------------
// REST API ENDPOINTS
// -------------------------------------------------------------

// 1. Organization Rooms Discovery & Active Room Info (Step 1)
app.get('/api/auth/rooms', (req, res) => {
  const currentOrg = db.organizations.find(o => o.id === db.userSettings.orgId) || db.organizations[0];
  res.json({
    activeRoom: currentOrg,
    rooms: db.organizations
  });
});

// 2. Multi-Tenant Join Room / Onboarding Gate (Step 1)
// Accepts: { orgCodeOrDomain, identifier (email or empId), alias }
app.post('/api/auth/join-room', (req, res) => {
  const { orgCodeOrDomain, identifier, alias } = req.body;

  if (!orgCodeOrDomain) {
    return res.status(400).json({ error: 'Organisation Code or Domain is required (e.g. SWIGGY-101 or swiggy.in).' });
  }

  // If user provided an email address as identifier, validate domain
  let email = null;
  let empId = null;
  if (identifier && identifier.includes('@')) {
    email = identifier.trim().toLowerCase();
    const domain = extractDomain(email);
    if (!isCompanyDomain(domain)) {
      return res.status(400).json({
        error: 'Personal email domains (@gmail.com, @yahoo.com) are prohibited. Please use official work credentials.'
      });
    }
  } else {
    empId = identifier ? identifier.trim() : `EMP-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  const org = getOrCreateOrg(orgCodeOrDomain);

  const formattedName = email 
    ? email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1)
    : `Colleague (${empId})`;

  const currentUser = {
    name: formattedName,
    empId: empId,
    email: email || `member@${org.domain}`,
    domain: org.domain,
    role: 'Team Member',
    alias: alias || `Anonymous Chai Lover #${Math.floor(100 + Math.random() * 900)}`,
    karma: 120,
    streak: 1,
    isPremium: false
  };

  db.userSettings.orgId = org.id;
  db.userSettings.currentUser = currentUser;
  saveDatabase(db);

  res.json({
    success: true,
    organization: org,
    user: currentUser,
    message: `Joined isolated room: ${org.name} (${org.code})`
  });
});

// 3. Domain Check / Verification Endpoint (Backward Compatibility)
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
  const org = getOrCreateOrg(domain);
  res.json({
    valid: true,
    domain: domain,
    organization: org,
    message: `Domain verified. Joining ${org.name}.`
  });
});

// 4. Auth Login / Claim Desk
app.post('/api/auth/login', (req, res) => {
  const { email, alias, orgCode } = req.body;
  const lookup = orgCode || (email && extractDomain(email));
  if (!lookup) {
    return res.status(400).json({ error: 'Email or Organisation Code required' });
  }

  const domain = email ? extractDomain(email) : null;
  if (domain && !isCompanyDomain(domain)) {
    return res.status(400).json({ error: 'Invalid enterprise domain' });
  }

  const org = getOrCreateOrg(lookup);
  const username = email ? email.split('@')[0] : 'Colleague';
  const formattedName = username.charAt(0).toUpperCase() + username.slice(1);

  const currentUser = {
    name: formattedName,
    email: email || `user@${org.domain}`,
    domain: org.domain,
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

// 5. Switch Room / Exit Workspace (Step 1)
app.post('/api/auth/switch-domain', (req, res) => {
  const { domain, code, orgId } = req.body;
  const target = orgId || code || domain;
  if (!target) {
    return res.status(400).json({ error: 'Room identifier is required' });
  }
  const org = getOrCreateOrg(target);
  db.userSettings.orgId = org.id;
  if (db.userSettings.currentUser) {
    db.userSettings.currentUser.domain = org.domain;
    db.userSettings.currentUser.email = `user@${org.domain}`;
  }
  saveDatabase(db);
  res.json({ success: true, organization: org, currentUser: db.userSettings.currentUser });
});

// 6. Get Current User & Organizations
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

// 7. Colleague Directory (Strict Multi-Tenant Isolation)
app.get('/api/directory', (req, res) => {
  const orgId = getRequestOrgId(req);
  const department = req.query.department;
  const search = (req.query.search || '').toLowerCase();

  let colleagues = (db.colleagues || []).filter(c => c.orgId === orgId || c.org_id === orgId);

  if (department && department !== 'All' && department !== 'All (48) 🔥') {
    colleagues = colleagues.filter(c => c.department.toLowerCase().includes(department.toLowerCase()));
  }

  if (search) {
    colleagues = colleagues.filter(c => 
      c.name.toLowerCase().includes(search) || 
      c.handle.toLowerCase().includes(search) || 
      (c.quirk && c.quirk.toLowerCase().includes(search)) ||
      (c.designation && c.designation.toLowerCase().includes(search))
    );
  }

  res.json(colleagues);
});

// 8. Colleague Profile & Dedicated Roasts
app.get('/api/directory/:id', (req, res) => {
  const orgId = getRequestOrgId(req);
  const colleague = (db.colleagues || []).find(c => c.id === req.params.id);
  if (!colleague) {
    return res.status(404).json({ error: 'Colleague not found' });
  }
  // Enforce isolation guard
  if ((colleague.orgId || colleague.org_id) !== orgId) {
    return res.status(403).json({ error: 'Access denied: Colleague belongs to another workspace room.' });
  }

  // Get roasts targeted at this colleague strictly within org
  const roasts = (db.posts || []).filter(p => 
    (p.orgId === orgId || p.org_id === orgId) &&
    (p.targetColleagueId === colleague.id || p.target_user_id === colleague.id) &&
    (p.reportCount || 0) < 3
  );

  res.json({ colleague, roasts });
});

// 9. Posts / Roasts Live Feed (Strict Tenant Query Guard + Author ID Stripping)
// Schema: id, org_id, author_alias, target_user_id, meme_template_id, top_text, bottom_text, karma_points, spiciness_level, created_at
app.get('/api/posts', (req, res) => {
  const orgId = getRequestOrgId(req);
  const filter = req.query.filter || 'all';

  // Strict domain and room row isolation
  let posts = (db.posts || []).filter(p => 
    (p.org_id === orgId || p.orgId === orgId) && 
    (p.reportCount || 0) < 3
  );

  if (filter === 'trending' || filter === 'spiciest') {
    posts = [...posts].sort((a, b) => {
      const aScore = (a.reactions?.roasts || 0) + (a.reactions?.masala || 0);
      const bScore = (b.reactions?.roasts || 0) + (b.reactions?.masala || 0);
      return bScore - aScore;
    });
  } else if (filter === 'memes') {
    posts = posts.filter(p => p.meme !== null || p.meme_template_id !== null);
  } else {
    // Latest first
    posts = [...posts].reverse();
  }

  // Author Token Stripping: Permanently strip identity metadata
  const sanitizedPosts = posts.map(p => {
    const { author_id, author_email, emp_id, ...safePost } = p;
    // Normalize both snake_case and camelCase for seamless client consumption
    return {
      ...safePost,
      id: safePost.id,
      org_id: safePost.org_id || safePost.orgId,
      orgId: safePost.org_id || safePost.orgId,
      author_alias: safePost.author_alias || safePost.maskedAuthor,
      maskedAuthor: safePost.author_alias || safePost.maskedAuthor,
      target_user_id: safePost.target_user_id || safePost.targetColleagueId,
      targetColleagueId: safePost.target_user_id || safePost.targetColleagueId,
      target_user_name: safePost.target_user_name || safePost.targetColleagueName,
      targetColleagueName: safePost.target_user_name || safePost.targetColleagueName,
      meme_template_id: safePost.meme_template_id || safePost.meme?.templateId,
      top_text: safePost.top_text || safePost.meme?.topText,
      bottom_text: safePost.bottom_text || safePost.meme?.bottomText,
      karma_points: safePost.karma_points || 15,
      spiciness_level: safePost.spiciness_level || 'bold',
      created_at: safePost.created_at || new Date().toISOString()
    };
  });

  res.json(sanitizedPosts);
});

// 10. Create Anonymous Roast / Post with Decency Engine Check (Step 2 & 3)
app.post('/api/posts', (req, res) => {
  const {
    targetColleagueId,
    target_user_id,
    targetColleagueName,
    target_user_name,
    roastSubject,
    content,
    meme,
    meme_template_id,
    top_text,
    bottom_text,
    tags,
    spiciness_level
  } = req.body;

  if (!content && !meme && !meme_template_id) {
    return res.status(400).json({ error: 'Roast content or meme template is required.' });
  }

  // Scan all submitted text against HR Decency Engine
  const textsToScan = [
    content,
    roastSubject,
    meme ? meme.topText : '',
    meme ? meme.bottomText : '',
    top_text,
    bottom_text
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

  const orgId = getRequestOrgId(req);
  const newPostId = 'post_' + Date.now();
  const targetId = target_user_id || targetColleagueId || null;
  const targetName = target_user_name || targetColleagueName || null;
  const templateId = meme_template_id || (meme ? meme.templateId : null);
  const topText = top_text || (meme ? meme.topText : '');
  const bottomText = bottom_text || (meme ? meme.bottomText : '');

  // Find meme template image if available
  let memePayload = meme;
  if (!memePayload && templateId) {
    const template = db.memes.find(m => m.id === templateId);
    if (template) {
      memePayload = {
        templateId: template.id,
        title: template.title,
        topText: topText,
        bottomText: bottomText,
        imageUrl: template.imageUrl
      };
    }
  }

  const newPost = {
    id: newPostId,
    org_id: orgId,
    orgId: orgId,
    author_alias: db.userSettings.currentUser.alias || 'Incognito Biryani #404',
    maskedAuthor: db.userSettings.currentUser.alias || 'Incognito Biryani #404',
    avatarIcon: memePayload ? '🎬' : '🌶️',
    created_at: new Date().toISOString(),
    timestamp: 'Just now',
    target_user_id: targetId,
    targetColleagueId: targetId,
    target_user_name: targetName,
    targetColleagueName: targetName,
    meme_template_id: templateId,
    top_text: topText,
    bottom_text: bottomText,
    karma_points: 15,
    spiciness_level: spiciness_level || 'bold',
    roastSubject: roastSubject || 'Workplace Banter',
    content: content || '',
    meme: memePayload || null,
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

  if (!db.posts) db.posts = [];
  db.posts.unshift(newPost);

  // Bump colleague roast count if targeted
  if (targetId) {
    const target = (db.colleagues || []).find(c => c.id === targetId);
    if (target) {
      target.roastCount = (target.roastCount || 0) + 1;
    }
  }

  // Increment user's roaster score
  if (db.userSettings.currentUser) {
    db.userSettings.currentUser.karma = (db.userSettings.currentUser.karma || 100) + 15;
  }

  saveDatabase(db);

  const { author_id, author_email, emp_id, ...safePost } = newPost;
  res.status(201).json({
    success: true,
    post: safePost,
    message: 'Roast posted anonymously and verified safe!'
  });
});

// 11. React to Post (Strict Isolation Guard)
app.post('/api/posts/:id/react', (req, res) => {
  const orgId = getRequestOrgId(req);
  const { type } = req.body;
  const post = (db.posts || []).find(p => p.id === req.params.id);
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  // Room Isolation Guard
  if ((post.org_id || post.orgId) !== orgId) {
    return res.status(403).json({ error: 'Room Isolation: Cannot react to posts from another workspace.' });
  }

  if (!post.reactions) {
    post.reactions = { roasts: 0, masala: 0, chai: 0, salty: 0 };
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

// 12. Comment on Post (Strict Isolation Guard + Decency Check)
app.post('/api/posts/:id/comment', (req, res) => {
  const orgId = getRequestOrgId(req);
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

  const post = (db.posts || []).find(p => p.id === req.params.id);
  if (!post) {
    return res.status(404).json({ error: 'Post not found' });
  }

  // Room Isolation Guard
  if ((post.org_id || post.orgId) !== orgId) {
    return res.status(403).json({ error: 'Room Isolation: Cannot comment on posts from another workspace.' });
  }

  const newComment = {
    author: db.userSettings.currentUser.name || 'Anonymous Chai Lover',
    handle: `@${(db.userSettings.currentUser.alias || 'anonymous').replace(/\s+/g, '_').toLowerCase()}`,
    text: text.trim(),
    created_at: new Date().toISOString()
  };

  post.comments = post.comments || [];
  post.comments.push(newComment);
  saveDatabase(db);

  res.status(201).json({ success: true, comment: newComment, comments: post.comments });
});

// 13. Report Post (Decency Guardrail)
app.post('/api/posts/:id/report', (req, res) => {
  const post = (db.posts || []).find(p => p.id === req.params.id);
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

// 14. Meme Datasets & Curated Indian Library
app.get('/api/memes', (req, res) => {
  const universe = req.query.universe;
  let memes = db.memes || [];

  if (universe && universe !== 'All' && universe !== 'All Memes (42)') {
    memes = memes.filter(m => m.universe.toLowerCase().includes(universe.toLowerCase()));
  }

  res.json(memes);
});

// 15. Chai-Sutta Whispers (Ephemeral Feed with 2-Hour Auto-TTL) (Step 2)
app.get('/api/whispers', (req, res) => {
  const orgId = getRequestOrgId(req);
  purgeExpiredWhispers();

  const now = new Date();
  const whispers = (db.whispers || [])
    .filter(w => (w.org_id === orgId || w.orgId === orgId))
    .filter(w => {
      if (!w.expires_at) return true;
      return new Date(w.expires_at) > now;
    })
    .map(w => {
      // Calculate remaining TTL minutes
      let minutesLeft = 120;
      if (w.expires_at) {
        minutesLeft = Math.max(0, Math.round((new Date(w.expires_at) - now) / 60000));
      }
      return {
        ...w,
        org_id: w.org_id || w.orgId,
        author_alias: w.author_alias || w.author,
        ttl_minutes_left: minutesLeft
      };
    });

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

  const orgId = getRequestOrgId(req);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2-Hour TTL

  const newWhisper = {
    id: 'whisp_' + Date.now(),
    org_id: orgId,
    orgId: orgId,
    author_alias: db.userSettings.privacy.fakeLocation ? 'Pantry Ghost' : (db.userSettings.currentUser.alias || 'Anonymous Colleague'),
    author: db.userSettings.privacy.fakeLocation ? 'Pantry Ghost' : (db.userSettings.currentUser.alias || 'Anonymous Colleague'),
    text: text.trim(),
    time: 'Just now',
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
    ttl_minutes_left: 120
  };

  if (!db.whispers) db.whispers = [];
  db.whispers.unshift(newWhisper);
  saveDatabase(db);

  res.status(201).json({ success: true, whisper: newWhisper });
});

// 16. Polls & Votes Backend (Chai Tapri Polls) (Step 2)
app.get('/api/polls', (req, res) => {
  const orgId = getRequestOrgId(req);
  if (!db.polls) db.polls = [];

  let poll = db.polls.find(p => p.org_id === orgId || p.orgId === orgId);
  if (!poll) {
    // Generate default poll for this org
    const org = db.organizations.find(o => o.id === orgId) || { name: 'Workspace' };
    poll = {
      id: `poll_${orgId}_1`,
      org_id: orgId,
      question: `Kaunsa Friday 6 PM deployment sabse bada disaster tha?`,
      options: [
        { id: 'opt_1', text: 'Payments Gateway 500 error', votes: 45 },
        { id: 'opt_2', text: 'Notification spam to 100k users', votes: 25 },
        { id: 'opt_3', text: 'Dropped table in staging', votes: 15 }
      ],
      total_votes: 85,
      user_votes: {}
    };
    db.polls.push(poll);
    saveDatabase(db);
  }

  // Calculate percentages
  const total = poll.total_votes || 1;
  const optionsWithPct = poll.options.map(opt => ({
    ...opt,
    pct: Math.round(((opt.votes || 0) / total) * 100)
  }));

  const userIdentifier = db.userSettings.currentUser.alias || 'user';
  const hasVoted = Boolean(poll.user_votes && poll.user_votes[userIdentifier]);

  res.json({
    id: poll.id,
    question: poll.question,
    options: optionsWithPct,
    total_votes: poll.total_votes,
    has_voted: hasVoted,
    user_choice: hasVoted ? poll.user_votes[userIdentifier] : null
  });
});

app.post('/api/polls/:id/vote', (req, res) => {
  const orgId = getRequestOrgId(req);
  const { option_id } = req.body;
  if (!option_id) {
    return res.status(400).json({ error: 'option_id is required' });
  }

  const poll = (db.polls || []).find(p => p.id === req.params.id);
  if (!poll) {
    return res.status(404).json({ error: 'Poll not found' });
  }

  // Room Isolation Guard
  if ((poll.org_id || poll.orgId) !== orgId) {
    return res.status(403).json({ error: 'Room Isolation: Cannot vote in polls from another workspace.' });
  }

  const option = poll.options.find(o => o.id === option_id);
  if (!option) {
    return res.status(400).json({ error: 'Invalid poll option' });
  }

  const userIdentifier = db.userSettings.currentUser.alias || 'user';
  if (!poll.user_votes) poll.user_votes = {};

  // If already voted, adjust vote counts
  const previousVote = poll.user_votes[userIdentifier];
  if (previousVote) {
    const prevOption = poll.options.find(o => o.id === previousVote);
    if (prevOption && prevOption.votes > 0) prevOption.votes--;
  } else {
    poll.total_votes = (poll.total_votes || 0) + 1;
  }

  option.votes = (option.votes || 0) + 1;
  poll.user_votes[userIdentifier] = option_id;

  saveDatabase(db);

  const total = poll.total_votes || 1;
  const optionsWithPct = poll.options.map(opt => ({
    ...opt,
    pct: Math.round(((opt.votes || 0) / total) * 100)
  }));

  res.json({
    success: true,
    options: optionsWithPct,
    total_votes: poll.total_votes,
    user_choice: option_id,
    message: 'Chai tapri vote cast successfully!'
  });
});

// 17. Dynamic Masala Hall of Fame Leaderboard (Step 2)
app.get('/api/leaderboard', (req, res) => {
  const orgId = getRequestOrgId(req);
  const orgColleagues = (db.colleagues || []).filter(c => (c.orgId === orgId || c.org_id === orgId));
  const orgPosts = (db.posts || []).filter(p => (p.org_id === orgId || p.orgId === orgId) && (p.reportCount || 0) < 3);

  // Compute dynamic stats per colleague based on actual posts & reactions
  const leaderboard = orgColleagues.map(colleague => {
    const roastsOnTarget = orgPosts.filter(p => 
      p.target_user_id === colleague.id || 
      p.targetColleagueId === colleague.id
    );

    const roastsReceived = roastsOnTarget.length || colleague.roastCount || 0;
    let totalReactions = 0;
    roastsOnTarget.forEach(p => {
      if (p.reactions) {
        totalReactions += (p.reactions.roasts || 0) + (p.reactions.masala || 0) + (p.reactions.chai || 0) + (p.reactions.salty || 0);
      }
    });

    const engagementScore = (roastsReceived * 10) + (totalReactions * 2);

    return {
      id: colleague.id,
      name: colleague.name,
      handle: colleague.handle,
      department: colleague.department,
      designation: colleague.designation,
      avatar: colleague.avatar,
      roastCount: roastsReceived,
      totalReactions: totalReactions,
      engagementScore: engagementScore,
      tags: colleague.tags || []
    };
  });

  // Sort descending by engagement score
  leaderboard.sort((a, b) => b.engagementScore - a.engagementScore);

  // Assign badges dynamically
  const badgeTitles = ['CircleBack King', '2-Min Sync Guru', 'Friday Prod Pusher', 'Staging Breaker', 'Chai Tapri Legend'];
  const trophies = ['🥇', '🥈', '🥉', '🎖️', '⭐'];

  const ranked = leaderboard.map((item, idx) => ({
    ...item,
    rank: idx + 1,
    trophy: trophies[idx] || '⭐',
    badge: badgeTitles[idx] || 'Masala Star'
  }));

  res.json({
    org_id: orgId,
    week: 'Week #38',
    leaderboard: ranked
  });
});

// 18. Settings & Privacy Controls (SCR-04 / Settings)
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

// 19. Decency Live Checker API
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
  console.log(`   Multi-Tenancy: Enabled (Room Isolation & Auto-TTL)`);
  console.log(`   Design System: Tadka & Chai (Stitch 2958853130171067856)`);
  console.log(`=======================================================`);
});
