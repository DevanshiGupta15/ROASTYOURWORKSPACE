// =========================================================================
// ROAST YOUR WORKSPACE — INTERACTIVE APPLICATION LOGIC (Tadka & Chai Theme)
// Multi-Tenant Room Isolation, Ephemeral Feeds, Meme Studio & Polish
// =========================================================================

const state = {
  activeTab: 'feed',
  activeDomain: 'swiggy.in',
  currentUser: {
    name: 'Rohan S.',
    alias: 'Panchayat Banrakas',
    empId: 'SW-8891',
    email: 'rohan@swiggy.in',
    domain: 'swiggy.in',
    role: 'DevOps Lead',
    karma: 1420,
    streak: 9
  },
  organization: {
    id: 'org_swiggy',
    code: 'SWIGGY-101',
    name: 'Swiggy Tech Arena',
    domain: 'swiggy.in'
  },
  availableRooms: [],
  colleagues: [],
  posts: [],
  memes: [],
  whispers: [],
  poll: null,
  leaderboard: [],
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
      spicinessLevel: 'bold',
      filterAppraisals: false,
      filterFood: false,
      filterFriday: false
    },
    notifications: {
      newRoasts: true,
      memeTagged: true,
      streakAlerts: true
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
  'Two-Minute-Quick-Call',
  'Munna Bhai Senior Architect',
  'Jethalal Production Debugger'
];

// Client-Side HR Decency Engine Keywords
const CLIENT_BANNED_WORDS = [
  'abuse', 'bastard', 'bitch', 'asshole', 'fucker', 'motherfucker', 'retard', 'cunt', 'dickhead', 'moron',
  'idiot', 'stupid', 'worthless', 'kill yourself', 'die', 'threat', 'slap you', 'beat you',
  'gaali', 'chutiya', 'harami', 'kamina', 'saala', 'madarchod', 'behenchod', 'gandu', 'bhadwe', 'laude',
  'bhosdike', 'kaminey', 'kutta', 'randi', 'terimaaki', 'ullu ke patthe', 'tatti', 'suar', 'haramkhor',
  'fire him', 'fire her', 'useless piece', 'ugly', 'fat', 'loser', 'scam artist', 'fraudulent', 'thief',
  'stealing credit', 'toxic creep', 'harasser', 'casteist', 'racist'
];

// Initialize on document ready
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  loadSavedSettings();
  setupEventListeners();
  await fetchInitialData();
  navigateTo('feed');

  // If user has not yet joined an org in this session/browser, show Onboarding Modal
  const savedRoom = localStorage.getItem('ryw_room_code') || localStorage.getItem('ryw_org_id');
  if (!savedRoom) {
    openOnboardingModal(true); // Mandatory first join
  }
}

// -------------------------------------------------------------
// Modal Background Scroll Locking & Z-Index Management (Step 4)
// -------------------------------------------------------------
function lockScroll() {
  document.body.classList.add('modal-open');
}

function unlockScroll() {
  // Only unlock if no other modals or drawers are open
  const openModals = document.querySelectorAll('#onboarding-modal:not(.hidden), #colleague-profile-modal:not(.hidden), #report-modal:not(.hidden), .responsive-drawer-left.drawer-open, .responsive-drawer-right.drawer-open');
  if (openModals.length === 0) {
    document.body.classList.remove('modal-open');
  }
}

// -------------------------------------------------------------
// Data Fetching & API Communication (Strict Multi-Tenancy)
// -------------------------------------------------------------
async function fetchInitialData() {
  try {
    const orgId = state.organization.id;
    const reqHeaders = { 'x-org-id': orgId };

    const [meRes, roomsRes, dirRes, postsRes, memesRes, whispersRes, pollRes, lbRes] = await Promise.all([
      fetch('/api/auth/me', { headers: reqHeaders }),
      fetch('/api/auth/rooms', { headers: reqHeaders }),
      fetch(`/api/directory?orgId=${orgId}`, { headers: reqHeaders }),
      fetch(`/api/posts?orgId=${orgId}&filter=${state.feedFilter}`, { headers: reqHeaders }),
      fetch('/api/memes'),
      fetch(`/api/whispers?orgId=${orgId}`, { headers: reqHeaders }),
      fetch(`/api/polls?orgId=${orgId}`, { headers: reqHeaders }),
      fetch(`/api/leaderboard?orgId=${orgId}`, { headers: reqHeaders })
    ]);

    const meData = await meRes.json();
    if (meData.currentUser) state.currentUser = meData.currentUser;
    if (meData.organization) state.organization = meData.organization;
    if (meData.privacy) state.settings.privacy = { ...state.settings.privacy, ...meData.privacy };
    if (meData.contentFilter) state.settings.contentFilter = { ...state.settings.contentFilter, ...meData.contentFilter };

    const roomsData = await roomsRes.json();
    state.availableRooms = roomsData.rooms || [];

    state.activeDomain = state.organization.domain;
    state.colleagues = await dirRes.json();
    state.posts = await postsRes.json();
    state.memes = await memesRes.json();
    state.whispers = await whispersRes.json();
    state.poll = await pollRes.json();
    const lbData = await lbRes.json();
    state.leaderboard = lbData.leaderboard || [];

    // Select first meme as default studio meme
    if (state.memes.length > 0 && !state.selectedStudioMeme) {
      state.selectedStudioMeme = state.memes[0];
    }

    updateHeaderUI();
    renderAllViews();
  } catch (err) {
    console.error('Failed to load initial data:', err);
    showToast('Offline Mode', 'Loaded in local state mode.', '⚠️');
  }
}

// -------------------------------------------------------------
// UI Header & Room Indicator Updates (Step 1)
// -------------------------------------------------------------
function updateHeaderUI() {
  const roomIndicator = document.getElementById('active-room-indicator');
  if (roomIndicator) {
    roomIndicator.textContent = `Active Room: ${state.organization.name} | Code: ${state.organization.code || 'CODE'}`;
  }

  const canvasStamp = document.getElementById('canvas-domain-stamp');
  if (canvasStamp) {
    canvasStamp.textContent = `Verified @${state.activeDomain} (${state.organization.code || 'ROOM'})`;
  }

  const whispersLabel = document.getElementById('whispers-domain-label');
  if (whispersLabel) {
    whispersLabel.textContent = `@${state.activeDomain}`;
  }

  const headerUser = document.getElementById('header-user-name');
  if (headerUser) {
    headerUser.textContent = state.currentUser.name;
  }

  const streakBadge = document.getElementById('streak-counter');
  if (streakBadge) {
    streakBadge.textContent = `${state.currentUser.streak || 9} Days Streak`;
  }

  const studioAlias = document.getElementById('studio-alias-badge');
  if (studioAlias) {
    studioAlias.textContent = state.currentUser.alias;
  }

  // Update Settings Room Card
  const sRoomName = document.getElementById('settings-room-name');
  if (sRoomName) sRoomName.textContent = state.organization.name;
  const sRoomCode = document.getElementById('settings-room-code-badge');
  if (sRoomCode) sRoomCode.textContent = `CODE: ${state.organization.code || 'MAIN'}`;
  const sRoomDomain = document.getElementById('settings-room-domain');
  if (sRoomDomain) sRoomDomain.textContent = `@${state.organization.domain}`;
  const sDomainPill = document.getElementById('settings-domain-pill');
  if (sDomainPill) sDomainPill.textContent = `Domain: @${state.organization.domain}`;

  // Update Settings Profile Card
  const sName = document.getElementById('settings-card-name');
  if (sName) sName.textContent = state.currentUser.name;
  const sHandle = document.getElementById('settings-card-handle');
  if (sHandle) sHandle.textContent = `@${(state.currentUser.alias || 'anonymous').replace(/\s+/g, '_').toLowerCase()}`;
  const sRole = document.getElementById('settings-card-role');
  if (sRole) sRole.textContent = state.currentUser.role || 'Team Member';
  const sStreak = document.getElementById('settings-card-streak');
  if (sStreak) sStreak.textContent = `🔥 ${state.currentUser.streak || 9}-Day Streak`;
  const sKarma = document.getElementById('settings-card-karma');
  if (sKarma) sKarma.textContent = `${state.currentUser.karma || 1420} Karma`;

  const sAliasInput = document.getElementById('settings-alias-input');
  if (sAliasInput) sAliasInput.value = state.currentUser.alias;

  // Mobile target board count
  const mobileCount = document.getElementById('mobile-target-count');
  if (mobileCount) mobileCount.textContent = state.colleagues.length;
}

