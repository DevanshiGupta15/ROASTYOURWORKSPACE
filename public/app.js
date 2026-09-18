// Roast Your Workspace - Interactive Application Logic (Tadka & Chai Theme)

const state = {
  activeTab: 'feed',
  activeDomain: 'swiggy.in',
  currentUser: {
    name: 'Rohan S.',
    alias: 'Anonymous Chai Lover #504',
    email: 'rohan@swiggy.in',
    domain: 'swiggy.in',
    role: 'DevOps Lead',
    karma: 1420,
    streak: 9
  },
  organization: {
    id: 'org_swiggy',
    name: 'Swiggy Workspace',
    domain: 'swiggy.in'
  },
  colleagues: [],
  posts: [],
  memes: [],
  whispers: [],
  selectedStudioMeme: null,
  activeColleague: null,
  modalAttachedMeme: null,
  reportingPostId: null,
  quickDeptFilter: 'All',
  dirDeptFilter: 'All',
  khazanaUniverse: 'All',
  feedFilter: 'all',
  settings: {
    privacy: {
      hideFromManagers: true,
      fakeLocation: true,
      unmaskMode: false
    },
    contentFilter: {
      spicinessLevel: 'bold'
    }
  }
};

const FUN_DESI_ALIASES = [
  'Anonymous Chai Lover #504',
  'SamosaBandit_404',
  'Sachiv Ji IRL',
  'Panchayat Banrakas',
  'Jira Ghost (#RESOLVED)',
  'FridayProdPusher',
  'CoffeeMachineSurvivor',
  'Circuit Whisperer',
  'Babu Bhaiya Ka Account',
  'Kadhai Paneer Architect',
  'Sync Queen PM #2',
  'Two-Minute-Quick-Call'
];

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  await fetchInitialData();
  setupEventListeners();
  navigateTo('feed');
}

// -------------------------------------------------------------
// Data Fetching & API Communication
// -------------------------------------------------------------
async function fetchInitialData() {
  try {
    const [meRes, dirRes, postsRes, memesRes, whispersRes] = await Promise.all([
      fetch('/api/auth/me'),
      fetch(`/api/directory?orgId=${state.organization.id}`),
      fetch(`/api/posts?orgId=${state.organization.id}&filter=${state.feedFilter}`),
      fetch('/api/memes'),
      fetch(`/api/whispers?orgId=${state.organization.id}`)
    ]);

    const meData = await meRes.json();
    if (meData.currentUser) state.currentUser = meData.currentUser;
    if (meData.organization) state.organization = meData.organization;
    if (meData.privacy) state.settings.privacy = meData.privacy;
    if (meData.contentFilter) state.settings.contentFilter = meData.contentFilter;

    state.activeDomain = state.organization.domain;
    state.colleagues = await dirRes.json();
    state.posts = await postsRes.json();
    state.memes = await memesRes.json();
    state.whispers = await whispersRes.json();

    // Select first meme as default studio meme
    if (state.memes.length > 0) {
      state.selectedStudioMeme = state.memes[0];
    }

    updateHeaderUI();
    renderAllViews();
  } catch (err) {
    console.error('Failed to load initial data:', err);
    showToast('Offline Mode', 'Loaded in local state mode.', '⚠️');
  }
}

function updateHeaderUI() {
  document.getElementById('active-domain-pill').textContent = `@${state.activeDomain}`;
  document.getElementById('canvas-domain-stamp').textContent = `Verified @${state.activeDomain}`;
  document.getElementById('whispers-domain-label').textContent = `@${state.activeDomain}`;
  document.getElementById('header-user-name').textContent = state.currentUser.name;
  document.getElementById('streak-counter').textContent = `${state.currentUser.streak || 9} Days Streak`;
  document.getElementById('studio-alias-badge').textContent = state.currentUser.alias;
  
  const settingsInput = document.getElementById('settings-alias-input');
  if (settingsInput) settingsInput.value = state.currentUser.alias;
}

// -------------------------------------------------------------
// View Routing & Navigation
// -------------------------------------------------------------
function navigateTo(tabName) {
  state.activeTab = tabName;

  // Hide all view panels
  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.classList.add('hidden');
  });

  // Show target panel
  const targetPanel = document.getElementById(`view-${tabName}`);
  if (targetPanel) {
    targetPanel.classList.remove('hidden');
  }

  // Update Nav buttons styling
  ['feed', 'directory', 'memes', 'settings'].forEach(tab => {
    const btn = document.getElementById(`nav-${tab}`);
    if (btn) {
      if (tab === tabName) {
        btn.classList.add('bg-surface-elevated', 'text-white', 'shadow-sm');
        btn.classList.remove('text-slate-300', 'hover:bg-slate-800');
      } else {
        btn.classList.remove('bg-surface-elevated', 'text-white', 'shadow-sm');
        btn.classList.add('text-slate-300', 'hover:bg-slate-800');
      }
    }
  });

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// -------------------------------------------------------------
// Rendering Functions
// -------------------------------------------------------------
function renderAllViews() {
  renderTargetBoard();
  renderStudioTemplates();
  renderColleagueSelectDropdown();
  renderFeed();
  renderWhispers();
  renderDirectoryPage();
  renderMemeKhazana();
}

