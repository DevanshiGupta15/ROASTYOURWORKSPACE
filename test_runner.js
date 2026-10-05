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

  // 3. Verify Organisation-Based Join Screen via Org Code (Step 1 Requirement)
  try {
    const res3 = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/join-room',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      orgCodeOrDomain: 'SWIGGY-101',
      identifier: 'SW-8891',
      alias: 'Panchayat Banrakas'
    });
    assert(res3.status === 200 && res3.data.organization.code === 'SWIGGY-101', 'Joins private room via Org Code (SWIGGY-101)');
  } catch (e) {
    assert(false, 'Join room exception: ' + e.message);
  }

  // 4. Verify Author Token Stripping (FR-002)
  try {
    const res4 = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/posts?orgId=org_swiggy',
      method: 'GET'
    });
    const posts = res4.data;
    const hasAuthorTokens = posts.some(p => p.author_id !== undefined || p.author_email !== undefined);
    assert(!hasAuthorTokens && posts.length > 0, 'Author ID and identity metadata permanently stripped from public feed (FR-002)');
  } catch (e) {
    assert(false, 'Author stripping exception: ' + e.message);
  }

  // 5. Verify Decency Engine Intercept on Toxic Slurs (US-004, FR-004)
  try {
    const res5 = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/posts',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, {
      content: 'You are an absolute chutiya and idiot!',
      targetColleagueName: 'Someone'
    });
    assert(res5.status === 422 && res5.data.error === 'DECENCY_INTERCEPT', 'Decency Engine halts post containing abusive language (HTTP 422)');
  } catch (e) {
    assert(false, 'Decency filter exception: ' + e.message);
  }

  // 6. Verify Successful Clean Banter Post Creation with Schema Tags (Step 2)
  let createdPostId = null;
  try {
    const res6 = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/posts',
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-org-id': 'org_swiggy'
      }
    }, {
      content: 'Quick 2-minute sync scheduled by PM at 5:58 PM Friday!',
      roastSubject: 'Friday Syncs',
      meme_template_id: 'meme_circuit',
      top_text: 'FRIDAY 5:58 PM QUICK SYNC',
      bottom_text: 'MEETING ENDED AT 7:15 PM',
      spiciness_level: 'bold'
    });
    assert(res6.status === 201 && res6.data.success === true, 'Accepts clean workplace banter and creates post');
    createdPostId = res6.data.post.id;
  } catch (e) {
    assert(false, 'Clean banter post exception: ' + e.message);
  }

  // 7. Verify Post Reaction
  try {
    const res7 = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/posts/${createdPostId}/react`,
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-org-id': 'org_swiggy'
      }
    }, { type: 'roasts' });
    assert(res7.status === 200 && res7.data.reactions.roasts >= 2, 'Increments roast reaction counter');
  } catch (e) {
    assert(false, 'Post reaction exception: ' + e.message);
  }

  // 8. Verify Room Isolation Guard on Reaction (Cross-Tenant Rejection)
  try {
    const res8 = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/posts/${createdPostId}/react`,
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-org-id': 'org_zomato'  // Cross-tenant attempt!
      }
    }, { type: 'roasts' });
    assert(res8.status === 403, 'Room Isolation Guard: Rejects cross-tenant reaction with HTTP 403 Forbidden');
  } catch (e) {
    assert(false, 'Room isolation reaction exception: ' + e.message);
  }

  // 9. Verify Multi-Tenant Domain/Room Isolation (Feed Partitioning)
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

  // 10. Verify Chai-Sutta Whispers (Ephemeral Feed with 2-Hour Auto-TTL) (Step 2)
  try {
    const whisperPost = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/whispers',
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-org-id': 'org_swiggy'
      }
    }, { text: 'Free samosas arriving at 4th floor pantry in 10 minutes!' });

    const whisperList = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/whispers?orgId=org_swiggy',
      method: 'GET'
    });

    const hasNewWhisper = whisperList.data.some(w => w.id === whisperPost.data.whisper.id);
    const hasTTL = whisperPost.data.whisper.expires_at !== undefined && whisperList.data[0].ttl_minutes_left !== undefined;
    assert(whisperPost.status === 201 && hasNewWhisper && hasTTL, 'Persists ephemeral whisper with 2-hour Auto-TTL countdown');
  } catch (e) {
    assert(false, 'Whisper TTL exception: ' + e.message);
  }

  // 11. Verify Chai Tapri Poll Vote Persistence (Step 2)
  try {
    const pollRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/polls?orgId=org_swiggy',
      method: 'GET'
    });

    const voteRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: `/api/polls/${pollRes.data.id}/vote`,
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-org-id': 'org_swiggy'
      }
    }, { option_id: 'opt_1' });

    assert(voteRes.status === 200 && voteRes.data.success === true && voteRes.data.total_votes >= 1, 'Persists Chai Tapri poll votes dynamically with percentage recalculation');
  } catch (e) {
    assert(false, 'Poll voting exception: ' + e.message);
  }

  // 12. Verify Dynamic Masala Hall of Fame Leaderboard (Step 2)
  try {
    const lbRes = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/leaderboard?orgId=org_swiggy',
      method: 'GET'
    });
    const lb = lbRes.data.leaderboard;
    const hasRanking = lb.length > 0 && lb[0].rank === 1 && lb[0].engagementScore !== undefined;
    assert(lbRes.status === 200 && hasRanking, 'Calculates Masala Hall of Fame dynamically from real engagement');
  } catch (e) {
    assert(false, 'Leaderboard exception: ' + e.message);
  }

  // 13. Verify Meme Library & Universes
  try {
    const res13 = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/memes',
      method: 'GET'
    });
    assert(res13.status === 200 && res13.data.length >= 7, 'Meme Khazana returns curated Indian templates');
  } catch (e) {
    assert(false, 'Meme library exception: ' + e.message);
  }

  console.log(`\n========================================`);
  console.log(`🎯 Test Results: ${passed}/${total} Passed (${Math.round((passed/total)*100)}%)`);
  console.log(`========================================\n`);

  process.exit(passed === total ? 0 : 1);
}

runTests();