// -------------------------------------------------------------
// Multi-Tenant Onboarding Modal & Room Switcher (Step 1)
// -------------------------------------------------------------
function openOnboardingModal(isMandatory = false) {
  const modal = document.getElementById('onboarding-modal');
  const closeBtn = document.getElementById('onboarding-close-btn');
  if (modal) {
    modal.classList.remove('hidden');
    lockScroll();
  }
  if (closeBtn) {
    if (isMandatory) {
      closeBtn.classList.add('hidden');
    } else {
      closeBtn.classList.remove('hidden');
    }
  }
  // Close header room dropdown if open
  const menu = document.getElementById('room-dropdown');
  if (menu) menu.classList.add('hidden');
}

function closeOnboardingModal() {
  const modal = document.getElementById('onboarding-modal');
  if (modal) {
    modal.classList.add('hidden');
    unlockScroll();
  }
}

function selectQuickRoom(code, domain) {
  const roomInput = document.getElementById('onboard-room-input');
  const idInput = document.getElementById('onboard-identifier-input');
  if (roomInput) roomInput.value = code;
  if (idInput && (!idInput.value || idInput.value === 'SW-8891' || idInput.value.includes('@'))) {
    idInput.value = `dev@${domain}`;
  }
}

function rollOnboardingAlias() {
  const input = document.getElementById('onboard-alias-input');
  if (input) {
    const random = FUN_DESI_ALIASES[Math.floor(Math.random() * FUN_DESI_ALIASES.length)];
    input.value = random;
  }
}

async function handleOnboardingSubmit(e) {
  e.preventDefault();
  const roomCodeOrDomain = document.getElementById('onboard-room-input').value.trim();
  const identifier = document.getElementById('onboard-identifier-input').value.trim();
  const alias = document.getElementById('onboard-alias-input').value.trim();

  if (!roomCodeOrDomain) {
    showToast('Input Required', 'Please provide an Organisation Code or Domain.', '⚠️');
    return;
  }

  try {
    const res = await fetch('/api/auth/join-room', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgCodeOrDomain: roomCodeOrDomain,
        identifier: identifier,
        alias: alias
      })
    });

    const data = await res.json();
    if (!res.ok) {
      showToast('Join Error', data.error || 'Failed to enter workspace room.', '❌');
      return;
    }

    state.organization = data.organization;
    state.currentUser = data.user;
    state.activeDomain = data.organization.domain;

    // Persist room credentials to localStorage
    localStorage.setItem('ryw_room_code', data.organization.code);
    localStorage.setItem('ryw_org_id', data.organization.id);
    localStorage.setItem('ryw_alias', data.user.alias);

    closeOnboardingModal();
    showToast('Workspace Room Unlocked', `Joined ${data.organization.name} (${data.organization.code})!`, '🏢');

    await fetchInitialData();
  } catch (err) {
    console.error('Join room error:', err);
    showToast('Network Error', 'Could not connect to room server.', '⚠️');
  }
}

function toggleRoomMenu() {
  const menu = document.getElementById('room-dropdown');
  if (!menu) return;
  menu.classList.toggle('hidden');

  if (!menu.classList.contains('hidden')) {
    const list = document.getElementById('room-dropdown-list');
    if (list && state.availableRooms.length > 0) {
      list.innerHTML = state.availableRooms.map(r => {
        const isActive = r.id === state.organization.id;
        return `
          <button onclick="switchRoom('${r.code || r.domain}')" class="w-full text-left px-2.5 py-2 rounded-lg hover:bg-slate-800 flex items-center justify-between transition ${isActive ? 'bg-slate-800/70 border border-orange-500/30' : 'text-slate-300'}">
            <div>
              <span class="font-bold text-white block">${escapeHTML(r.name)}</span>
              <span class="text-[10px] text-slate-400 font-mono">${escapeHTML(r.code || r.domain)}</span>
            </div>
            <span class="${isActive ? 'text-orange-400 font-bold' : 'text-slate-500'} text-[11px] font-mono">
              ${isActive ? 'Active Room' : 'Switch'}
            </span>
          </button>
        `;
      }).join('');
    }
  }
}

async function switchRoom(codeOrDomain) {
  try {
    const res = await fetch('/api/auth/switch-domain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: codeOrDomain })
    });
    const data = await res.json();
    if (data.success) {
      state.organization = data.organization;
      if (data.currentUser) state.currentUser = data.currentUser;
      state.activeDomain = data.organization.domain;

      localStorage.setItem('ryw_room_code', data.organization.code);
      localStorage.setItem('ryw_org_id', data.organization.id);

      const menu = document.getElementById('room-dropdown');
      if (menu) menu.classList.add('hidden');

      showToast('Switched Workspace', `Active Room: ${data.organization.name}`, '🏢');
      await fetchInitialData();
    }
  } catch (err) {
    console.error('Switch room error:', err);
  }
}

// -------------------------------------------------------------
// Responsive Collapsible Sidebars for Tablet & Mobile (Step 4)
// -------------------------------------------------------------
function toggleMobileDrawer(side) {
  const left = document.getElementById('sidebar-left');
  const right = document.getElementById('sidebar-right');
  const backdrop = document.getElementById('drawer-backdrop');

  if (side === 'left') {
    if (right) right.classList.remove('drawer-open');
    if (left) {
      left.classList.toggle('drawer-open');
      if (left.classList.contains('drawer-open')) {
        backdrop.classList.remove('hidden');
        lockScroll();
      } else {
        backdrop.classList.add('hidden');
        unlockScroll();
      }
    }
  } else if (side === 'right') {
    if (left) left.classList.remove('drawer-open');
    if (right) {
      right.classList.toggle('drawer-open');
      if (right.classList.contains('drawer-open')) {
        backdrop.classList.remove('hidden');
        lockScroll();
      } else {
        backdrop.classList.add('hidden');
        unlockScroll();
      }
    }
  }
}

function closeAllDrawers() {
  const left = document.getElementById('sidebar-left');
  const right = document.getElementById('sidebar-right');
  const backdrop = document.getElementById('drawer-backdrop');
  if (left) left.classList.remove('drawer-open');
  if (right) right.classList.remove('drawer-open');
  if (backdrop) backdrop.classList.add('hidden');
  unlockScroll();
}

// -------------------------------------------------------------
// View Routing & Navigation
// -------------------------------------------------------------
function navigateTo(tabName) {
  state.activeTab = tabName;

  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.classList.add('hidden');
  });

  const targetPanel = document.getElementById(`view-${tabName}`);
  if (targetPanel) {
    targetPanel.classList.remove('hidden');
  }

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

  if (tabName === 'feed') renderFeed();
  if (tabName === 'directory') renderDirectoryPage();
  if (tabName === 'memes') renderMemeKhazana();
}

