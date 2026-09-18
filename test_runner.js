const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, body });
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting Roast Your Workspace Test Suite...\n');
  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
    }
  }

  // 1. Verify Personal Email Rejection
  try {
    const res1 = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/verify-domain',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'fakeuser@gmail.com' });
    assert(res1.status === 400 && res1.data.valid === false, 'Rejects personal gmail address');
  } catch (e) {
    assert(false, 'Verify personal email exception: ' + e.message);
  }

  // 2. Verify Corporate Domain Acceptance
  try {
    const res2 = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/verify-domain',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { email: 'developer@swiggy.in' });
    assert(res2.status === 200 && res2.data.valid === true && res2.data.domain === 'swiggy.in', 'Accepts corporate @swiggy.in domain');
  } catch (e) {
    assert(false, 'Verify corporate domain exception: ' + e.message);
  }

  // 3. Verify Author Token Stripping (FR-002)
  try {
    const res3 = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/posts?orgId=org_swiggy',
      method: 'GET'
    });
    const posts = res3.data;
    const hasAuthorTokens = posts.some(p => p.author_id !== undefined || p.author_email !== undefined);
    assert(!hasAuthorTokens && posts.length > 0, 'Author ID and identity metadata permanently stripped from public feed (FR-002)');
  } catch (e) {
    assert(false, 'Author stripping exception: ' + e.message);
  }

  // 4. Verify Decency Engine Intercept on Toxic Slurs (US-004, FR-004)
  try {
    const res4 = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/posts',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      content: 'You are an absolute chutiya and idiot!',
      targetColleagueName: 'Someone'
    });
    assert(res4.status === 422 && res4.data.error === 'DECENCY_INTERCEPT', 'Decency Engine halts post containing abusive language (HTTP 422)');
  } catch (e) {
    assert(false, 'Decency filter exception: ' + e.message);
  }

  // 5. Verify Successful Clean Banter Post
  let createdPostId = null;
  try {
    const res5 = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/posts',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      content: 'Quick 2-minute sync scheduled by PM at 5:58 PM Friday!',
      roastSubject: 'Friday Syncs',
      meme: {
        templateId: 'meme_circuit',
        title: 'Samajh Nahi Aaya',
        topText: 'FRIDAY 5:58 PM QUICK SYNC',
        bottomText: 'MEETING ENDED AT 7:15 PM'
      }
    });
    assert(res5.status === 201 && res5.data.success === true, 'Accepts clean workplace banter and creates post');
    createdPostId = res5.data.post.id;
  } catch (e) {
    assert(false, 'Clean banter post exception: ' + e.message);
  }

  // 6. Verify Post Reaction
  try {
    const res6 = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/posts/${createdPostId}/react`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { type: 'roasts' });
    assert(res6.status === 200 && res6.data.reactions.roasts >= 2, 'Increments roast reaction counter');
  } catch (e) {
    assert(false, 'Post reaction exception: ' + e.message);
  }

  // 7. Verify Multi-Tenant Domain Isolation (FR-001)
  try {
    const swiggyPosts = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/posts?orgId=org_swiggy',
      method: 'GET'
    });
    const zomatoPosts = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/posts?orgId=org_zomato',
      method: 'GET'
    });
    const swiggyHasCreated = swiggyPosts.data.some(p => p.id === createdPostId);
    const zomatoHasCreated = zomatoPosts.data.some(p => p.id === createdPostId);
    assert(swiggyHasCreated && !zomatoHasCreated, 'Multi-tenant isolation: posts in Swiggy are invisible to Zomato (FR-001)');
  } catch (e) {
    assert(false, 'Domain isolation exception: ' + e.message);
  }

  // 8. Verify Meme Library & Universes
  try {
    const res8 = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/memes',
      method: 'GET'
    });
    assert(res8.status === 200 && res8.data.length >= 7, 'Meme Khazana returns curated Indian templates');
  } catch (e) {
    assert(false, 'Meme library exception: ' + e.message);
  }

  console.log(`\n========================================`);
  console.log(`🎯 Test Results: ${passed}/${total} Passed (${Math.round((passed/total)*100)}%)`);
  console.log(`========================================\n`);

  process.exit(passed === total ? 0 : 1);
}

runTests();