// 1. Render Left Sidebar Target Board
function renderTargetBoard() {
  const container = document.getElementById('quick-targets-list');
  if (!container) return;

  const search = (document.getElementById('quick-target-search')?.value || '').toLowerCase();
  let list = state.colleagues;

  if (state.quickDeptFilter !== 'All') {
    list = list.filter(c => c.department.toLowerCase().includes(state.quickDeptFilter.toLowerCase()));
  }

  if (search) {
    list = list.filter(c => c.name.toLowerCase().includes(search) || c.quirk.toLowerCase().includes(search) || c.designation.toLowerCase().includes(search));
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="p-4 text-center text-xs text-slate-400 bg-slate-950 rounded-xl">
        <span class="text-xl block mb-1">🔍</span>
        No colleagues found in @${state.activeDomain}.
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(c => `
    <div class="bg-surface-elevated hover:bg-slate-800 border border-slate-700/80 p-3 rounded-xl flex items-start justify-between transition group">
      <div class="flex items-start gap-2.5 cursor-pointer flex-1 min-w-0" onclick="openColleagueModal('${c.id}')">
        <div class="w-9 h-9 rounded-lg bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-lg shrink-0">
          ${c.avatar || '👓'}
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="text-xs font-bold text-white font-heading">${c.name}</span>
            <span class="text-[10px] bg-slate-800 text-amber-300 border border-slate-700 px-1.5 py-0.2 rounded font-mono font-medium truncate">${c.designation}</span>
          </div>
          <p class="text-[11px] text-amber-300/90 mt-0.5 font-medium leading-tight truncate">"${c.quirk}"</p>
          <div class="flex items-center gap-2 mt-1 text-[10px] text-slate-400 font-mono">
            <span class="text-orange-400 font-semibold">🔥 ${c.roastCount || 0} roasts</span>
            <span>•</span>
            <span class="text-emerald-400 truncate">${c.statusNote || 'In Office'}</span>
          </div>
        </div>
      </div>
      <button onclick="targetColleagueInStudio('${c.id}')" class="text-xs px-2 py-1 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-bold transition shrink-0 ml-2" title="Load ${c.name} into Roaster">
        🌶️
      </button>
    </div>
  `).join('');
}

// 2. Render Studio Meme Strip
function renderStudioTemplates() {
  const container = document.getElementById('studio-template-strip');
  if (!container) return;

  const topThree = state.memes.slice(0, 3);
  container.innerHTML = topThree.map(m => {
    const isSelected = state.selectedStudioMeme && state.selectedStudioMeme.id === m.id;
    return `
      <button onclick="selectStudioMeme('${m.id}')" class="border ${isSelected ? 'border-orange-400 ring-2 ring-orange-500/40' : 'border-slate-700'} bg-slate-900 p-1.5 rounded-xl text-left hover:border-orange-400 transition flex flex-col items-center group">
        <div class="w-full h-12 rounded-lg overflow-hidden relative bg-slate-950">
          <img src="${m.imageUrl}" class="w-full h-full object-cover group-hover:scale-105 transition" alt="${m.title}"/>
        </div>
        <span class="text-[10px] font-semibold text-amber-300 mt-1 truncate w-full text-center">${m.title}</span>
      </button>
    `;
  }).join('');
}

function renderColleagueSelectDropdown() {
  const select = document.getElementById('colleagueDedicationSelect');
  if (!select) return;

  select.innerHTML = `
    <option value="">-- General Watercooler Roast (No Target) --</option>
    ${state.colleagues.map(c => `
      <option value="${c.id}">${c.avatar || '👓'} ${c.name} (${c.designation})</option>
    `).join('')}
  `;
}

// 3. Render Center Posts Feed
function renderFeed() {
  const container = document.getElementById('posts-feed-container');
  if (!container) return;

  if (state.posts.length === 0) {
    container.innerHTML = `
      <div class="bg-surface-card border border-slate-800 rounded-2xl p-8 text-center space-y-3">
        <span class="text-4xl block">🥟</span>
        <h3 class="font-heading font-bold text-lg text-white">No roasts in @${state.activeDomain} yet!</h3>
        <p class="text-xs text-slate-400 max-w-sm mx-auto">
          You're the pioneer in this domain! Use the studio above to ignite the first watercooler banter thread.
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = state.posts.map(post => `
    <article class="bg-surface-card border border-slate-800 rounded-2xl p-5 md:p-6 shadow-md space-y-4 hover:border-slate-700 transition" id="card-${post.id}">
      
      <!-- Card Top Header -->
      <div class="flex items-center justify-between pb-2.5 border-b border-slate-800">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-600 to-amber-500 flex items-center justify-center text-base font-bold text-white shrink-0 shadow">
            ${post.avatarIcon || '🌶️'}
          </div>
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="text-sm font-bold text-white font-heading">${post.maskedAuthor}</span>
              <span class="text-xs font-mono text-slate-400">• ${post.timestamp}</span>
              <span class="text-[10px] font-mono text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-500/30">Verified @${state.activeDomain}</span>
            </div>
            ${post.targetColleagueName ? `
              <p class="text-xs text-slate-300 mt-0.5">
                Roasting: <span class="text-amber-400 font-semibold">${post.targetColleagueName}</span>
                ${post.roastSubject ? `regarding "${post.roastSubject}"` : ''}
              </p>
            ` : `
              <p class="text-xs text-slate-400 mt-0.5">Org-wide Watercooler Banter</p>
            `}
          </div>
        </div>

        <div class="flex items-center gap-2">
          ${post.tags ? post.tags.slice(0, 1).map(tag => `
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30">
              #${tag}
            </span>
          `).join('') : ''}
          <button onclick="openReportModal('${post.id}')" class="text-slate-500 hover:text-red-400 text-xs p-1" title="Report Inappropriate Content">
            🚩
          </button>
        </div>
      </div>

      <!-- Card Narrative Content -->
      ${post.content ? `
        <div class="space-y-1.5 text-sm text-slate-100 font-medium leading-relaxed">
          <p>${escapeHTML(post.content)}</p>
        </div>
      ` : ''}

      <!-- Attached Meme Artwork Box if present -->
      ${post.meme ? `
        <div class="rounded-xl overflow-hidden border border-slate-800 bg-slate-950 p-2 max-w-xl mx-auto shadow-sm">
          <div class="relative rounded-lg overflow-hidden bg-black flex flex-col justify-between p-3 aspect-video">
            <img src="${post.meme.imageUrl}" class="absolute inset-0 w-full h-full object-cover opacity-80" alt="${post.meme.title}"/>
            <div class="absolute inset-0 bg-black/30"></div>
            
            <div class="relative z-10 text-center">
              <p class="meme-overlay-text text-sm sm:text-base font-black">${escapeHTML(post.meme.topText || '')}</p>
            </div>
            
            <div class="relative z-10 text-center">
              <p class="meme-overlay-text text-xs sm:text-sm font-black text-amber-300">${escapeHTML(post.meme.bottomText || '')}</p>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Comments Section Preview / Drawer -->
      <div id="comments-box-${post.id}" class="bg-slate-950 border border-slate-800/90 p-3.5 rounded-xl space-y-3">
        <div class="flex items-center justify-between text-xs font-mono border-b border-slate-800 pb-2">
          <span class="font-bold text-amber-400">💬 Watercooler Comments (${post.comments ? post.comments.length : 0})</span>
          <span class="text-emerald-400 text-[11px]">Decency verified ✓</span>
        </div>

        <div class="space-y-2 text-xs" id="comments-list-${post.id}">
          ${post.comments && post.comments.length > 0 ? post.comments.map(c => `
            <div class="p-2.5 rounded-lg bg-slate-900 border border-slate-800/80">
              <span class="font-bold text-emerald-400 font-mono">${escapeHTML(c.author || 'Anonymous Colleague')}:</span>
              <span class="text-slate-200 ml-1.5 leading-relaxed">${escapeHTML(c.text)}</span>
            </div>
          `).join('') : `
            <span class="text-slate-500 italic text-[11px] block py-1">No comments yet. Drop the first Hinglish punchline below!</span>
          `}
        </div>

        <!-- Inline Comment Input Form -->
        <div class="flex gap-2 pt-1">
          <input id="comment-input-${post.id}" class="flex-1 bg-slate-900 border border-slate-700 text-xs rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-amber-400" placeholder="Reply anonymously with spicy banter..."/>
          <button onclick="submitInlineComment('${post.id}')" class="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-bold text-xs">Reply</button>
        </div>
      </div>

      <!-- Action & Reaction Pills Bar -->
      <div class="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
        <div class="flex items-center gap-2 flex-wrap">
          <button onclick="reactPost('${post.id}', 'roasts')" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold transition active:scale-95" title="Roast (Increments fire counter)">
            <span>🔥</span><span id="react-roasts-${post.id}">${post.reactions?.roasts || 0} Roasts</span>
          </button>
          <button onclick="reactPost('${post.id}', 'masala')" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold transition active:scale-95" title="Wah Bhai / Laugh">
            <span>😂</span><span id="react-masala-${post.id}">${post.reactions?.masala || 0} Wah Bhai</span>
          </button>
          <button onclick="reactPost('${post.id}', 'chai')" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold transition active:scale-95" title="Chai Sip / Relatable">
            <span>☕</span><span id="react-chai-${post.id}">${post.reactions?.chai || 0} Chai Sips</span>
          </button>
          <button onclick="reactPost('${post.id}', 'salty')" class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold transition active:scale-95" title="Salty">
            <span>🧂</span><span id="react-salty-${post.id}">${post.reactions?.salty || 0}</span>
          </button>
        </div>

        <button onclick="focusCommentInput('${post.id}')" class="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 text-xs">
          <span>💬</span> <span>${post.comments ? post.comments.length : 0} Replies</span>
        </button>
      </div>

    </article>
  `).join('');
}

// 4. Render Whispers List
function renderWhispers() {
  const container = document.getElementById('whispers-list');
  if (!container) return;

  if (state.whispers.length === 0) {
    container.innerHTML = `<span class="text-slate-500 italic text-[11px]">No active whispers right now. Drop one below!</span>`;
    return;
  }

  container.innerHTML = state.whispers.map(w => `
    <div class="p-2.5 rounded-xl bg-surface-elevated border border-slate-700/70">
      <div class="flex justify-between items-center text-[10px] text-amber-400 font-bold mb-1 font-mono">
        <span>${escapeHTML(w.author)}</span>
        <span class="text-slate-500 font-normal">${w.time || '2m ago'}</span>
      </div>
      <p class="text-slate-200 text-[12px] leading-relaxed">${escapeHTML(w.text)}</p>
    </div>
  `).join('');
}

// 5. Render Full Directory Page
function renderDirectoryPage() {
  const container = document.getElementById('directory-cards-grid');
  if (!container) return;

  const search = (document.getElementById('directory-search-input')?.value || '').toLowerCase();
  let list = state.colleagues;

  if (state.dirDeptFilter !== 'All') {
    list = list.filter(c => c.department.toLowerCase().includes(state.dirDeptFilter.toLowerCase()));
  }

  if (search) {
    list = list.filter(c => c.name.toLowerCase().includes(search) || c.quirk.toLowerCase().includes(search) || c.designation.toLowerCase().includes(search));
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="col-span-full bg-surface-card border border-slate-800 rounded-2xl p-12 text-center">
        <span class="text-4xl block mb-2">🎯</span>
        <h3 class="font-heading font-bold text-lg text-white">No colleagues found in this category</h3>
        <p class="text-xs text-slate-400">Try searching another designation or clear the search filter.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(c => `
    <div class="bg-surface-card border border-slate-800 hover:border-amber-500/50 rounded-2xl p-5 shadow-md flex flex-col justify-between transition group">
      <div>
        <div class="flex items-start justify-between gap-3 mb-3">
          <div class="w-12 h-12 rounded-xl bg-orange-600/20 border border-orange-500/40 flex items-center justify-center text-2xl shadow-sm">
            ${c.avatar || '👓'}
          </div>
          <span class="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-slate-900 border border-slate-700 text-amber-400">
            ${c.department}
          </span>
        </div>

        <h3 class="font-heading font-extrabold text-base text-white group-hover:text-amber-300 transition">${c.name}</h3>
        <span class="text-xs font-mono text-slate-400 block">${c.handle} • ${c.designation}</span>

        <p class="text-xs text-amber-300/90 mt-2 font-medium bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 leading-snug">
          "${c.quirk}"
        </p>

        <div class="mt-3 flex items-center gap-3 text-xs font-mono text-slate-400">
          <span class="text-orange-400 font-bold">🔥 ${c.roastCount || 0} roasts</span>
          <span>•</span>
          <span class="text-emerald-400 font-medium">${c.statusNote || 'Active'}</span>
        </div>
      </div>

      <div class="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
        <button onclick="openColleagueModal('${c.id}')" class="text-xs font-bold text-amber-400 hover:underline flex items-center gap-1">
          View Profile Feed →
        </button>
        <button onclick="targetColleagueInStudio('${c.id}')" class="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white rounded-lg font-bold text-xs uppercase shadow transition">
          Roast 🌶️
        </button>
      </div>
    </div>
  `).join('');
}

// 6. Render Meme Khazana Page
function renderMemeKhazana() {
  const container = document.getElementById('meme-khazana-grid');
  if (!container) return;

  const search = (document.getElementById('meme-search-input')?.value || '').toLowerCase();
  let list = state.memes;

  if (state.khazanaUniverse !== 'All') {
    list = list.filter(m => m.universe.toLowerCase().includes(state.khazanaUniverse.toLowerCase()));
  }

  if (search) {
    list = list.filter(m => 
      m.title.toLowerCase().includes(search) || 
      m.character.toLowerCase().includes(search) || 
      m.defaultTop.toLowerCase().includes(search) || 
      m.defaultBottom.toLowerCase().includes(search)
    );
  }

  container.innerHTML = list.map(m => `
    <article class="bg-surface-card border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-md group hover:shadow-xl hover:border-slate-700 transition-all duration-200">
      <div class="relative w-full h-48 bg-slate-950 overflow-hidden">
        <img src="${m.imageUrl}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" alt="${m.title}"/>
        <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-black/40"></div>
        
        <div class="absolute top-3 left-3 px-2 py-1 rounded bg-black/70 backdrop-blur-md text-amber-300 font-mono text-[11px] font-bold">
          ${m.universe}
        </div>
        
        <div class="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded bg-black/70 backdrop-blur-md text-slate-200 font-mono text-[10px]">
          <span class="text-orange-400">🔥</span> ${m.uses} uses
        </div>

        <div class="absolute bottom-3 left-3 right-3">
          <p class="font-heading text-sm text-white font-bold leading-tight drop-shadow-md">
            "${m.title}"
          </p>
        </div>
      </div>

      <div class="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div class="space-y-1.5">
          <span class="text-[10px] font-mono text-slate-400 uppercase tracking-wider block">Featured Punchlines:</span>
          <p class="text-xs font-mono text-amber-300 font-bold bg-slate-950 p-2 rounded-lg border border-slate-800">
            ${m.defaultTop}
          </p>
          <p class="text-xs font-mono text-slate-300 bg-slate-950 p-2 rounded-lg border border-slate-800">
            ${m.defaultBottom}
          </p>
        </div>

        <div class="pt-2 border-t border-slate-800 flex items-center justify-between">
          <span class="text-[10px] font-mono text-emerald-400 font-bold">100% HR Cleared</span>
          <button onclick="useMemeFromKhazana('${m.id}')" class="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded-lg uppercase shadow transition">
            Use in Studio 🚀
          </button>
        </div>
      </div>
    </article>
  `).join('');
}

// -------------------------------------------------------------
// Interactive Meme Studio Controls
// -------------------------------------------------------------
function selectStudioMeme(memeId) {
  const meme = state.memes.find(m => m.id === memeId);
  if (!meme) return;

  state.selectedStudioMeme = meme;
  document.getElementById('canvasPreviewImg').src = meme.imageUrl;
  document.getElementById('memeTopInput').value = meme.defaultTop;
  document.getElementById('memeBottomInput').value = meme.defaultBottom;
  updateLiveCanvasPreview();
  renderStudioTemplates();
}

function updateLiveCanvasPreview() {
  const topText = document.getElementById('memeTopInput')?.value || '';
  const bottomText = document.getElementById('memeBottomInput')?.value || '';

  const canvasTop = document.getElementById('canvasTopText');
  const canvasBottom = document.getElementById('canvasBottomText');

  if (canvasTop) canvasTop.textContent = topText;
  if (canvasBottom) canvasBottom.textContent = bottomText;

  // Live decency scan on both punchlines
  checkDecencyLive(`${topText} ${bottomText}`);
}

function targetColleagueInStudio(colleagueId) {
  navigateTo('feed');
  const select = document.getElementById('colleagueDedicationSelect');
  if (select) {
    select.value = colleagueId;
  }
  const colleague = state.colleagues.find(c => c.id === colleagueId);
  if (colleague) {
    document.getElementById('roastCaptionInput').value = `Roasting ${colleague.name} on: "${colleague.quirk}" 😂`;
    showToast('Colleague Targeted', `Loaded ${colleague.name} into the Meme Studio!`, '🎯');
  }
}

function useMemeFromKhazana(memeId) {
  selectStudioMeme(memeId);
  navigateTo('feed');
  showToast('Meme Template Loaded', 'Template docked into the live studio.', '🎬');
}

function resetStudioInputs() {
  if (state.memes.length > 0) {
    selectStudioMeme(state.memes[0].id);
  }
  document.getElementById('roastCaptionInput').value = '';
  document.getElementById('colleagueDedicationSelect').value = '';
  hideDecencyBanner();
}

// -------------------------------------------------------------
// Real-time Decency Engine Intercept (Automated Gatekeeper)
// -------------------------------------------------------------
let decencyTimer = null;
function checkDecencyLive(text) {
  clearTimeout(decencyTimer);
  decencyTimer = setTimeout(async () => {
    if (!text || !text.trim()) {
      hideDecencyBanner();
      return;
    }

    try {
      const res = await fetch('/api/decency/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const result = await res.json();
      if (!result.allowed) {
        showDecencyBanner(result.reason, result.flaggedWords);
      } else {
        hideDecencyBanner();
      }
    } catch (e) {
      console.warn('Decency check error:', e);
    }
  }, 250);
}

function showDecencyBanner(reason, flaggedWords) {
  const banner = document.getElementById('decency-intercept-banner');
  const msg = document.getElementById('decency-banner-msg');
  if (banner && msg) {
    msg.textContent = reason || `Decency Engine Intercept: Flagged language (${flaggedWords?.join(', ') || 'toxic'}). Please keep it decent!`;
    banner.classList.remove('hidden');
    banner.classList.add('intercept-shake');
    setTimeout(() => banner.classList.remove('intercept-shake'), 400);
  }
}

function hideDecencyBanner() {
  const banner = document.getElementById('decency-intercept-banner');
  if (banner) {
    banner.classList.add('hidden');
  }
}

// -------------------------------------------------------------
// Submit Roast to API
// -------------------------------------------------------------
async function submitRoast() {
  const content = document.getElementById('roastCaptionInput')?.value || '';
  const topText = document.getElementById('memeTopInput')?.value || '';
  const bottomText = document.getElementById('memeBottomInput')?.value || '';
  const colleagueId = document.getElementById('colleagueDedicationSelect')?.value || null;

  const targetColleague = colleagueId ? state.colleagues.find(c => c.id === colleagueId) : null;

  let memePayload = null;
  if (state.selectedStudioMeme) {
    memePayload = {
      templateId: state.selectedStudioMeme.id,
      title: state.selectedStudioMeme.title,
      topText: topText,
      bottomText: bottomText,
      imageUrl: state.selectedStudioMeme.imageUrl
    };
  }

  const payload = {
    targetColleagueId: targetColleague ? targetColleague.id : null,
    targetColleagueName: targetColleague ? `${targetColleague.name} (${targetColleague.designation})` : null,
    roastSubject: targetColleague ? targetColleague.quirk : 'Workplace Satire',
    content: content || (memePayload ? `${topText} — ${bottomText}` : 'Workplace banter'),
    meme: memePayload,
    tags: ['DesiRoast', state.selectedStudioMeme?.universe ? state.selectedStudioMeme.universe.split(' ')[0] : 'Banter']
  };

  try {
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 422 && data.error === 'DECENCY_INTERCEPT') {
        showDecencyBanner(data.reason, data.flaggedWords);
        showToast('Decency Intercept', 'Your post was halted due to prohibited language.', '🚫');
        return;
      }
      showToast('Error', data.error || 'Failed to post roast.', '❌');
      return;
    }

    hideDecencyBanner();
    state.posts.unshift(data.post);
    renderFeed();
    resetStudioInputs();
    showToast('Roast Fired!', 'Your roast is live and anonymously protected.', '🔥');

    // Update colleague stats locally
    if (targetColleague) {
      targetColleague.roastCount = (targetColleague.roastCount || 0) + 1;
      renderTargetBoard();
      renderDirectoryPage();
    }
  } catch (err) {
    console.error('Error submitting roast:', err);
    showToast('Error', 'Network error posting roast.', '❌');
  }
}

// -------------------------------------------------------------
// Reactions & Comments
// -------------------------------------------------------------
async function reactPost(postId, type) {
  const post = state.posts.find(p => p.id === postId);
  if (!post) return;

  // Optimistic UI update
  post.reactions[type] = (post.reactions[type] || 0) + 1;
  const countEl = document.getElementById(`react-${type}-${postId}`);
  if (countEl) {
    countEl.textContent = `${post.reactions[type]} ${type === 'roasts' ? 'Roasts' : type === 'masala' ? 'Wah Bhai' : type === 'chai' ? 'Chai Sips' : ''}`;
  }

  try {
    await fetch(`/api/posts/${postId}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type })
    });
  } catch (err) {
    console.warn('React error:', err);
  }
}

function focusCommentInput(postId) {
  const input = document.getElementById(`comment-input-${postId}`);
  if (input) {
    input.focus();
  }
}

async function submitInlineComment(postId) {
  const input = document.getElementById(`comment-input-${postId}`);
  if (!input || !input.value.trim()) return;

  const text = input.value.trim();

  try {
    const res = await fetch(`/api/posts/${postId}/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });

    const data = await res.json();
    if (!res.ok) {
      showToast('Decency Warning', data.reason || 'Comment rejected.', '⚠️');
      return;
    }

    const post = state.posts.find(p => p.id === postId);
    if (post) {
      post.comments = data.comments;
    }
    input.value = '';
    renderFeed();
    showToast('Comment Added', 'Your anonymous reply is posted.', '💬');
  } catch (e) {
    console.error('Comment error:', e);
  }
}

// -------------------------------------------------------------
// Watercooler Whispers
// -------------------------------------------------------------
async function postWhisper() {
  const input = document.getElementById('quickWhisperInput');
  if (!input || !input.value.trim()) return;

  const text = input.value.trim();

  try {
    const res = await fetch('/api/whispers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });

    const data = await res.json();
    if (!res.ok) {
      showToast('Blocked', data.reason || 'Whisper failed decency test.', '🚫');
      return;
    }

    state.whispers.unshift(data.whisper);
    input.value = '';
    renderWhispers();
    showToast('Whisper Dropped', 'Anonymous whisper posted to office thread.', '☕');
  } catch (e) {
    console.error('Whisper post error:', e);
  }
}

function votePoll(option) {
  showToast('Vote Counted', 'Your anonymous vote on Friday release was registered!', '📊');
}

// -------------------------------------------------------------
// Colleague Profile Modal (SCR-03)
// -------------------------------------------------------------
async function openColleagueModal(colleagueId) {
  const colleague = state.colleagues.find(c => c.id === colleagueId);
  if (!colleague) return;

  state.activeColleague = colleague;
  state.modalAttachedMeme = null;

  document.getElementById('modal-colleague-avatar').textContent = colleague.avatar || '👓';
  document.getElementById('modal-colleague-name').textContent = colleague.name;
  document.getElementById('modal-colleague-dept').textContent = `${colleague.designation} • ${colleague.department}`;
  document.getElementById('modal-colleague-quirk').textContent = `"${colleague.quirk}"`;
  document.getElementById('composer-target-name').textContent = colleague.name;

  // Clear modal inputs
  document.getElementById('modalRoastText').value = '';
  document.getElementById('modalAttachedMemeBox').classList.add('hidden');

  // Fetch roasts specifically on this colleague
  const modalRoastsList = document.getElementById('modal-roasts-list');
  modalRoastsList.innerHTML = `<span class="text-xs text-slate-400 font-mono">Loading roasts on ${colleague.name}...</span>`;

  try {
    const res = await fetch(`/api/directory/${colleague.id}`);
    const data = await res.json();
    const roasts = data.roasts || [];

    if (roasts.length === 0) {
      modalRoastsList.innerHTML = `
        <div class="p-6 text-center text-xs text-slate-400 bg-slate-950 rounded-xl">
          <span class="text-2xl block mb-1">🌶️</span>
          No roasts on ${colleague.name} yet. Be the first to leave anonymous banter above!
        </div>
      `;
    } else {
      modalRoastsList.innerHTML = roasts.map(r => `
        <div class="bg-slate-950 border border-slate-800 p-3.5 rounded-xl space-y-2">
          <div class="flex justify-between items-center text-xs">
            <span class="font-bold text-amber-400 font-heading">${r.maskedAuthor}</span>
            <span class="text-slate-500 text-[10px] font-mono">${r.timestamp}</span>
          </div>
          <p class="text-xs text-slate-200">${escapeHTML(r.content)}</p>
          ${r.meme ? `
            <div class="p-2 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300">
              🖼️ Attached Meme: <strong class="text-amber-300">${r.meme.title}</strong> ("${r.meme.topText}")
            </div>
          ` : ''}
        </div>
      `).join('');
    }
  } catch (e) {
    console.error('Error fetching colleague profile roasts:', e);
  }

  document.getElementById('colleague-profile-modal').classList.remove('hidden');
}

function closeColleagueModal() {
  document.getElementById('colleague-profile-modal').classList.add('hidden');
  state.activeColleague = null;
}

function openMemePickerForModal() {
  if (state.memes.length > 0) {
    const randomMeme = state.memes[Math.floor(Math.random() * state.memes.length)];
    state.modalAttachedMeme = randomMeme;
    document.getElementById('modalAttachedMemeTitle').textContent = randomMeme.title;
    document.getElementById('modalAttachedMemePunchline').textContent = `Top: "${randomMeme.defaultTop}"`;
    document.getElementById('modalAttachedMemeBox').classList.remove('hidden');
    showToast('Meme Attached', `Attached "${randomMeme.title}" to roast!`, '🖼️');
  }
}

function detachModalMeme() {
  state.modalAttachedMeme = null;
  document.getElementById('modalAttachedMemeBox').classList.add('hidden');
}

async function submitModalRoast() {
  if (!state.activeColleague) return;

  const content = document.getElementById('modalRoastText')?.value || '';
  if (!content.trim() && !state.modalAttachedMeme) {
    showToast('Missing Roast', 'Please write a roast or attach an Indian meme!', '⚠️');
    return;
  }

  let memePayload = null;
  if (state.modalAttachedMeme) {
    memePayload = {
      templateId: state.modalAttachedMeme.id,
      title: state.modalAttachedMeme.title,
      topText: state.modalAttachedMeme.defaultTop,
      bottomText: state.modalAttachedMeme.defaultBottom,
      imageUrl: state.modalAttachedMeme.imageUrl
    };
  }

  const payload = {
    targetColleagueId: state.activeColleague.id,
    targetColleagueName: `${state.activeColleague.name} (${state.activeColleague.designation})`,
    roastSubject: state.activeColleague.quirk,
    content: content.trim() || 'Assigned an Indian meme',
    meme: memePayload,
    tags: ['ProfileRoast', 'ColleagueBanter']
  };

  try {
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) {
      showToast('Decency Intercept', data.reason || 'Roast blocked by moderation engine.', '🚫');
      return;
    }

    state.posts.unshift(data.post);
    state.activeColleague.roastCount = (state.activeColleague.roastCount || 0) + 1;
    renderFeed();
    renderTargetBoard();
    renderDirectoryPage();
    closeColleagueModal();
    showToast('Roast Published', `Anonymous roast posted on ${state.activeColleague.name}!`, '🔥');
  } catch (err) {
    console.error('Error submitting modal roast:', err);
  }
}

// -------------------------------------------------------------
// Report Content Modal
// -------------------------------------------------------------
function openReportModal(postId) {
  state.reportingPostId = postId;
  document.getElementById('report-modal').classList.remove('hidden');
}

function closeReportModal() {
  document.getElementById('report-modal').classList.add('hidden');
  state.reportingPostId = null;
}

async function submitPostReport() {
  if (!state.reportingPostId) return;

  const reason = document.querySelector('input[name="reportReason"]:checked')?.value || 'Inappropriate Banter';

  try {
    const res = await fetch(`/api/posts/${state.reportingPostId}/report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });

    const data = await res.json();
    closeReportModal();

    if (data.quarantined) {
      state.posts = state.posts.filter(p => p.id !== state.reportingPostId);
      renderFeed();
      showToast('Post Quarantined', 'Post received 3 flags and has been removed from feed.', '🛡️');
    } else {
      showToast('Report Submitted', 'Thanks for keeping the workspace safe!', '🚩');
    }
  } catch (e) {
    console.error('Report error:', e);
  }
}

// -------------------------------------------------------------
// Domain Isolation Switcher (FR-001)
// -------------------------------------------------------------
function toggleDomainMenu() {
  const menu = document.getElementById('domain-dropdown');
  menu.classList.toggle('hidden');
}

async function switchDomain(newDomain) {
  document.getElementById('domain-dropdown').classList.add('hidden');
  try {
    const res = await fetch('/api/auth/switch-domain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: newDomain })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Workspace Switched', `Switched to ${newDomain}. Content isolated per FR-001.`, '🏢');
      await fetchInitialData();
    }
  } catch (e) {
    console.error('Switch domain error:', e);
  }
}

// -------------------------------------------------------------
// Settings & Privacy Controls (Simple English)
// -------------------------------------------------------------
function toggleSetting(key) {
  state.settings.privacy[key] = !state.settings.privacy[key];
  const btn = document.getElementById(key === 'hideFromManagers' ? 'toggle-hide-hr' : key === 'fakeLocation' ? 'toggle-fake-location' : 'toggle-unmask-mode');
  if (btn) {
    btn.setAttribute('aria-checked', state.settings.privacy[key]);
  }
  showToast('Setting Updated', `${key} is now ${state.settings.privacy[key] ? 'Enabled' : 'Disabled'}`, '🛡️');
}

function updateHumorLevel(val) {
  const badge = document.getElementById('spice-level-badge');
  const levelNames = {
    '1': 'Mild Chai ☕',
    '2': 'Medium Masala 🌶️',
    '3': 'Bold & Spicy 🔥',
    '4': 'Nuclear Ghost Pepper 💀'
  };
  if (badge) {
    badge.textContent = levelNames[val] || 'Bold & Spicy 🔥';
  }
  state.settings.contentFilter.spicinessLevel = val;
}

function rollRandomNickname() {
  const randomAlias = FUN_DESI_ALIASES[Math.floor(Math.random() * FUN_DESI_ALIASES.length)];
  state.currentUser.alias = randomAlias;
  const input = document.getElementById('settings-alias-input');
  if (input) input.value = randomAlias;
  updateHeaderUI();
  showToast('New Alias Rolled', `Your alias is now: ${randomAlias}`, '🎲');
}

function updateUserAlias(val) {
  if (val && val.trim()) {
    state.currentUser.alias = val.trim();
    updateHeaderUI();
  }
}

async function saveAllSettings() {
  try {
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        privacy: state.settings.privacy,
        contentFilter: state.settings.contentFilter,
        currentUser: state.currentUser
      })
    });
    showToast('Preferences Saved', 'All privacy & content filters persisted.', '✓');
  } catch (e) {
    console.error('Save settings error:', e);
  }
}

// -------------------------------------------------------------
// Auth & Verification Flow (SCR-01)
// -------------------------------------------------------------
function detectAuthDomain(email) {
  const pill = document.getElementById('auth-domain-detected-pill');
  const errEl = document.getElementById('auth-email-error');
  errEl.classList.add('hidden');

  if (!email || !email.includes('@')) {
    pill.classList.add('hidden');
    return;
  }

  const domain = email.split('@')[1];
  const personal = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com'];
  if (personal.includes(domain)) {
    pill.classList.add('hidden');
    errEl.textContent = '❌ Personal emails are blocked. Please use corporate or university email (@company.com).';
    errEl.classList.remove('hidden');
    return;
  }

  if (domain && domain.includes('.')) {
    pill.textContent = `Enterprise Domain: @${domain} ✓`;
    pill.classList.remove('hidden');
  }
}

function rollAuthAlias() {
  const randomAlias = FUN_DESI_ALIASES[Math.floor(Math.random() * FUN_DESI_ALIASES.length)];
  document.getElementById('auth-alias-input').value = randomAlias;
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('auth-email-input').value.trim();
  const alias = document.getElementById('auth-alias-input').value.trim();

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, alias })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast('Verification Failed', data.error, '❌');
      return;
    }

    showToast('Desk Claimed!', `Welcome to ${data.organization.name}!`, '🚀');
    await fetchInitialData();
    navigateTo('feed');
  } catch (err) {
    console.error('Auth error:', err);
  }
}

async function quickLogin(email) {
  document.getElementById('auth-email-input').value = email;
  detectAuthDomain(email);
  const alias = FUN_DESI_ALIASES[Math.floor(Math.random() * FUN_DESI_ALIASES.length)];
  document.getElementById('auth-alias-input').value = alias;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, alias })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Workspace Verified', `Switched to ${data.organization.name}`, '🏢');
      await fetchInitialData();
      navigateTo('feed');
    }
  } catch (e) {
    console.error('Quick login error:', e);
  }
}

// -------------------------------------------------------------
// Filters & Helpers
// -------------------------------------------------------------
function setQuickDeptFilter(dept) {
  state.quickDeptFilter = dept;
  document.querySelectorAll('#quick-dept-filters .dept-filter-btn').forEach(btn => {
    if (btn.textContent.includes(dept)) {
      btn.className = 'dept-filter-btn px-2.5 py-1 rounded-lg bg-orange-600 text-white font-semibold';
    } else {
      btn.className = 'dept-filter-btn px-2 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition';
    }
  });
  renderTargetBoard();
}

function filterQuickTargets() {
  renderTargetBoard();
}

function setDirectoryDeptFilter(dept) {
  state.dirDeptFilter = dept;
  document.querySelectorAll('#directory-dept-tabs .dir-tab-btn').forEach(btn => {
    if (btn.textContent.includes(dept)) {
      btn.className = 'dir-tab-btn px-3 py-1.5 rounded-lg bg-orange-600 text-white font-heading font-bold text-xs';
    } else {
      btn.className = 'dir-tab-btn px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-heading font-semibold text-xs';
    }
  });
  renderDirectoryPage();
}

function filterDirectoryList() {
  renderDirectoryPage();
}

function setKhazanaUniverse(universe) {
  state.khazanaUniverse = universe;
  document.querySelectorAll('#meme-universe-pills .khazana-pill').forEach(btn => {
    if (btn.textContent.includes(universe)) {
      btn.className = 'khazana-pill px-3 py-1.5 rounded-full bg-orange-600 text-white text-xs font-mono font-bold whitespace-nowrap';
    } else {
      btn.className = 'khazana-pill px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-semibold whitespace-nowrap';
    }
  });
  renderMemeKhazana();
}

function filterMemeKhazana() {
  renderMemeKhazana();
}

function filterStudioMemes(universe) {
  document.querySelectorAll('#studio-universe-pills button').forEach(btn => {
    if (btn.textContent.includes(universe)) {
      btn.className = 'px-2.5 py-1.5 rounded-lg bg-orange-600 text-white font-semibold';
    } else {
      btn.className = 'px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700';
    }
  });
  let filtered = state.memes;
  if (universe !== 'All') {
    filtered = filtered.filter(m => m.universe.toLowerCase().includes(universe.toLowerCase()));
  }
  const container = document.getElementById('studio-template-strip');
  if (container) {
    container.innerHTML = filtered.slice(0, 3).map(m => `
      <button onclick="selectStudioMeme('${m.id}')" class="border border-slate-700 bg-slate-900 p-1.5 rounded-xl text-left hover:border-orange-400 transition flex flex-col items-center group">
        <div class="w-full h-12 rounded-lg overflow-hidden relative bg-slate-950">
          <img src="${m.imageUrl}" class="w-full h-full object-cover group-hover:scale-105 transition" alt="${m.title}"/>
        </div>
        <span class="text-[10px] font-semibold text-amber-300 mt-1 truncate w-full text-center">${m.title}</span>
      </button>
    `).join('');
  }
}

async function filterFeed(filterType) {
  state.feedFilter = filterType;
  document.querySelectorAll('#feed-filter-btns .feed-filter-btn').forEach(btn => {
    if ((filterType === 'all' && btn.textContent.includes('Spiciest Chai')) ||
        (filterType === 'trending' && btn.textContent.includes('Trending')) ||
        (filterType === 'memes' && btn.textContent.includes('Top Memes'))) {
      btn.className = 'feed-filter-btn px-2.5 py-1 rounded-lg bg-orange-600 text-white font-semibold';
    } else {
      btn.className = 'feed-filter-btn px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700';
    }
  });

  try {
    const res = await fetch(`/api/posts?orgId=${state.organization.id}&filter=${filterType}`);
    state.posts = await res.json();
    renderFeed();
  } catch (e) {
    console.error('Filter feed error:', e);
  }
}

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

function showToast(title, msg, icon = '🌶️') {
  const toast = document.getElementById('global-toast');
  const tTitle = document.getElementById('toast-title');
  const tMsg = document.getElementById('toast-msg');
  const tIcon = document.getElementById('toast-icon');

  if (toast && tTitle && tMsg) {
    tTitle.textContent = title;
    tMsg.textContent = msg;
    tIcon.textContent = icon;
    toast.classList.remove('translate-y-20', 'opacity-0', 'pointer-events-none');
    setTimeout(() => {
      toast.classList.add('translate-y-20', 'opacity-0', 'pointer-events-none');
    }, 4000);
  }
}

function setupEventListeners() {
  // Click outside domain dropdown to close
  document.addEventListener('click', (e) => {
    const btn = document.getElementById('domain-switcher-btn');
    const menu = document.getElementById('domain-dropdown');
    if (btn && menu && !btn.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.add('hidden');
    }
  });
}