// -------------------------------------------------------------
// View Renderers
// -------------------------------------------------------------
function renderAllViews() {
  renderTargetBoard();
  renderStudioTemplates();
  renderColleagueSelectDropdown();
  renderFeed();
  renderWhispers();
  renderPoll();
  renderLeaderboard();
  renderDirectoryPage();
  renderMemeKhazana();
}

function renderTargetBoard() {
  const container = document.getElementById('quick-targets-list');
  if (!container) return;

  let filtered = state.colleagues;
  if (state.quickDeptFilter !== 'All') {
    filtered = filtered.filter(c => c.department.toLowerCase().includes(state.quickDeptFilter.toLowerCase()));
  }

  const query = (document.getElementById('quick-target-search')?.value || '').toLowerCase();
  if (query) {
    filtered = filtered.filter(c => 
      c.name.toLowerCase().includes(query) || 
      c.handle.toLowerCase().includes(query) || 
      (c.quirk && c.quirk.toLowerCase().includes(query))
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div class="text-xs text-slate-500 p-4 text-center">No colleagues found in this department.</div>`;
    return;
  }

  container.innerHTML = filtered.map(c => `
    <div class="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-orange-500/40 transition flex items-center justify-between group">
      <div class="flex items-center gap-2.5 min-w-0">
        <div class="w-9 h-9 rounded-xl bg-orange-600/90 flex items-center justify-center text-base shadow shrink-0">
          ${c.avatar || '👓'}
        </div>
        <div class="truncate">
          <div class="flex items-center gap-1.5">
            <h4 class="font-bold text-xs text-white truncate">${escapeHTML(c.name)}</h4>
            <span class="text-[9px] font-mono bg-slate-800 text-amber-300 px-1 rounded">${escapeHTML(c.designation)}</span>
          </div>
          <p class="text-[10px] text-slate-400 truncate mt-0.5">${escapeHTML(c.quirk || c.statusNote || '')}</p>
        </div>
      </div>
      <div class="flex items-center gap-1 shrink-0 ml-2">
        <button onclick="targetColleagueInStudio('${c.id}')" title="Target in Meme Studio" class="p-1.5 rounded-lg bg-slate-800 hover:bg-orange-600 text-amber-400 hover:text-white text-xs transition">
          🎯
        </button>
        <button onclick="openColleagueModal('${c.id}')" title="View Profile & Roasts" class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs transition">
          👁️
        </button>
      </div>
    </div>
  `).join('');
}

function renderStudioTemplates() {
  const container = document.getElementById('studio-template-strip');
  if (!container) return;

  const previewList = state.memes.slice(0, 3);
  container.innerHTML = previewList.map(m => `
    <button type="button" onclick="selectStudioMeme('${m.id}')" class="border ${state.selectedStudioMeme?.id === m.id ? 'border-amber-400 ring-2 ring-amber-400/30' : 'border-slate-700'} bg-slate-900 p-1.5 rounded-xl text-left hover:border-amber-400 transition flex flex-col items-center group">
      <div class="w-full h-12 rounded-lg overflow-hidden relative bg-slate-950">
        <img src="${m.imageUrl}" class="w-full h-full object-cover group-hover:scale-105 transition" alt="${escapeHTML(m.title)}"/>
      </div>
      <span class="text-[10px] font-semibold text-amber-300 mt-1 truncate w-full text-center">${escapeHTML(m.title)}</span>
    </button>
  `).join('');
}

function renderColleagueSelectDropdown() {
  const select = document.getElementById('colleagueDedicationSelect');
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = `
    <option value="">-- General Watercooler Roast (No Target) --</option>
    ${state.colleagues.map(c => `
      <option value="${c.id}">${escapeHTML(c.name)} (${escapeHTML(c.designation)})</option>
    `).join('')}
  `;
  if (currentVal) select.value = currentVal;
}

// -------------------------------------------------------------
// Live Feed with Settings Filtering & Fixed Aspect Ratio (Steps 3 & 4)
// -------------------------------------------------------------
function renderFeed() {
  const container = document.getElementById('posts-feed-container');
  if (!container) return;

  let postsToDisplay = [...state.posts];

  // Apply Settings Trope Muting Filters
  if (state.settings.contentFilter.filterAppraisals) {
    postsToDisplay = postsToDisplay.filter(p => {
      const text = `${p.content || ''} ${p.roastSubject || ''} ${(p.tags || []).join(' ')}`.toLowerCase();
      return !text.includes('appraisal') && !text.includes('salary') && !text.includes('hike');
    });
  }

  if (state.settings.contentFilter.filterFood) {
    postsToDisplay = postsToDisplay.filter(p => {
      const text = `${p.content || ''} ${p.roastSubject || ''} ${(p.tags || []).join(' ')}`.toLowerCase();
      return !text.includes('samosa') && !text.includes('food') && !text.includes('canteen') && !text.includes('cafeteria');
    });
  }

  if (state.settings.contentFilter.filterFriday) {
    postsToDisplay = postsToDisplay.filter(p => {
      const text = `${p.content || ''} ${p.roastSubject || ''} ${(p.tags || []).join(' ')}`.toLowerCase();
      return !text.includes('friday') && !text.includes('5:58') && !text.includes('prod deploy');
    });
  }

  if (postsToDisplay.length === 0) {
    container.innerHTML = `
      <div class="bg-surface-card border border-slate-800 rounded-2xl p-10 text-center space-y-3">
        <span class="text-4xl">☕</span>
        <h3 class="font-heading font-bold text-lg text-white">Quiet at the Watercooler...</h3>
        <p class="text-xs text-slate-400 max-w-sm mx-auto">
          No banter found matching your current filter. Fire the first anonymous roast from the studio above!
        </p>
      </div>
    `;
    return;
  }

  container.innerHTML = postsToDisplay.map((p, index) => {
    const isNew = index === 0 && p.timestamp === 'Just now';
    const memeData = p.meme || (p.meme_template_id ? {
      imageUrl: state.memes.find(m => m.id === p.meme_template_id)?.imageUrl || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=800',
      topText: p.top_text || '',
      bottomText: p.bottom_text || '',
      title: 'Meme Roast'
    } : null);

    const targetLabel = p.target_user_name || p.targetColleagueName;
    const authorLabel = p.author_alias || p.maskedAuthor || 'Incognito Biryani';

    return `
      <article class="bg-surface-card border border-slate-800 rounded-2xl p-5 md:p-6 shadow-md transition hover:border-slate-700 relative overflow-hidden ${isNew ? 'animate-post-enter border-orange-500/50' : ''}">
        
        <!-- Post Header -->
        <div class="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/80">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-xl shadow shrink-0">
              ${p.avatarIcon || (memeData ? '🎬' : '🌶️')}
            </div>
            <div class="truncate">
              <div class="flex items-center gap-2 flex-wrap">
                <span class="font-heading font-black text-sm text-white">${escapeHTML(authorLabel)}</span>
                <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 border border-emerald-500/30 text-emerald-400 font-bold">100% Masked</span>
                ${p.spiciness_level ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-mono bg-orange-950 text-orange-400 font-bold uppercase">${p.spiciness_level}</span>` : ''}
              </div>
              <span class="text-[11px] font-mono text-slate-400 mt-0.5 block">${escapeHTML(p.timestamp || 'Recent')}</span>
            </div>
          </div>

          <div class="flex items-center gap-1.5">
            <button onclick="openReportModal('${p.id}')" class="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800 transition text-xs" title="Report Roast">
              🚩
            </button>
          </div>
        </div>

        <!-- Target Colleague Banner -->
        ${targetLabel ? `
          <div class="mb-3 p-2.5 rounded-xl bg-slate-900/80 border border-amber-500/30 flex items-center justify-between text-xs">
            <div class="flex items-center gap-2 text-slate-200">
              <span class="text-amber-400 font-bold">🎯 Targeted At:</span>
              <span class="font-bold text-white font-heading">${escapeHTML(targetLabel)}</span>
            </div>
            <span class="text-[10px] font-mono text-amber-400 font-semibold">+15 Masala Score</span>
          </div>
        ` : ''}

        <!-- Roast Subject & Content -->
        ${p.roastSubject ? `
          <h3 class="font-heading font-bold text-base text-white mb-2">${escapeHTML(p.roastSubject)}</h3>
        ` : ''}
        
        ${p.content ? `
          <p class="text-xs text-slate-200 leading-relaxed font-sans mb-3">${escapeHTML(p.content)}</p>
        ` : ''}

        <!-- Fixed Aspect Ratio Meme Card (Step 4 Fix: Never overflows borders) -->
        ${memeData && memeData.imageUrl ? `
          <div class="meme-aspect-container w-full border border-slate-700/80 my-3 shadow-lg">
            <img src="${memeData.imageUrl}" alt="${escapeHTML(memeData.title || 'Meme')}" loading="lazy"/>
            <div class="absolute inset-0 bg-black/20 pointer-events-none"></div>

            ${memeData.topText ? `
              <div class="meme-text-top">
                <p class="meme-overlay-text">${escapeHTML(memeData.topText)}</p>
              </div>
            ` : ''}

            ${memeData.bottomText ? `
              <div class="meme-text-bottom">
                <p class="meme-overlay-text">${escapeHTML(memeData.bottomText)}</p>
              </div>
            ` : ''}
          </div>
        ` : ''}

        <!-- Tags Strip -->
        ${p.tags && p.tags.length > 0 ? `
          <div class="flex flex-wrap gap-1.5 my-3">
            ${p.tags.map(t => `<span class="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-900 text-slate-400 border border-slate-800">#${escapeHTML(t)}</span>`).join('')}
          </div>
        ` : ''}

        <!-- Reaction Buttons & Counters -->
        <div class="pt-3 border-t border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs">
          <div class="flex items-center gap-1.5">
            <button onclick="reactPost('${p.id}', 'roasts')" class="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-orange-600/20 text-slate-200 hover:text-orange-400 border border-slate-800 transition flex items-center gap-1.5 font-bold">
              <span>🔥</span> <span>${p.reactions?.roasts || 0}</span>
            </button>
            <button onclick="reactPost('${p.id}', 'masala')" class="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-amber-600/20 text-slate-200 hover:text-amber-400 border border-slate-800 transition flex items-center gap-1.5 font-bold">
              <span>😂</span> <span>${p.reactions?.masala || 0}</span>
            </button>
            <button onclick="reactPost('${p.id}', 'chai')" class="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-emerald-600/20 text-slate-200 hover:text-emerald-400 border border-slate-800 transition flex items-center gap-1.5 font-bold">
              <span>☕</span> <span>${p.reactions?.chai || 0}</span>
            </button>
            <button onclick="reactPost('${p.id}', 'salty')" class="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-purple-600/20 text-slate-200 hover:text-purple-400 border border-slate-800 transition flex items-center gap-1.5 font-bold">
              <span>🧂</span> <span>${p.reactions?.salty || 0}</span>
            </button>
          </div>

          <button onclick="focusCommentInput('${p.id}')" class="text-xs font-mono text-slate-400 hover:text-white flex items-center gap-1">
            <span>💬</span> <span>${(p.comments || []).length} Comments</span>
          </button>
        </div>

        <!-- Inline Comments Strip -->
        <div class="mt-3 pt-3 border-t border-slate-800/60 space-y-2">
          ${(p.comments || []).map(comm => `
            <div class="p-2 rounded-lg bg-slate-950/80 border border-slate-800/60 text-xs">
              <span class="font-bold text-amber-400 font-heading">${escapeHTML(comm.author || 'Anonymous')}:</span>
              <span class="text-slate-300 ml-1">${escapeHTML(comm.text)}</span>
            </div>
          `).join('')}

          <!-- Comment Input -->
          <div class="flex gap-2 pt-1">
            <input id="comment-input-${p.id}" class="flex-1 bg-slate-950 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none" placeholder="Add witty reply..."/>
            <button onclick="submitInlineComment('${p.id}')" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg font-bold">Reply</button>
          </div>
        </div>

      </article>
    `;
  }).join('');
}

// -------------------------------------------------------------
// Dynamic Meme Studio Handlers (Step 3 Requirement)
// -------------------------------------------------------------
function selectStudioMeme(memeId) {
  const meme = state.memes.find(m => m.id === memeId);
  if (!meme) return;
  state.selectedStudioMeme = meme;

  document.getElementById('canvasPreviewImg').src = meme.imageUrl;
  document.getElementById('memeTopInput').value = meme.defaultTop || '';
  document.getElementById('memeBottomInput').value = meme.defaultBottom || '';

  renderStudioTemplates();
  updateLiveCanvasPreview();
}

function updateLiveCanvasPreview() {
  const topText = document.getElementById('memeTopInput').value;
  const bottomText = document.getElementById('memeBottomInput').value;

  document.getElementById('canvasTopText').textContent = topText.toUpperCase();
  document.getElementById('canvasBottomText').textContent = bottomText.toUpperCase();

  // Run real-time decency validation on canvas text
  checkDecencyLive(`${topText} ${bottomText}`);
}

function targetColleagueInStudio(colleagueId) {
  const select = document.getElementById('colleagueDedicationSelect');
  if (select) {
    select.value = colleagueId;
  }
  closeAllDrawers();
  navigateTo('feed');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetStudioInputs() {
  document.getElementById('memeTopInput').value = state.selectedStudioMeme?.defaultTop || '';
  document.getElementById('memeBottomInput').value = state.selectedStudioMeme?.defaultBottom || '';
  document.getElementById('roastCaptionInput').value = '';
  document.getElementById('colleagueDedicationSelect').value = '';
  updateLiveCanvasPreview();
  hideDecencyBanner();
}

// -------------------------------------------------------------
// HR Decency Engine Client Intercept (Step 3 Requirement)
// -------------------------------------------------------------
function checkDecencyLive(text) {
  if (!text) {
    hideDecencyBanner();
    return true;
  }

  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const words = normalized.split(/\s+/).filter(Boolean);
  const flagged = [];

  for (const banned of CLIENT_BANNED_WORDS) {
    if (banned.includes(' ')) {
      if (normalized.includes(banned)) flagged.push(banned);
    } else {
      if (words.includes(banned) || normalized.includes(` ${banned} `) || normalized.startsWith(`${banned} `) || normalized.endsWith(` ${banned}`)) {
        flagged.push(banned);
      }
    }
  }

  if (flagged.length > 0) {
    showDecencyBanner(`Decency Engine Intercept: Prohibited or toxic language detected (${flagged.join(', ')}). Please align with workplace decency guidelines.`, flagged);
    const fireBtn = document.getElementById('fire-roast-btn');
    if (fireBtn) fireBtn.disabled = true;
    return false;
  } else {
    hideDecencyBanner();
    const fireBtn = document.getElementById('fire-roast-btn');
    if (fireBtn) fireBtn.disabled = false;
    return true;
  }
}

function showDecencyBanner(reason, flaggedWords = []) {
  const banner = document.getElementById('decency-intercept-banner');
  const msg = document.getElementById('decency-banner-msg');
  if (banner && msg) {
    msg.textContent = reason;
    banner.classList.remove('hidden');
    banner.classList.remove('intercept-shake');
    void banner.offsetWidth; // Trigger reflow for re-animation
    banner.classList.add('intercept-shake');
  }
}

function hideDecencyBanner() {
  const banner = document.getElementById('decency-intercept-banner');
  if (banner) {
    banner.classList.add('hidden');
  }
}

// -------------------------------------------------------------
// Submit Roast with Instant Live Feed Prepending (Step 3)
// -------------------------------------------------------------
async function submitRoast() {
  const topText = document.getElementById('memeTopInput').value.trim();
  const bottomText = document.getElementById('memeBottomInput').value.trim();
  const content = document.getElementById('roastCaptionInput').value.trim();
  const colleagueSelect = document.getElementById('colleagueDedicationSelect');
  const targetColleagueId = colleagueSelect ? colleagueSelect.value : null;

  const targetColleague = targetColleagueId 
    ? state.colleagues.find(c => c.id === targetColleagueId) 
    : null;

  // Client-side HR Decency Check
  const fullText = `${topText} ${bottomText} ${content}`;
  if (!checkDecencyLive(fullText)) {
    showToast('Decency Intercept', 'Please resolve flagged toxic keywords before firing roast.', '⚠️');
    return;
  }

  const memePayload = state.selectedStudioMeme ? {
    templateId: state.selectedStudioMeme.id,
    title: state.selectedStudioMeme.title,
    topText: topText,
    bottomText: bottomText,
    imageUrl: state.selectedStudioMeme.imageUrl
  } : null;

  const postPayload = {
    org_id: state.organization.id,
    author_alias: state.currentUser.alias || 'Incognito Biryani #404',
    target_user_id: targetColleagueId || null,
    targetColleagueId: targetColleagueId || null,
    target_user_name: targetColleague ? `${targetColleague.name} (${targetColleague.designation})` : null,
    targetColleagueName: targetColleague ? `${targetColleague.name} (${targetColleague.designation})` : null,
    meme_template_id: state.selectedStudioMeme ? state.selectedStudioMeme.id : null,
    top_text: topText,
    bottom_text: bottomText,
    karma_points: 25,
    spiciness_level: state.settings.contentFilter.spicinessLevel || 'bold',
    roastSubject: targetColleague ? `Dedicated Roast to ${targetColleague.name}` : 'Watercooler Roast',
    content: content || (topText && bottomText ? `${topText} — ${bottomText}` : 'Workplace banter'),
    meme: memePayload,
    tags: ['WorkplaceRoast', 'DesiStudio', state.organization.code || 'Banter']
  };

  try {
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-org-id': state.organization.id
      },
      body: JSON.stringify(postPayload)
    });

    const data = await res.json();
    if (!res.ok) {
      if (data.error === 'DECENCY_INTERCEPT') {
        showDecencyBanner(data.reason, data.flaggedWords);
      } else {
        showToast('Error', data.error || 'Failed to post roast.', '❌');
      }
      return;
    }

    // Instantly prepend to state.posts array (Optimistic UI Update)
    state.posts.unshift(data.post);

    // Bump target colleague roast counter in local state
    if (targetColleague) {
      targetColleague.roastCount = (targetColleague.roastCount || 0) + 1;
    }

    // Bump user karma
    state.currentUser.karma = (state.currentUser.karma || 100) + 15;
    updateHeaderUI();

    // Re-render feed and reset studio
    renderFeed();
    resetStudioInputs();

    // Dynamically update Masala Hall of Fame
    await fetchLeaderboardData();

    showToast('Roast Fired!', `Posted anonymously to ${state.organization.name} live feed!`, '🚀');

    // Scroll smoothly to top of live feed
    const feedHeader = document.getElementById('posts-feed-container');
    if (feedHeader) {
      feedHeader.scrollIntoView({ behavior: 'smooth' });
    }
  } catch (err) {
    console.error('Post submit error:', err);
    showToast('Network Error', 'Could not deliver roast to room.', '⚠️');
  }
}

// -------------------------------------------------------------
// Post Reactions & Inline Comments (Strict Room Guard)
// -------------------------------------------------------------
async function reactPost(postId, type) {
  try {
    const res = await fetch(`/api/posts/${postId}/react`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-org-id': state.organization.id
      },
      body: JSON.stringify({ type })
    });
    const data = await res.json();
    if (data.success) {
      const post = state.posts.find(p => p.id === postId);
      if (post) {
        post.reactions = data.reactions;
        renderFeed();
      }
      // Dynamically update leaderboard when reactions change
      fetchLeaderboardData();
    }
  } catch (e) {
    console.error('Reaction error:', e);
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
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  if (!checkDecencyLive(text)) {
    showToast('Decency Alert', 'Comment contains flagged abusive words.', '⚠️');
    return;
  }

  try {
    const res = await fetch(`/api/posts/${postId}/comment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-org-id': state.organization.id
      },
      body: JSON.stringify({ text })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast('Blocked', data.reason || 'Comment not permitted.', '❌');
      return;
    }

    const post = state.posts.find(p => p.id === postId);
    if (post) {
      post.comments = data.comments;
      renderFeed();
    }
    input.value = '';
    showToast('Comment Added', 'Your anonymous reply was posted.', '💬');
  } catch (e) {
    console.error('Comment error:', e);
  }
}

// -------------------------------------------------------------
// Chai-Sutta Whispers (Ephemeral Feed with 2-Hour Auto-TTL)
// -------------------------------------------------------------
function renderWhispers() {
  const container = document.getElementById('whispers-list');
  if (!container) return;

  if (state.whispers.length === 0) {
    container.innerHTML = `<div class="text-[11px] text-slate-500 py-3 text-center">No active whispers. Drop anonymous watercooler gossip!</div>`;
    return;
  }

  container.innerHTML = state.whispers.map(w => {
    const minutesLeft = w.ttl_minutes_left !== undefined ? w.ttl_minutes_left : 120;
    const hoursLeft = Math.floor(minutesLeft / 60);
    const remMins = minutesLeft % 60;
    const ttlString = hoursLeft > 0 ? `${hoursLeft}h ${remMins}m left` : `${remMins}m left`;

    return `
      <div class="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1">
        <div class="flex items-center justify-between text-[10px] font-mono">
          <span class="text-amber-400 font-bold">${escapeHTML(w.author_alias || w.author || 'Anonymous')}</span>
          <span class="px-1.5 py-0.5 rounded bg-amber-950/70 border border-amber-500/30 text-amber-300 font-semibold" title="2-Hour Auto-Destruct TTL">
            ⏱️ ${ttlString}
          </span>
        </div>
        <p class="text-slate-200 text-xs leading-snug">${escapeHTML(w.text)}</p>
      </div>
    `;
  }).join('');
}

async function postWhisper() {
  const input = document.getElementById('quickWhisperInput');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  if (!checkDecencyLive(text)) {
    showToast('Decency Intercept', 'Whisper contains toxic words.', '⚠️');
    return;
  }

  try {
    const res = await fetch('/api/whispers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-org-id': state.organization.id
      },
      body: JSON.stringify({ text })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast('Blocked', data.reason || 'Whisper rejected by moderation.', '❌');
      return;
    }

    state.whispers.unshift(data.whisper);
    renderWhispers();
    input.value = '';
    showToast('Whisper Sent', 'Auto-destructs in 2 hours.', '☕');
  } catch (e) {
    console.error('Whisper post error:', e);
  }
}

// -------------------------------------------------------------
// Chai Tapri Poll (Step 2: Persistent Voting)
// -------------------------------------------------------------
function renderPoll() {
  const qEl = document.getElementById('poll-question-text');
  const badge = document.getElementById('poll-votes-badge');
  const optContainer = document.getElementById('poll-options-container');

  if (!state.poll || !optContainer) return;

  if (qEl) qEl.textContent = state.poll.question || 'Quick Poll';
  if (badge) badge.textContent = `${state.poll.total_votes || 0} Voted`;

  const hasVoted = state.poll.has_voted;
  const userChoice = state.poll.user_choice;

  optContainer.innerHTML = (state.poll.options || []).map((opt, i) => {
    const isSelected = userChoice === opt.id;
    return `
      <button onclick="votePoll('${opt.id}')" class="w-full text-left p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border ${isSelected ? 'border-amber-400 bg-amber-950/20' : 'border-slate-800'} text-slate-200 transition relative overflow-hidden group">
        <!-- Progress Bar Background Fill -->
        <div class="absolute inset-0 bg-amber-500/10 pointer-events-none" style="width: ${opt.pct || 0}%"></div>
        <div class="relative z-10 flex items-center justify-between text-xs font-mono">
          <span class="flex items-center gap-1.5 truncate">
            <span>${i + 1}.</span> 
            <span class="truncate">${escapeHTML(opt.text)}</span>
            ${isSelected ? '<span class="text-emerald-400 text-xs font-bold">✓</span>' : ''}
          </span>
          <span class="text-amber-400 font-bold ml-2 shrink-0">${opt.pct || 0}%</span>
        </div>
      </button>
    `;
  }).join('');
}

async function votePoll(optionId) {
  if (!state.poll) return;

  try {
    const res = await fetch(`/api/polls/${state.poll.id}/vote`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-org-id': state.organization.id
      },
      body: JSON.stringify({ option_id: optionId })
    });
    const data = await res.json();
    if (data.success) {
      state.poll.options = data.options;
      state.poll.total_votes = data.total_votes;
      state.poll.has_voted = true;
      state.poll.user_choice = data.user_choice;
      renderPoll();
      showToast('Vote Recorded', 'Your Chai Tapri poll vote is saved!', '📊');
    }
  } catch (e) {
    console.error('Vote error:', e);
  }
}

// -------------------------------------------------------------
// Dynamic Masala Hall of Fame Leaderboard (Step 2)
// -------------------------------------------------------------
async function fetchLeaderboardData() {
  try {
    const res = await fetch(`/api/leaderboard?orgId=${state.organization.id}`, {
      headers: { 'x-org-id': state.organization.id }
    });
    const data = await res.json();
    if (data.leaderboard) {
      state.leaderboard = data.leaderboard;
      renderLeaderboard();
    }
  } catch (e) {
    console.error('Leaderboard error:', e);
  }
}

function renderLeaderboard() {
  const container = document.getElementById('hall-of-fame-list');
  if (!container) return;

  if (state.leaderboard.length === 0) {
    container.innerHTML = `<div class="text-xs text-slate-500 py-2 text-center">Banter just started. Fire roasts to crown leaders!</div>`;
    return;
  }

  // Display top 3
  const topColleagues = state.leaderboard.slice(0, 3);
  container.innerHTML = topColleagues.map((item, idx) => {
    const borders = [
      'border-amber-500/40 bg-slate-900',
      'border-slate-700 bg-slate-900',
      'border-slate-800 bg-slate-900'
    ];
    const badgeColors = [
      'bg-amber-400/20 text-amber-300',
      'bg-orange-500/20 text-orange-300',
      'bg-emerald-500/20 text-emerald-300'
    ];

    return `
      <div class="p-2.5 rounded-xl border ${borders[idx] || 'border-slate-800 bg-slate-900'} flex items-center justify-between">
        <div class="flex items-center gap-2 truncate">
          <span class="text-lg shrink-0">${item.trophy || '⭐'}</span>
          <div class="truncate">
            <h4 class="font-bold text-white font-heading truncate">${escapeHTML(item.name)}</h4>
            <span class="text-[10px] text-slate-400 font-mono">${item.roastCount} Roasts • ${item.totalReactions || 0} Reactions</span>
          </div>
        </div>
        <span class="px-2 py-0.5 rounded font-mono text-[10px] font-bold shrink-0 ml-2 ${badgeColors[idx] || 'bg-slate-800 text-slate-300'}">
          ${escapeHTML(item.badge)}
        </span>
      </div>
    `;
  }).join('');
}

// -------------------------------------------------------------
// Colleague Profile Modal & Reporting (SCR-03)
// -------------------------------------------------------------
async function openColleagueModal(colleagueId) {
  const colleague = state.colleagues.find(c => c.id === colleagueId);
  if (!colleague) return;
  state.activeColleague = colleague;

  document.getElementById('modal-colleague-name').textContent = colleague.name;
  document.getElementById('modal-colleague-avatar').textContent = colleague.avatar || '👓';
  document.getElementById('modal-colleague-dept').textContent = `${colleague.department} • ${colleague.designation}`;
  document.getElementById('modal-colleague-quirk').textContent = colleague.quirk || colleague.statusNote || '';
  document.getElementById('composer-target-name').textContent = colleague.name;

  try {
    const res = await fetch(`/api/directory/${colleagueId}?orgId=${state.organization.id}`, {
      headers: { 'x-org-id': state.organization.id }
    });
    const data = await res.json();
    const roasts = data.roasts || [];
    const list = document.getElementById('modal-roasts-list');
    if (list) {
      if (roasts.length === 0) {
        list.innerHTML = `<div class="p-4 rounded-xl bg-slate-950 text-xs text-slate-400 text-center">No roasts targeted at ${escapeHTML(colleague.name)} yet. Be the first!</div>`;
      } else {
        list.innerHTML = roasts.map(r => `
          <div class="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1.5">
            <div class="flex justify-between items-center text-[10px] font-mono text-slate-400">
              <span class="font-bold text-amber-400">${escapeHTML(r.author_alias || r.maskedAuthor || 'Anonymous')}</span>
              <span>${escapeHTML(r.timestamp || 'Recent')}</span>
            </div>
            <p class="text-slate-200">${escapeHTML(r.content)}</p>
          </div>
        `).join('');
      }
    }
  } catch (e) {
    console.error('Fetch colleague roasts error:', e);
  }

  const modal = document.getElementById('colleague-profile-modal');
  if (modal) {
    modal.classList.remove('hidden');
    lockScroll();
  }
}

function closeColleagueModal() {
  const modal = document.getElementById('colleague-profile-modal');
  if (modal) {
    modal.classList.add('hidden');
    unlockScroll();
  }
}

function openMemePickerForModal() {
  if (state.memes.length > 0) {
    state.modalAttachedMeme = state.memes[0];
    const box = document.getElementById('modalAttachedMemeBox');
    const title = document.getElementById('modalAttachedMemeTitle');
    const punch = document.getElementById('modalAttachedMemePunchline');
    if (box && title && punch) {
      title.textContent = state.modalAttachedMeme.title;
      punch.textContent = `${state.modalAttachedMeme.defaultTop} / ${state.modalAttachedMeme.defaultBottom}`;
      box.classList.remove('hidden');
    }
  }
}

function detachModalMeme() {
  state.modalAttachedMeme = null;
  const box = document.getElementById('modalAttachedMemeBox');
  if (box) box.classList.add('hidden');
}

async function submitModalRoast() {
  if (!state.activeColleague) return;
  const textInput = document.getElementById('modalRoastText');
  const text = textInput ? textInput.value.trim() : '';

  if (!text && !state.modalAttachedMeme) {
    showToast('Input Required', 'Write a roast or attach a meme.', '⚠️');
    return;
  }

  if (!checkDecencyLive(text)) {
    showToast('Decency Intercept', 'Text contains prohibited language.', '⚠️');
    return;
  }

  const payload = {
    org_id: state.organization.id,
    target_user_id: state.activeColleague.id,
    targetColleagueId: state.activeColleague.id,
    target_user_name: `${state.activeColleague.name} (${state.activeColleague.designation})`,
    targetColleagueName: `${state.activeColleague.name} (${state.activeColleague.designation})`,
    roastSubject: `Roast on ${state.activeColleague.name}`,
    content: text,
    meme: state.modalAttachedMeme ? {
      templateId: state.modalAttachedMeme.id,
      title: state.modalAttachedMeme.title,
      topText: state.modalAttachedMeme.defaultTop,
      bottomText: state.modalAttachedMeme.defaultBottom,
      imageUrl: state.modalAttachedMeme.imageUrl
    } : null
  };

  try {
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-org-id': state.organization.id
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      state.posts.unshift(data.post);
      state.activeColleague.roastCount = (state.activeColleague.roastCount || 0) + 1;
      textInput.value = '';
      detachModalMeme();
      closeColleagueModal();
      renderFeed();
      await fetchLeaderboardData();
      showToast('Roast Posted', `Roasted ${state.activeColleague.name} anonymously!`, '🔥');
    }
  } catch (e) {
    console.error('Modal roast error:', e);
  }
}

// -------------------------------------------------------------
// Report Roast Modal
// -------------------------------------------------------------
function openReportModal(postId) {
  state.reportingPostId = postId;
  const modal = document.getElementById('report-modal');
  if (modal) {
    modal.classList.remove('hidden');
    lockScroll();
  }
}

function closeReportModal() {
  state.reportingPostId = null;
  const modal = document.getElementById('report-modal');
  if (modal) {
    modal.classList.add('hidden');
    unlockScroll();
  }
}

async function submitPostReport() {
  if (!state.reportingPostId) return;
  const checked = document.querySelector('input[name="reportReason"]:checked');
  const reason = checked ? checked.value : 'Inappropriate';

  try {
    const res = await fetch(`/api/posts/${state.reportingPostId}/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-org-id': state.organization.id
      },
      body: JSON.stringify({ reason })
    });
    const data = await res.json();
    closeReportModal();
    if (data.quarantined) {
      state.posts = state.posts.filter(p => p.id !== state.reportingPostId);
      renderFeed();
      showToast('Post Quarantined', 'Post exceeded report threshold and was removed.', '🛡️');
    } else {
      showToast('Report Logged', data.message || 'Moderation team notified.', '🚩');
    }
  } catch (e) {
    console.error('Report error:', e);
  }
}

// -------------------------------------------------------------
// Settings Persistence (Step 3 Requirement)
// -------------------------------------------------------------
function loadSavedSettings() {
  try {
    const raw = localStorage.getItem('ryw_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      state.settings = { ...state.settings, ...parsed };
    }
    const savedAlias = localStorage.getItem('ryw_alias');
    if (savedAlias) {
      state.currentUser.alias = savedAlias;
    }
    applySettingsToUI();
  } catch (e) {
    console.error('Error loading settings:', e);
  }
}

function applySettingsToUI() {
  const hideBtn = document.getElementById('toggle-hide-hr');
  if (hideBtn) hideBtn.setAttribute('aria-checked', state.settings.privacy.hideFromManagers ? 'true' : 'false');

  const fakeBtn = document.getElementById('toggle-fake-location');
  if (fakeBtn) fakeBtn.setAttribute('aria-checked', state.settings.privacy.fakeLocation ? 'true' : 'false');

  const unmaskBtn = document.getElementById('toggle-unmask-mode');
  if (unmaskBtn) unmaskBtn.setAttribute('aria-checked', state.settings.privacy.unmaskMode ? 'true' : 'false');

  const slider = document.getElementById('humor-slider');
  if (slider) {
    const map = { mild: 1, medium: 2, bold: 3, nuclear: 4 };
    slider.value = map[state.settings.contentFilter.spicinessLevel] || 3;
    updateHumorLevelBadge(slider.value);
  }

  const fApp = document.getElementById('filter-appraisals');
  if (fApp) fApp.checked = Boolean(state.settings.contentFilter.filterAppraisals);

  const fFood = document.getElementById('filter-food');
  if (fFood) fFood.checked = Boolean(state.settings.contentFilter.filterFood);

  const fFri = document.getElementById('filter-friday');
  if (fFri) fFri.checked = Boolean(state.settings.contentFilter.filterFriday);
}

function toggleSetting(key) {
  state.settings.privacy[key] = !state.settings.privacy[key];
  const btn = document.getElementById(`toggle-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`);
  if (btn) {
    btn.setAttribute('aria-checked', state.settings.privacy[key] ? 'true' : 'false');
  }
  saveSettingsToStorage();
}

function updateHumorLevel(val) {
  const levels = ['mild', 'medium', 'bold', 'nuclear'];
  state.settings.contentFilter.spicinessLevel = levels[val - 1] || 'bold';
  updateHumorLevelBadge(val);
  saveSettingsToStorage();
  renderFeed();
}

function updateHumorLevelBadge(val) {
  const badge = document.getElementById('spice-level-badge');
  const labels = ['Mild Chai ☕', 'Medium 🌶️', 'Bold & Spicy 🔥', 'Nuclear 💀'];
  if (badge) {
    badge.textContent = labels[val - 1] || 'Bold & Spicy 🔥';
  }
}

function saveTopicFilters() {
  const fApp = document.getElementById('filter-appraisals');
  const fFood = document.getElementById('filter-food');
  const fFri = document.getElementById('filter-friday');

  state.settings.contentFilter.filterAppraisals = fApp ? fApp.checked : false;
  state.settings.contentFilter.filterFood = fFood ? fFood.checked : false;
  state.settings.contentFilter.filterFriday = fFri ? fFri.checked : false;

  saveSettingsToStorage();
  renderFeed();
  showToast('Filters Applied', 'Live feed updated according to your muted topics.', '🛡️');
}

function rollRandomNickname() {
  const random = FUN_DESI_ALIASES[Math.floor(Math.random() * FUN_DESI_ALIASES.length)];
  updateUserAlias(random);
  const input = document.getElementById('settings-alias-input');
  if (input) input.value = random;
}

function updateUserAlias(val) {
  if (!val) return;
  state.currentUser.alias = val.trim();
  localStorage.setItem('ryw_alias', state.currentUser.alias);
  updateHeaderUI();
  saveSettingsToStorage();
}

function saveSettingsToStorage() {
  localStorage.setItem('ryw_settings', JSON.stringify(state.settings));
}

async function saveAllSettings() {
  saveSettingsToStorage();
  try {
    await fetch('/api/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-org-id': state.organization.id
      },
      body: JSON.stringify(state.settings)
    });
    showToast('Saved', 'Preferences saved to secure local storage and synced.', '✓');
  } catch (e) {
    showToast('Saved Locally', 'Saved in local storage.', '✓');
  }
}

// -------------------------------------------------------------
// Directory & Meme Khazana Views
// -------------------------------------------------------------
function renderDirectoryPage() {
  const container = document.getElementById('directory-cards-grid');
  if (!container) return;

  let list = state.colleagues;
  if (state.dirDeptFilter !== 'All') {
    list = list.filter(c => c.department.toLowerCase().includes(state.dirDeptFilter.toLowerCase()));
  }

  const query = (document.getElementById('directory-search-input')?.value || '').toLowerCase();
  if (query) {
    list = list.filter(c => 
      c.name.toLowerCase().includes(query) || 
      c.handle.toLowerCase().includes(query) || 
      (c.quirk && c.quirk.toLowerCase().includes(query)) ||
      (c.designation && c.designation.toLowerCase().includes(query))
    );
  }

  if (list.length === 0) {
    container.innerHTML = `<div class="col-span-full py-8 text-center text-slate-400">No colleagues found.</div>`;
    return;
  }

  container.innerHTML = list.map(c => `
    <div class="bg-surface-card border border-slate-800 rounded-2xl p-5 shadow-md flex flex-col justify-between space-y-4 hover:border-slate-700 transition">
      <div>
        <div class="flex items-center justify-between">
          <div class="w-12 h-12 rounded-xl bg-orange-600 flex items-center justify-center text-2xl shadow">
            ${c.avatar || '👓'}
          </div>
          <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 border border-slate-800 text-amber-300 font-bold">
            ${escapeHTML(c.designation)}
          </span>
        </div>
        <div class="mt-3">
          <h3 class="font-heading font-black text-base text-white">${escapeHTML(c.name)}</h3>
          <span class="text-xs font-mono text-slate-400">${escapeHTML(c.handle)}</span>
          <p class="text-xs text-slate-300 mt-2 line-clamp-2">${escapeHTML(c.quirk || c.statusNote || '')}</p>
        </div>
      </div>
      <div class="pt-3 border-t border-slate-800 flex items-center justify-between">
        <span class="text-xs font-mono text-amber-400 font-bold">${c.roastCount || 0} Roasts Received</span>
        <button onclick="openColleagueModal('${c.id}')" class="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs">
          View & Roast 🌶️
        </button>
      </div>
    </div>
  `).join('');
}

function renderMemeKhazana() {
  const container = document.getElementById('meme-khazana-grid');
  if (!container) return;

  let list = state.memes;
  if (state.khazanaUniverse !== 'All') {
    list = list.filter(m => m.universe.toLowerCase().includes(state.khazanaUniverse.toLowerCase()));
  }

  const query = (document.getElementById('meme-search-input')?.value || '').toLowerCase();
  if (query) {
    list = list.filter(m => 
      m.title.toLowerCase().includes(query) || 
      (m.character && m.character.toLowerCase().includes(query)) ||
      (m.defaultTop && m.defaultTop.toLowerCase().includes(query)) ||
      (m.defaultBottom && m.defaultBottom.toLowerCase().includes(query))
    );
  }

  container.innerHTML = list.map(m => `
    <div class="bg-surface-card border border-slate-800 rounded-2xl p-4 shadow-md flex flex-col justify-between space-y-3">
      <div class="meme-aspect-container w-full border border-slate-700/80">
        <img src="${m.imageUrl}" alt="${escapeHTML(m.title)}" loading="lazy"/>
        <div class="absolute inset-0 bg-black/20 pointer-events-none"></div>
        <div class="meme-text-top"><p class="meme-overlay-text">${escapeHTML(m.defaultTop || '')}</p></div>
        <div class="meme-text-bottom"><p class="meme-overlay-text">${escapeHTML(m.defaultBottom || '')}</p></div>
      </div>
      <div>
        <h4 class="font-heading font-bold text-sm text-white">${escapeHTML(m.title)}</h4>
        <span class="text-[11px] font-mono text-amber-400">${escapeHTML(m.universe)}</span>
      </div>
      <button onclick="useMemeFromKhazana('${m.id}')" class="w-full py-2 rounded-xl bg-slate-800 hover:bg-orange-600 text-slate-200 hover:text-white font-bold text-xs transition">
        Use in Studio 🎬
      </button>
    </div>
  `).join('');
}

function useMemeFromKhazana(memeId) {
  selectStudioMeme(memeId);
  navigateTo('feed');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function setQuickDeptFilter(dept) {
  state.quickDeptFilter = dept;
  document.querySelectorAll('#quick-dept-filters button').forEach(b => {
    b.className = b.textContent.includes(dept) 
      ? 'dept-filter-btn px-2.5 py-1 rounded-lg bg-orange-600 text-white font-semibold'
      : 'dept-filter-btn px-2 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 transition';
  });
  renderTargetBoard();
}

function filterQuickTargets() {
  renderTargetBoard();
}

function setDirectoryDeptFilter(dept) {
  state.dirDeptFilter = dept;
  renderDirectoryPage();
}

function filterDirectoryList() {
  renderDirectoryPage();
}

function setKhazanaUniverse(universe) {
  state.khazanaUniverse = universe;
  document.querySelectorAll('#meme-universe-pills .khazana-pill').forEach(b => {
    b.className = b.textContent.includes(universe)
      ? 'khazana-pill px-3 py-1.5 rounded-full bg-orange-600 text-white text-xs font-mono font-bold whitespace-nowrap'
      : 'khazana-pill px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono font-semibold whitespace-nowrap';
  });
  renderMemeKhazana();
}

function filterMemeKhazana() {
  renderMemeKhazana();
}

function filterStudioMemes(universe) {
  document.querySelectorAll('#studio-universe-pills button').forEach(btn => {
    btn.className = btn.textContent.includes(universe)
      ? 'px-2.5 py-1.5 rounded-lg bg-orange-600 text-white font-semibold text-xs whitespace-nowrap'
      : 'px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs whitespace-nowrap';
  });

  let filtered = state.memes;
  if (universe !== 'All') {
    filtered = filtered.filter(m => m.universe.toLowerCase().includes(universe.toLowerCase()));
  }
  const container = document.getElementById('studio-template-strip');
  if (container) {
    container.innerHTML = filtered.slice(0, 3).map(m => `
      <button type="button" onclick="selectStudioMeme('${m.id}')" class="border ${state.selectedStudioMeme?.id === m.id ? 'border-amber-400 ring-2 ring-amber-400/30' : 'border-slate-700'} bg-slate-900 p-1.5 rounded-xl text-left hover:border-amber-400 transition flex flex-col items-center group">
        <div class="w-full h-12 rounded-lg overflow-hidden relative bg-slate-950">
          <img src="${m.imageUrl}" class="w-full h-full object-cover group-hover:scale-105 transition" alt="${escapeHTML(m.title)}"/>
        </div>
        <span class="text-[10px] font-semibold text-amber-300 mt-1 truncate w-full text-center">${escapeHTML(m.title)}</span>
      </button>
    `).join('');
  }
}

async function filterFeed(filterType) {
  state.feedFilter = filterType;
  document.querySelectorAll('#feed-filter-btns .feed-filter-btn').forEach(btn => {
    const isTarget = (filterType === 'all' && btn.textContent.includes('Spiciest Chai')) ||
      (filterType === 'trending' && btn.textContent.includes('Trending')) ||
      (filterType === 'memes' && btn.textContent.includes('Top Memes'));
    btn.className = isTarget 
      ? 'feed-filter-btn px-2.5 py-1 rounded-lg bg-orange-600 text-white font-semibold'
      : 'feed-filter-btn px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700';
  });

  try {
    const res = await fetch(`/api/posts?orgId=${state.organization.id}&filter=${filterType}`, {
      headers: { 'x-org-id': state.organization.id }
    });
    state.posts = await res.json();
    renderFeed();
  } catch (e) {
    console.error('Filter feed error:', e);
  }
}

// -------------------------------------------------------------
// Utilities
// -------------------------------------------------------------
function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, 
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
  // Click outside room dropdown
  document.addEventListener('click', (e) => {
    const btn = document.getElementById('room-indicator-btn');
    const menu = document.getElementById('room-dropdown');
    if (btn && menu && !btn.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.add('hidden');
    }
  });

  // Escape key closes open modals and drawers
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeColleagueModal();
      closeReportModal();
      closeAllDrawers();
      // Only close onboarding modal if room is already set
      if (state.organization.id) {
        closeOnboardingModal();
      }
    }
  });
}
