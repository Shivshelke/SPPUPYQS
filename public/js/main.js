/**
 * public/js/main.js
 * Public portal — browse, search, download files.
 */

// ── PWA Service Worker Registration ──────────────────────────────────────────
let deferredPrompt;
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .catch(err => console.warn('SW Reg failed', err));
  });
}

// ── PWA Install Popup ─────────────────────────────────────────────────────────
const PWA_DISMISSED_KEY = 'synapse_pwa_dismissed';
const PWA_DISMISS_DAYS = 7;   // show again after 7 days
const PWA_SHOW_DELAY = 3000; // 3 sec after page load
const PWA_AUTO_HIDE = 8000; // auto-hide after 8 sec

let pwaAutoHideTimer = null;
let pwaCountdownTimer = null;

function canShowPwaPopup() {
  const dismissed = localStorage.getItem(PWA_DISMISSED_KEY);
  if (!dismissed) return true;
  const daysSince = (Date.now() - parseInt(dismissed)) / (1000 * 60 * 60 * 24);
  return daysSince >= PWA_DISMISS_DAYS;
}

function showPwaPopup() {
  if (!canShowPwaPopup()) return;
  const popup = document.getElementById('pwaPopup');
  if (!popup) return;

  // iOS detection — show custom instructions
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  const iosMsg = document.getElementById('pwaIosMsg');
  const installBtn = document.getElementById('pwaPopupInstallBtn');
  if (isIOS) {
    if (iosMsg) iosMsg.style.display = 'block';
    if (installBtn) installBtn.style.display = 'none';
  }

  popup.classList.add('pwa-show');

  // Countdown bar animation
  const bar = document.getElementById('pwaCountdownBar');
  if (bar) {
    bar.style.transition = `width ${PWA_AUTO_HIDE}ms linear`;
    bar.style.width = '0%';
  }

  // Auto hide after PWA_AUTO_HIDE ms
  pwaAutoHideTimer = setTimeout(() => hidePwaPopup(false), PWA_AUTO_HIDE);
}

function hidePwaPopup(dismissed = true) {
  const popup = document.getElementById('pwaPopup');
  if (!popup) return;
  clearTimeout(pwaAutoHideTimer);
  popup.classList.remove('pwa-show');
  popup.classList.add('pwa-hide');
  if (dismissed) {
    localStorage.setItem(PWA_DISMISSED_KEY, Date.now().toString());
  }
  setTimeout(() => { popup.classList.remove('pwa-hide'); }, 400);
}

async function pwaInstallClick() {
  if (deferredPrompt) {
    hidePwaPopup(true);
    deferredPrompt.prompt();
    // Handle install outcome if needed
    // console.log('PWA install outcome:', outcome);
    deferredPrompt = null;
  }
}

// Capture the beforeinstallprompt event
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  // Show popup after delay
  setTimeout(showPwaPopup, PWA_SHOW_DELAY);
});

// For iOS — still show the popup after delay
window.addEventListener('load', () => {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if (isIOS && !isInStandaloneMode) {
    setTimeout(showPwaPopup, PWA_SHOW_DELAY);
  }
});

// Already installed
window.addEventListener('appinstalled', () => {
  hidePwaPopup(true);
  deferredPrompt = null;
});

// ── Mobile Menu ──────────────────────────────────────────────────────────────
function toggleMobileMenu() {
  const nav = document.getElementById('navLinks');
  const btn = document.getElementById('hamburger');
  nav.classList.toggle('mobile-open');
  btn.classList.toggle('open');
}
function closeMobileMenu() {
  document.getElementById('navLinks').classList.remove('mobile-open');
  document.getElementById('hamburger').classList.remove('open');
}

// ── Scroll to Top ────────────────────────────────────────────────────────────
window.addEventListener('scroll', () => {
  const btn = document.getElementById('scrollTopBtn');
  if (btn) {
    if (window.scrollY > 300) {
      btn.classList.add('visible');
    } else {
      btn.classList.remove('visible');
    }
  }
});
function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
}


let CONFIG = {};
let currentYear = null;
let currentBranch = null;
let allFiles = [];
let allKeywords = [];
let currentUsername = null;

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

// ── Init ────────────────────────────────────────────────────────────────────
async function init() {
  const seoCrawler = document.getElementById('seo-crawler-content');
  if (seoCrawler) {
    seoCrawler.style.display = 'none';
  }

  // Load Stats independently
  fetch('/api/stats')
    .then(r => r.json())
    .then(stats => {
      if (document.getElementById('statTotal') && stats.total) {
        document.getElementById('statTotal').textContent = stats.total;
      }
      const formatPaperCount = (cnt) => {
        const c = cnt || 0;
        return `${c} ${c === 1 ? 'paper' : 'papers'}`;
      };
      if (document.getElementById('count-first')) document.getElementById('count-first').textContent = formatPaperCount(stats.byYear && stats.byYear.first);
      if (document.getElementById('count-second')) document.getElementById('count-second').textContent = formatPaperCount(stats.byYear && stats.byYear.second);
      if (document.getElementById('count-third')) document.getElementById('count-third').textContent = formatPaperCount(stats.byYear && stats.byYear.third);
      if (document.getElementById('count-fourth')) document.getElementById('count-fourth').textContent = formatPaperCount(stats.byYear && stats.byYear.fourth);
    })
    .catch(e => console.error('Stats load error', e));

  // Load Auth independently
  fetch('/student/status')
    .then(r => r.json())
    .then(authData => {
      currentUsername = authData.username || null;
      const nav = document.getElementById('studentAuthNav');
      if (authData.loggedIn) {
        if (nav) {
          nav.innerHTML = `
            <span style="color:var(--text); font-weight:600; font-size:0.9rem;">Hi, ${escHtml(authData.username)}</span>
            <a href="/my-purchases.html" class="btn-ghost" style="padding:0.4rem 0.8rem; font-size:0.85rem; text-decoration:none;">My Purchases</a>
            <button class="btn-ghost" onclick="doStudentLogout()" style="padding:0.4rem 0.8rem; font-size:0.85rem">Logout</button>
          `;
          nav.style.visibility = 'visible';
        }
        const mobileNavBtn = document.getElementById('mobileAuthNavBtn');
        if (mobileNavBtn) {
          mobileNavBtn.href = '/my-purchases.html';
          mobileNavBtn.innerHTML = `
            <div class="bottom-nav-icon">👤</div>
            <span>Profile</span>
          `;
        }
        const welcome = document.getElementById('premiumWelcomeText');
        if (welcome) welcome.textContent = `Welcome to Premium, ${escHtml(authData.username)}!`;
        isLoggedIn = true;
        isPremiumUser = authData.isPremium || false;
        window.userPremiumStatus = authData.premiumStatus || 'none';
        togglePremiumState();

        const fbNameInput = document.getElementById('fbName');
        if (fbNameInput) fbNameInput.value = authData.username;

        try {
          const pendingSol = sessionStorage.getItem('pendingSolutionUrl');
          if (pendingSol) {
            sessionStorage.removeItem('pendingSolutionUrl');
            setTimeout(() => {
              window.open(pendingSol, '_blank', 'noopener,noreferrer');
            }, 300);
          }
        } catch (e) {}
      } else {
        if (nav) {
          nav.innerHTML = `
            <a href="/student-login.html" class="btn-ghost"
              style="color:var(--accent)!important; border-color:var(--accent)">Login / Sign Up</a>
          `;
          nav.style.visibility = 'visible';
        }
        isLoggedIn = false;
        isPremiumUser = false;
        togglePremiumState();
      }
    })
    .catch(e => {
      console.error('Auth load error', e);
      const nav = document.getElementById('studentAuthNav');
      if (nav) {
        nav.innerHTML = `
          <a href="/student-login.html" class="btn-ghost"
            style="color:var(--accent)!important; border-color:var(--accent)">Login / Sign Up</a>
        `;
        nav.style.visibility = 'visible';
      }
    });

  // Load Config
  try {
    const configRes = await fetch('/api/config');
    CONFIG = await configRes.json();
    populateKeywords();
    await handleUrlRouting();
  } catch (e) { console.error('Config load error', e); }
}

let isRouting = false;

async function handleUrlRouting() {
  if (isRouting) return;
  isRouting = true;

  try {
    const path = window.location.pathname.substring(1);
    if (!path) {
      isRouting = false;
      return;
    }

    const parts = path.split('/').filter(Boolean);
    const yearSlug = parts[0];
    const subjectSlug = parts[1];

    const match = yearSlug.match(/^(first|second|third|fourth|final)-year-(.+)$/);

    if (yearSlug === 'catalog') {
      window.location.reload();
      return;
    }

    if (match) {
      let year = match[1];
      if (year === 'final') year = 'fourth';

      let branchSlug = match[2];
      if (branchSlug === 'fe-engineering') {
        branchSlug = 'fe';
      } else if (branchSlug === 'engineering') {
        branchSlug = null;
      } else if (branchSlug.endsWith('-engineering')) {
        branchSlug = branchSlug.replace(/-engineering$/, '');
      }

      selectYear(year);

      if (year === 'first' || branchSlug === 'fe') {
        if (subjectSlug) {
          let resolvedSubject = CONFIG.first?.subjects?.find(s => slugify(s) === subjectSlug);
          if (!resolvedSubject) {
            try {
              const res = await fetch(`/api/files?year=first`);
              const files = await res.json();
              resolvedSubject = files.map(f => f.subject).find(s => slugify(s) === subjectSlug);
            } catch (e) { console.error(e); }
          }
          await selectSubject(resolvedSubject || decodeURIComponent(subjectSlug));
        }
      } else if (branchSlug) {
        const resolvedBranch = CONFIG[year]?.branches?.find(b => slugify(b) === branchSlug) || decodeURIComponent(branchSlug);
        await selectBranch(resolvedBranch, CONFIG[year] || {});

        if (subjectSlug) {
          let resolvedSubject = null;
          let configSubjects = [];
          if (CONFIG[year]?.subjects) {
            if (Array.isArray(CONFIG[year].subjects)) {
              configSubjects = CONFIG[year].subjects;
            } else if (typeof CONFIG[year].subjects === 'object') {
              configSubjects = CONFIG[year].subjects[resolvedBranch] || [];
            }
          }

          let flatConfigSubjects = [];
          if (Array.isArray(configSubjects)) {
            flatConfigSubjects = configSubjects;
          } else if (typeof configSubjects === 'object' && configSubjects !== null) {
            flatConfigSubjects = [
              ...(configSubjects["2024 Pattern"] || []),
              ...(configSubjects["2019 Pattern"] || [])
            ];
          }

          resolvedSubject = flatConfigSubjects.find(s => slugify(s) === subjectSlug);

          if (!resolvedSubject) {
            try {
              const res = await fetch(`/api/files?year=${year}&branch=${encodeURIComponent(resolvedBranch)}`);
              const files = await res.json();
              resolvedSubject = files.map(f => f.subject).find(s => slugify(s) === subjectSlug);
            } catch (e) { console.error(e); }
          }
          await selectSubject(resolvedSubject || decodeURIComponent(subjectSlug));
        }
      }
    }
  } catch (e) {
    console.error('Routing error:', e);
  } finally {
    isRouting = false;
  }
}
window.addEventListener('popstate', handleUrlRouting);

function populateKeywords() {
  const suggestions = new Set();
  Object.values(CONFIG).forEach(yearData => {
    if (yearData.branches) yearData.branches.forEach(b => suggestions.add(b));
    if (yearData.subjects) {
      if (Array.isArray(yearData.subjects)) {
        yearData.subjects.forEach(s => suggestions.add(s));
      } else if (typeof yearData.subjects === 'object') {
        Object.values(yearData.subjects).forEach(val => {
          if (Array.isArray(val)) {
            val.forEach(s => suggestions.add(s));
          } else if (typeof val === 'object' && val !== null) {
            Object.values(val).forEach(list => {
              if (Array.isArray(list)) {
                list.forEach(s => suggestions.add(s));
              }
            });
          }
        });
      }
    }
  });
  allKeywords = Array.from(suggestions).sort();
}

// ── Year selection ────────────────────────────────────────────────────────────
function selectYear(year) {
  currentYear = year;
  currentBranch = null;

  if (!isRouting) {
    history.pushState(null, '', getSeoUrl(year, null, null));
  }

  const yearData = CONFIG[year];
  if (!yearData) return;

  const panel = document.getElementById('browserPanel');
  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });

  document.getElementById('panelTitle').textContent = yearData.label;

  // Reset steps
  document.getElementById('branchStep').style.display = 'block';
  document.getElementById('subjectStep').style.display = 'none';
  document.getElementById('fileStep').style.display = 'none';

  // Build branch list
  const grid = document.getElementById('branchGrid');
  grid.innerHTML = '';

  if (year === 'first') {
    // 1st year: skip branch, go straight to subjects
    document.getElementById('branchStep').style.display = 'none';
    document.getElementById('subjectStep').style.display = 'block';
    currentBranch = 'FE';
    buildSubjectTags(yearData.subjects);
  } else {
    yearData.branches.forEach(branch => {
      const tag = document.createElement('div');
      tag.className = 'tag';
      tag.textContent = branch;
      tag.onclick = () => selectBranch(branch, yearData);
      grid.appendChild(tag);
    });
  }
}

// ── Branch selection ──────────────────────────────────────────────────────────
async function selectBranch(branch, yearData) {
  currentBranch = branch;

  if (!isRouting) {
    history.pushState(null, '', getSeoUrl(currentYear, branch, null));
  }

  // Highlight selected
  document.querySelectorAll('#branchGrid .tag').forEach(t =>
    t.classList.toggle('active', t.textContent === branch)
  );

  document.getElementById('subjectStep').style.display = 'block';
  document.getElementById('fileStep').style.display = 'none';

  // Show skeletons for subjects while loading
  const subjectGrid = document.getElementById('subjectGrid');
  if (subjectGrid) {
    subjectGrid.innerHTML = Array(5).fill(0).map(() => `
      <div class="tag skeleton" style="width: 130px; height: 38px; border-radius: 100px; border: none; opacity: 0.65;"></div>
    `).join('');
  }

  // For 2nd+ year: fetch subjects that actually have files for this branch/year
  const res = await fetch(`/api/files?year=${currentYear}&branch=${encodeURIComponent(branch)}`);
  const files = await res.json();

  // Collect unique subjects with files
  const subjectsWithFiles = [...new Set(files.map(f => f.subject))];
  // Also include configured subjects
  let configSubjects = [];
  if (yearData.subjects) {
    if (Array.isArray(yearData.subjects)) {
      configSubjects = yearData.subjects;
    } else if (typeof yearData.subjects === 'object') {
      configSubjects = yearData.subjects[branch] || [];
    }
  }

  if (currentYear === 'first') {
    const allSubjects = [...new Set([...configSubjects, ...subjectsWithFiles])];
    buildSubjectTags(allSubjects.length ? allSubjects : subjectsWithFiles, false);
  } else {
    // Group subjects by pattern: { "2024 Pattern": [...], "2019 Pattern": [...] }
    const subjectsByPattern = {
      "2024 Pattern": [],
      "2019 Pattern": []
    };

    if (configSubjects) {
      if (Array.isArray(configSubjects)) {
        configSubjects.forEach(s => {
          if (s.toLowerCase().includes('2019')) {
            subjectsByPattern["2019 Pattern"].push(s);
          } else {
            subjectsByPattern["2024 Pattern"].push(s);
          }
        });
      } else if (typeof configSubjects === 'object') {
        if (configSubjects["2024 Pattern"]) {
          subjectsByPattern["2024 Pattern"] = [...configSubjects["2024 Pattern"]];
        }
        if (configSubjects["2019 Pattern"]) {
          subjectsByPattern["2019 Pattern"] = [...configSubjects["2019 Pattern"]];
        }
      }
    }

    // Add subjects with files
    files.forEach(f => {
      const patName = (f.pattern === '2019') ? '2019 Pattern' : '2024 Pattern';
      if (!subjectsByPattern[patName]) {
        subjectsByPattern[patName] = [];
      }
      if (!subjectsByPattern[patName].includes(f.subject)) {
        const otherPat = (patName === '2019 Pattern') ? '2024 Pattern' : '2019 Pattern';
        if (!subjectsByPattern[otherPat] || !subjectsByPattern[otherPat].includes(f.subject)) {
          subjectsByPattern[patName].push(f.subject);
        }
      }
    });

    buildSubjectTags(subjectsByPattern, true);
  }
}

function buildSubjectTags(subjects, isGrouped = false) {
  const grid = document.getElementById('subjectGrid');
  grid.innerHTML = '';

  if (!subjects) {
    grid.innerHTML = '<div class="empty-state small"><span class="empty-icon">📭</span>No subjects available yet.</div>';
    return;
  }

  if (!isGrouped) {
    if (!subjects.length) {
      grid.innerHTML = '<div class="empty-state small"><span class="empty-icon">📭</span>No subjects available yet.</div>';
      return;
    }
    subjects.forEach(subject => {
      const tag = document.createElement('div');
      tag.className = 'tag';
      tag.textContent = subject;
      tag.onclick = () => selectSubject(subject);
      grid.appendChild(tag);
    });
  } else {
    const patterns = Object.entries(subjects);
    const hasAnySubjects = patterns.some(([_, list]) => list && list.length > 0);
    if (!hasAnySubjects) {
      grid.innerHTML = '<div class="empty-state small"><span class="empty-icon">📭</span>No subjects available yet.</div>';
      return;
    }

    const availablePatterns = patterns.filter(([_, list]) => list && list.length > 0);

    const tabContainer = document.createElement('div');
    tabContainer.style.display = 'flex';
    tabContainer.style.gap = '1rem';
    tabContainer.style.marginBottom = '1.5rem';
    grid.appendChild(tabContainer);

    const contentContainer = document.createElement('div');
    grid.appendChild(contentContainer);

    const renderPattern = (patternName, list) => {
      contentContainer.innerHTML = '';

      const fileStep = document.getElementById('fileStep');
      if (fileStep) fileStep.style.display = 'none';

      Array.from(tabContainer.children).forEach(btn => {
        btn.classList.toggle('active', btn.textContent === patternName || (patternName === '2019 Pattern' && btn.textContent === '2019 Pattern (legacy)'));
      });

      const tagsContainer = document.createElement('div');
      tagsContainer.style.display = 'flex';
      tagsContainer.style.flexWrap = 'wrap';
      tagsContainer.style.gap = '0.6rem';

      list.forEach(subject => {
        const tag = document.createElement('div');
        tag.className = 'tag';
        tag.textContent = subject;
        tag.onclick = () => selectSubject(subject, patternName.split(' ')[0]);
        tagsContainer.appendChild(tag);
      });

      contentContainer.appendChild(tagsContainer);

      if (patternName === '2019 Pattern') {
        const disclaimer = document.createElement('div');
        disclaimer.style.fontSize = '0.85rem';
        disclaimer.style.opacity = '0.8';
        disclaimer.style.marginTop = '1rem';
        disclaimer.textContent = "Disclaimer: Previous Year Question Papers belong to Savitribai Phule Pune University (SPPU) and are accessed through publicly available Google Drive links. This website does not host, own, or claim ownership of these files. If any institution or copyright owner requests removal, the links will be removed promptly.";
        contentContainer.appendChild(disclaimer);
      }
    };

    availablePatterns.forEach(([patternName, list]) => {
      const tabBtn = document.createElement('div');
      tabBtn.textContent = (patternName === '2019 Pattern') ? '2019 Pattern (legacy)' : patternName;
      tabBtn.className = 'tag pattern-tab';
      tabBtn.style.cursor = 'pointer';
      tabBtn.style.fontWeight = '600';
      tabBtn.onclick = () => renderPattern(patternName, list);
      tabContainer.appendChild(tabBtn);
    });

    if (availablePatterns.length > 0) {
      const defaultPattern = availablePatterns.find(([name]) => name === '2024 Pattern') || availablePatterns[0];
      renderPattern(defaultPattern[0], defaultPattern[1]);
    }
  }
}

// ── Subject selection ─────────────────────────────────────────────────────────
async function selectSubject(subject, pattern) {
  if (!isRouting) {
    if (currentYear === 'first') {
      history.pushState(null, '', getSeoUrl(currentYear, 'FE', subject));
    } else {
      history.pushState(null, '', getSeoUrl(currentYear, currentBranch, subject));
    }
  }

  document.querySelectorAll('#subjectGrid .tag').forEach(t => {
    if (!t.classList.contains('pattern-tab')) {
      t.classList.toggle('active', t.textContent === subject);
    }
  });

  const fileStep = document.getElementById('fileStep');
  fileStep.style.display = 'block';

  // Scroll to the PDFs on mobile so the user sees them
  if (window.innerWidth <= 768) {
    setTimeout(() => {
      fileStep.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100); // small delay to allow DOM to render
  }

  document.getElementById('fileStepLabel').textContent = `Papers for: ${subject}`;

  const params = new URLSearchParams({ year: currentYear, subject });
  if (currentBranch && currentBranch !== 'FE') params.append('branch', currentBranch);
  if (pattern) params.append('pattern', pattern);

  try {
    // Show skeletons
    const grid = document.getElementById('fileGrid');
    grid.innerHTML = Array(4).fill(0).map(() => `
      <div class="file-card skeleton-card" style="border-color:transparent">
        <div class="skeleton-icon skeleton"></div>
        <div class="file-info">
          <div class="skeleton-text skeleton"></div>
          <div class="skeleton-text short skeleton"></div>
        </div>
        <div class="skeleton-btn skeleton"></div>
      </div>
    `).join('');

    const res = await fetch(`/api/files?${params}`);
    let files = await res.json();

    // Fallback: if no files found and we filtered by pattern, try without pattern filter
    if ((!files || files.length === 0) && pattern) {
      const fallbackParams = new URLSearchParams({ year: currentYear, subject });
      if (currentBranch && currentBranch !== 'FE') fallbackParams.append('branch', currentBranch);
      const fallbackRes = await fetch(`/api/files?${fallbackParams}`);
      const fallbackFiles = await fallbackRes.json();
      if (fallbackFiles && fallbackFiles.length > 0) {
        files = fallbackFiles;
      }
    }

    allFiles = files;
    renderFileGrid(files, 'fileGrid');

    // Render Year x Month table if DSA is selected
    const dsaArea = document.getElementById('dsaTableArea');
    if (dsaArea) {
      if (/data\s*structures?|dsa/i.test(subject) && files.length > 0) {
        dsaArea.innerHTML = `
          <div style="background: var(--surface-glass); border: 1px solid var(--glass-border); border-radius: 12px; padding: 1.2rem; margin-bottom: 1.5rem; backdrop-filter: var(--blur);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.8rem; flex-wrap:wrap; gap:0.5rem;">
              <h3 style="font-family:'Syne',sans-serif; font-size:1.1rem; color:var(--text); margin:0;">
                📊 Data Structures &amp; Algorithms (DSA) Available Papers
              </h3>
              <span style="font-size:0.8rem; color:var(--accent); font-weight:600;">Year × Month Session Table</span>
            </div>
            <div style="overflow-x:auto;">
              <table style="width:100%; border-collapse:collapse; font-size:0.88rem; text-align:left;">
                <thead>
                  <tr style="border-bottom:1px solid var(--border); color:var(--text-secondary);">
                    <th style="padding:8px 10px;">Pattern</th>
                    <th style="padding:8px 10px;">Branch</th>
                    <th style="padding:8px 10px;">Exam Session</th>
                    <th style="padding:8px 10px;">Paper Name</th>
                    <th style="padding:8px 10px; text-align:center;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${files.map(f => {
                    const pat = f.pattern === '2019' ? '2019 Pattern (legacy)' : '2024 Pattern';
                    let session = 'Official Exam Paper';
                    if (/dec.*2025/i.test(f.originalName)) session = 'Dec 2025 (Insem)';
                    else if (/2025/i.test(f.originalName)) session = '2025 Session';
                    else if (/2024/i.test(f.originalName)) session = '2024 Session';
                    else if (/_(\\d+)\\.pdf/i.test(f.originalName)) session = `Exam Paper #${f.originalName.match(/_(\\d+)\\.pdf/i)[1]}`;
                    return `
                    <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                      <td style="padding:8px 10px;"><span style="color:#10b981; font-weight:600;">${pat}</span></td>
                      <td style="padding:8px 10px;">${escHtml(f.branch || 'Computer/AIML')}</td>
                      <td style="padding:8px 10px;">${session}</td>
                      <td style="padding:8px 10px; font-family:monospace; font-size:0.82rem;">${escHtml(f.originalName || f.subject)}</td>
                      <td style="padding:8px 10px; text-align:center;">
                        <a href="/api/download/${f._id}" style="color:var(--accent); font-weight:600; text-decoration:none; font-size:0.85rem;" download="${escHtml(f.originalName || f.subject + '.pdf')}">⬇ Download</a>
                      </td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `;
      } else {
        dsaArea.innerHTML = '';
      }
    }
  } catch (e) {
    document.getElementById('fileGrid').innerHTML = '<div class="empty-state">Failed to load files.</div>';
  }
}

// ── Render file cards ──────────────────────────────────────────────────────────
function renderFileGrid(files, gridId) {
  const grid = document.getElementById(gridId);
  if (!files.length) {
    grid.innerHTML = `
      <div class="empty-state premium-empty" style="grid-column:1/-1; padding: 4rem 1rem; text-align: center; background: var(--surface-glass); border-radius: 20px; border: 1px dashed var(--glass-border); margin: 2rem 0; backdrop-filter: var(--blur);">
        <svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="margin: 0 auto 1.5rem auto; animation: float 3s ease-in-out infinite; opacity: 0.6;">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
          <line x1="12" y1="22.08" x2="12" y2="12"></line>
        </svg>
        <h3 style="font-family: 'Syne', sans-serif; font-size: 1.5rem; margin-bottom: 0.5rem; color: var(--text);">No Papers Found</h3>
        <p style="color: var(--text-secondary); margin-bottom: 1.5rem; font-size: 1rem; max-width: 300px; margin-left: auto; margin-right: auto;">We're constantly adding new study materials. Can't find what you need?</p>
        <button class="btn-primary" onclick="document.getElementById('feedback').scrollIntoView({behavior: 'smooth'})" style="padding: 0.8rem 2rem; border-radius: 30px; font-weight: 600; box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);">Request This Paper ✨</button>
      </div>`;
    return;
  }

  grid.innerHTML = files.map((f, i) => {
    const isGdLink = f.publicId && f.publicId.startsWith('google-drive');
    let downloadBtn;
    if (f.downloadGate && f.downloadGate.enabled && f.downloadGate.type !== 'none') {
      downloadBtn = `<button class="btn-download" onclick="handleGatedDownload('${f._id}', '${f.downloadGate.type}', '${f.downloadGate.whatsappUrl || ''}')" title="Unlock PDF">🔒 Unlock</button>`;
    } else {
      downloadBtn = isGdLink
        ? `<a class="btn-download" href="/api/download/${f._id}" target="_blank" title="Open PDF in Google Drive">↗ Open Link</a>`
        : `<a class="btn-download" href="/api/download/${f._id}" download="${escHtml(f.originalName || f.subject + '.pdf')}" title="Download PDF">↓ Download</a>`;
    }

    const shareText = encodeURIComponent(`Check out ${f.originalName} on SYNAPSE SPPU PYQ Portal! \nhttps://sppupyq.vercel.app/api/download/${f._id}`);
    const shareBtn = `<a class="btn-view" style="flex:0 0 auto; padding: 0.6rem; display:flex; align-items:center; justify-content:center; background: rgba(37, 211, 102, 0.1); border-color: rgba(37, 211, 102, 0.3); color: #25D366;" href="https://api.whatsapp.com/send?text=${shareText}" target="_blank" title="Share on WhatsApp">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.489-1.761-1.663-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>
    </a>`;

    const hasSolution = Boolean(f.solutionUrl && f.solutionUrl.trim());
    const solutionBtn = hasSolution
      ? `<button type="button" class="btn-solution has-solution" onclick="handleViewSolutionClick('${escHtml(f.solutionUrl)}', '${escHtml(f.originalName)}')" title="View Solution for ${escHtml(f.originalName)}"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-right:3px;"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>View Solution</button>`
      : '';

    return `
      <div class="file-card fade-in-card" style="animation-delay: ${i * 0.05}s">
        <div class="file-icon">📄</div>
        <div class="file-info">
          <div class="file-name" title="${escHtml(f.originalName)}">${escHtml(f.originalName)}</div>
          <div class="file-meta">${escHtml(f.subject)} · ${formatSize(f.size)}</div>
          <div class="file-meta">${formatDate(f.uploadDate)}</div>
        </div>
        ${hasSolution ? `
        <div class="file-actions" style="display: flex; flex-direction: column; gap: 0.35rem; align-items: stretch; min-width: 125px;">
          <div style="display: flex; gap: 0.35rem; align-items: center;">
            <div style="flex: 1;">${downloadBtn}</div>
            ${shareBtn}
          </div>
          ${solutionBtn}
        </div>` : `
        <div class="file-actions">
          <div style="flex: 1;">${downloadBtn}</div>
          ${shareBtn}
        </div>`}
      </div>
    `;
  }).join('');
}

window.handleViewSolutionClick = async function(solutionUrl, paperName) {
  if (!solutionUrl) return;

  // Double check login status if local variable is false
  if (!isLoggedIn) {
    try {
      const res = await fetch('/student/status');
      const data = await res.json();
      if (data && data.loggedIn) {
        isLoggedIn = true;
        currentUsername = data.username || null;
      }
    } catch (e) {
      console.warn('Could not verify student auth', e);
    }
  }

  if (isLoggedIn) {
    // Logged in: open solution directly in a new tab
    window.open(solutionUrl, '_blank', 'noopener,noreferrer');
  } else {
    // Not logged in: show login prompt modal
    showSolutionLoginModal(paperName, solutionUrl);
  }
};

window.showSolutionLoginModal = function(paperName, solutionUrl) {
  const existing = document.getElementById('solutionAuthModal');
  if (existing) existing.remove();

  if (solutionUrl) {
    try {
      sessionStorage.setItem('pendingSolutionUrl', solutionUrl);
    } catch (e) {}
  }

  const currentRedirect = encodeURIComponent(window.location.pathname + window.location.search);
  const loginUrl = `/student-login.html?redirect=${currentRedirect}`;

  const modal = document.createElement('div');
  modal.id = 'solutionAuthModal';
  modal.className = 'modal-overlay show';
  modal.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.75); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); display:flex; align-items:center; justify-content:center; z-index:999999; padding:1rem; opacity:1; pointer-events:auto;';
  modal.innerHTML = `
    <div class="modal" style="background:var(--surface2, #181a29); border:1px solid var(--glass-border, rgba(255,255,255,0.15)); border-radius:20px; max-width:440px; width:100%; text-align:center; padding:2.2rem 1.8rem; position:relative; box-shadow:0 25px 50px rgba(0,0,0,0.6); transform:translateY(0); opacity:1;">
      <button type="button" onclick="document.getElementById('solutionAuthModal').remove()" style="position:absolute; top:1rem; right:1rem; background:none; border:none; font-size:1.3rem; color:var(--muted, #94a3b8); cursor:pointer; line-height:1; padding:0.3rem;" aria-label="Close">✕</button>
      <div style="width:62px; height:62px; margin:0 auto 1.2rem auto; background:rgba(99, 102, 241, 0.16); border:1px solid rgba(99, 102, 241, 0.35); border-radius:18px; display:flex; align-items:center; justify-content:center; font-size:1.9rem;">
        🔒
      </div>
      <h3 style="margin:0 0 0.5rem 0; font-family:'Syne',sans-serif; font-size:1.4rem; color:var(--text, #fff);">Student Login Required</h3>
      <p style="color:var(--text-secondary, #cbd5e1); font-size:0.95rem; margin-bottom:0.5rem; line-height:1.5;">
        <strong style="color:var(--accent, #818cf8);">${escHtml(paperName || 'This paper')}</strong> ka verified solution dekhne ke liye login karna zaroori hai.
      </p>
      <p style="color:var(--muted, #94a3b8); font-size:0.85rem; margin-bottom:1.5rem;">
        Kripya apne student account me login karein ya free Sign Up karein.
      </p>
      <div style="display:flex; gap:0.75rem; justify-content:center; flex-direction:column;">
        <a href="${loginUrl}" class="btn-primary" style="padding:0.85rem 1.5rem; text-decoration:none; font-weight:600; font-size:0.95rem; border-radius:10px; display:flex; align-items:center; justify-content:center; gap:0.5rem; box-shadow:0 4px 15px rgba(99, 102, 241, 0.4); background:var(--accent, #6366f1); color:#fff; border:none;">
          Login / Sign Up to View Solution →
        </a>
        <button type="button" class="btn-ghost" onclick="document.getElementById('solutionAuthModal').remove()" style="padding:0.6rem 1rem; font-size:0.88rem; border-radius:8px; cursor:pointer;">
          Cancel
        </button>
      </div>
    </div>
  `;
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
  document.body.appendChild(modal);
};

window.handleViewSolutionEmpty = function(paperName) {
  const existing = document.getElementById('solutionNoticeModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'solutionNoticeModal';
  modal.className = 'modal-overlay';
  modal.style.display = 'flex';
  modal.style.zIndex = '9999';
  modal.innerHTML = `
    <div class="modal" style="max-width: 420px; text-align: center; padding: 2rem;">
      <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">📝</div>
      <h3 style="margin: 0 0 0.5rem 0; font-family: 'Syne', sans-serif;">Solution in Preparation</h3>
      <p style="color: var(--text-secondary); font-size: 0.9rem; margin-bottom: 1.2rem; line-height: 1.5;">
        Verified step-by-step solution for <strong style="color:var(--text);">${escHtml(paperName)}</strong> is currently being prepared.
      </p>
      <div style="display: flex; gap: 0.6rem; justify-content: center; flex-wrap: wrap;">
        <button class="btn-ghost" onclick="document.getElementById('solutionNoticeModal').remove()">Close</button>
        <button class="btn-primary" onclick="document.getElementById('solutionNoticeModal').remove(); const fb = document.getElementById('feedback'); if (fb) fb.scrollIntoView({behavior: 'smooth'});">Request Solution ✨</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
};

// ── Local filter ──────────────────────────────────────────────────────────────
function filterLocal(q) {
  if (!q) { renderFileGrid(allFiles, 'fileGrid'); return; }
  const filtered = allFiles.filter(f =>
    f.originalName.toLowerCase().includes(q.toLowerCase()) ||
    f.subject.toLowerCase().includes(q.toLowerCase())
  );
  renderFileGrid(filtered, 'fileGrid');
}

// ── Global search / Autocomplete ───────────────────────────────────────────────
window.showSuggestions = function (q) {
  const dropdown = document.getElementById('searchSuggestions');
  if (!dropdown) return;
  if (!q.trim()) { dropdown.style.display = 'none'; return; }

  const qLower = q.toLowerCase();
  let matches = allKeywords.filter(k => k.toLowerCase().includes(qLower));

  if (matches.length === 0) { dropdown.style.display = 'none'; return; }

  dropdown.innerHTML = matches.slice(0, 8).map(m => {
    const safeJs = escHtml(m).replace(/'/g, "\\'");
    return `<div class="suggestion-item" onclick="selectSuggestion('${safeJs}')">${escHtml(m)}</div>`;
  }).join('');
  dropdown.style.display = 'block';
};

window.hideSuggestions = function () {
  const dropdown = document.getElementById('searchSuggestions');
  if (dropdown) dropdown.style.display = 'none';
};

window.selectSuggestion = function (val) {
  document.getElementById('globalSearch').value = val;
  hideSuggestions();
  doGlobalSearch();
};

async function doGlobalSearch() {
  hideSuggestions();
  const q = document.getElementById('globalSearch').value.trim();
  if (!q) return;

  document.getElementById('years').style.display = 'none';
  document.getElementById('browserPanel').style.display = 'none';
  document.getElementById('searchResults').style.display = 'block';
  document.getElementById('searchResults').scrollIntoView({ behavior: 'smooth' });

  const grid = document.getElementById('searchGrid');
  grid.innerHTML = Array(4).fill(0).map(() => `
      <div class="file-card skeleton-card" style="border-color:transparent">
        <div class="skeleton-icon skeleton"></div>
        <div class="file-info">
          <div class="skeleton-text skeleton"></div>
          <div class="skeleton-text short skeleton"></div>
        </div>
        <div class="skeleton-btn skeleton"></div>
      </div>
    `).join('');

  try {
    const res = await fetch(`/api/files?search=${encodeURIComponent(q)}`);
    const files = await res.json();
    renderFileGrid(files, 'searchGrid');
  } catch (e) {
    grid.innerHTML = '<div class="empty-state">Search failed. Try again.</div>';
  }
}

function clearSearch() {
  document.getElementById('searchResults').style.display = 'none';
  document.getElementById('years').style.display = 'block';
  document.getElementById('globalSearch').value = '';
}

// ── Navigation ────────────────────────────────────────────────────────────────
function goBack() {
  if (document.getElementById('fileStep').style.display !== 'none') {
    document.getElementById('fileStep').style.display = 'none';
    document.querySelectorAll('#subjectGrid .tag').forEach(t => t.classList.remove('active'));
    if (!isRouting) {
      if (currentYear === 'first') {
        history.pushState(null, '', getSeoUrl(currentYear, null, null));
      } else {
        history.pushState(null, '', getSeoUrl(currentYear, currentBranch, null));
      }
    }
    return;
  }
  if (document.getElementById('subjectStep').style.display !== 'none' && currentYear !== 'first') {
    document.getElementById('subjectStep').style.display = 'none';
    document.querySelectorAll('#branchGrid .tag').forEach(t => t.classList.remove('active'));
    if (!isRouting) {
      history.pushState(null, '', getSeoUrl(currentYear, null, null));
    }
    return;
  }
  document.getElementById('browserPanel').style.display = 'none';
  currentYear = null; currentBranch = null;
  if (!isRouting) {
    history.pushState(null, '', `/`);
  }
  document.getElementById('years').scrollIntoView({ behavior: 'smooth' });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Feedback ──────────────────────────────────────────────────────────────────
async function submitFeedback() {
  const nameInput = document.getElementById('fbName');
  const msgInput = document.getElementById('fbMessage');
  const btn = document.getElementById('fbBtn');

  const name = nameInput.value.trim();
  const message = msgInput.value.trim();

  if (!message) { showFbAlert('Please enter a message.', 'error'); return; }

  btn.disabled = true;
  btn.textContent = 'Sending…';

  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, message })
    });
    const data = await res.json();

    if (data.success) {
      showFbAlert('Message sent! Thank you for your feedback.', 'success');
      // Only clear name if not logged in
      if (isLoggedIn && currentUsername) {
        nameInput.value = currentUsername;
      } else {
        nameInput.value = '';
      }
      msgInput.value = '';
    } else {
      showFbAlert(data.error || 'Failed to send feedback.', 'error');
    }
  } catch (e) {
    showFbAlert('Network error. Try again later.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Send Feedback';
  }
}

function showFbAlert(msg, type) {
  const el = document.getElementById('feedbackAlert');
  el.textContent = msg;
  el.className = `alert ${type}`;
  el.style.display = 'block';
  if (type === 'success') setTimeout(() => el.style.display = 'none', 5000);
}

// ── Enter key for search ──────────────────────────────────────────────────────
document.getElementById('globalSearch').addEventListener('keydown', e => {
  if (e.key === 'Enter') doGlobalSearch();
});

// ── Premium Logic ─────────────────────────────────────────────────────────────
let isPremiumUser = false;
let isLoggedIn = false;

window.checkPremiumLogin = function () {
  if (!isLoggedIn) {
    window.location.href = '/student-login.html';
  }
};

window.buyPremium = async function () {
  const btn = document.getElementById('buyPremiumBtn');
  if (btn) {
    btn.textContent = 'Processing...';
    btn.disabled = true;
  }

  try {
    const res = await fetch('/student/buy-premium', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      alert(data.message);
      init();
    } else {
      alert(data.error || 'Failed to buy premium.');
    }
  } catch (e) {
    alert('Network error during purchase.');
  } finally {
    if (btn) {
      btn.textContent = 'Buy Premium Now ✨';
      btn.disabled = false;
    }
  }
};

window.doStudentLogout = async function () {
  await fetch('/student/logout', { method: 'POST' });
  window.location.reload();
};

function togglePremiumState() {
  const loggedOut = document.getElementById('loggedOutState');
  const free = document.getElementById('freeState');
  const unlocked = document.getElementById('unlockedState');
  const buyBtn = document.getElementById('buyPremiumBtn');

  if (!loggedOut || !free || !unlocked) return;

  loggedOut.classList.remove('show', 'active');
  free.classList.remove('show', 'active');
  unlocked.classList.remove('show', 'active');

  setTimeout(() => {
    let target;
    if (!isLoggedIn) {
      target = loggedOut;
    } else if (window.userPremiumStatus === 'pending') {
      target = free;
      if (buyBtn) {
        buyBtn.innerHTML = '<span style="display:flex; align-items:center; gap:8px;">⏳ Request Pending Approval...</span>';
        buyBtn.disabled = true;
        buyBtn.style.opacity = '0.7';
        buyBtn.style.cursor = 'not-allowed';
        buyBtn.style.background = 'var(--muted)';
      }
    } else if (!isPremiumUser) {
      target = free;
      if (buyBtn) {
        buyBtn.textContent = 'Buy Premium Now ✨';
        buyBtn.disabled = false;
        buyBtn.style.opacity = '1';
        buyBtn.style.cursor = 'pointer';
        buyBtn.style.background = ''; // reset to default
      }
    } else {
      target = unlocked;
    }

    target.classList.add('active');
    void target.offsetWidth;
    target.classList.add('show');
  }, 300);
}

// ── Premium Modal Logic ───────────────────────────────────────────────────────
async function openPremiumModal(type) {
  const modal = document.getElementById('premiumModal');
  const title = document.getElementById('prmModalTitle');
  const desc = document.getElementById('prmModalDesc');
  const icon = document.getElementById('prmModalIcon');
  const list = document.getElementById('prmModalList');

  // Set meta
  if (type === 'solved-pyq') {
    title.textContent = 'Solved PYQs';
    desc.textContent = 'Select a subject to view step-by-step solutions curated by our top educators and previous year toppers.';
    icon.textContent = '📄';
  } else if (type === 'notes') {
    title.textContent = 'Handwritten Notes';
    desc.textContent = "Access high-quality topper's notes organized by units and chapters.";
    icon.textContent = '📝';
  } else if (type === 'practice') {
    title.textContent = 'Practice Bank';
    desc.textContent = 'Topic-wise expected questions for exams.';
    icon.textContent = '🎯';
  }

  list.innerHTML = '<li><span>Loading...</span></li>';
  if (modal) modal.classList.add('show');

  try {
    const res = await fetch(`/api/premium-files?type=${type}`);
    const files = await res.json();

    if (files.length === 0) {
      list.innerHTML = '<li><span style="color:var(--muted)">No files available yet.</span></li>';
    } else {
      list.innerHTML = files.map(f => {
        const isGdLink = f.publicId && f.publicId.startsWith('google-drive');
        let downloadAction = '';
        if (f.downloadGate && f.downloadGate.enabled && f.downloadGate.type !== 'none') {
          downloadAction = `<button class="modal-list-btn" onclick="handleGatedDownload('${f._id}', '${f.downloadGate.type}', '${f.downloadGate.whatsappUrl || ''}')">🔒 Unlock</button>`;
        } else {
          downloadAction = isGdLink
            ? `<a href="/api/download/${f._id}" target="_blank" class="modal-list-btn" style="text-decoration:none;">↗ Open Link</a>`
            : `<a href="/api/download/${f._id}" class="modal-list-btn" style="text-decoration:none;">↓ Download</a>`;
        }

        const actionBtn = isPremiumUser
          ? downloadAction
          : `<button onclick="showPreview('${f._id}')" class="modal-list-btn" style="background:var(--accent); color:white;">🔍 Preview</button>`;

        return `
          <li>
            <div>
              <span style="display:block">${escHtml(f.subject)}</span>
              <small style="color:var(--muted)">${escHtml(f.originalName)} · ${formatSize(f.size)}</small>
            </div>
            <div style="display:flex; gap:8px;">
              ${actionBtn}
            </div>
          </li>
        `;
      }).join('');
    }
  } catch (e) {
    list.innerHTML = '<li><span style="color:var(--danger)">Failed to load.</span></li>';
  }
}

async function showPreview(fileId) {
  const modal = document.getElementById('previewOverlay');
  const img = document.getElementById('previewImage');
  const loader = document.getElementById('previewLoader');

  if (!modal || !img || !loader) return;

  modal.classList.add('show');
  img.style.display = 'none';
  loader.style.display = 'block';

  try {
    const res = await fetch(`/api/preview/${fileId}`);
    const data = await res.json();
    if (data.previewUrl) {
      img.src = data.previewUrl;
      img.onload = () => {
        loader.style.display = 'none';
        img.style.display = 'block';
      };
    } else {
      alert('Could not load preview.');
      closePreview();
    }
  } catch (e) {
    alert('Error loading preview.');
    closePreview();
  }
}

function closePreview() {
  const modal = document.getElementById('previewOverlay');
  if (modal) modal.classList.remove('show');
  const img = document.getElementById('previewImage');
  if (img) img.src = ''; // Clear src
}

function closePremiumModal(e) {
  if (e && e.target && e.target !== e.currentTarget && !e.target.classList.contains('close-btn')) return;
  const modal = document.getElementById('premiumModal');
  if (modal) modal.classList.remove('show');
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closePremiumModal();
});

// Drag & drop visual on the whole body (just nice to have)
document.addEventListener('DOMContentLoaded', init);

// ── Chatbot Logic ─────────────────────────────────────────────────────────────
function toggleChat() {
  const chatWidget = document.getElementById('chatWidget');
  const chatBody = document.getElementById('chatBody');
  if (chatBody.style.display === 'none') {
    chatBody.style.display = 'flex';
    chatWidget.classList.add('open');
    document.getElementById('chatInput').focus();
  } else {
    chatBody.style.display = 'none';
    chatWidget.classList.remove('open');
  }
}

function handleChatKeypress(event) {
  if (event.key === 'Enter') {
    sendChatMessage();
  }
}

function addMessageToChat(text, type) {
  const messagesContainer = document.getElementById('chatMessages');
  if (!messagesContainer) return;

  const msgDiv = document.createElement('div');
  msgDiv.className = `chat-message ${type}-message`;

  const now = new Date();
  const timeStr = now.getHours() + ':' + now.getMinutes().toString().padStart(2, '0');

  msgDiv.innerHTML = `
    <div class="message-content">${text}</div>
    <div class="message-time">${timeStr}</div>
  `;

  messagesContainer.appendChild(msgDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showChatLoading() {
  const messagesContainer = document.getElementById('chatMessages');
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'chat-loading';
  loadingDiv.id = 'chatLoading';
  loadingDiv.innerHTML = '<div class="chat-dot"></div><div class="chat-dot"></div><div class="chat-dot"></div>';
  messagesContainer.appendChild(loadingDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function hideChatLoading() {
  const loadingDiv = document.getElementById('chatLoading');
  if (loadingDiv) loadingDiv.remove();
}

async function sendChatMessage() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;

  // 1. Add User Message
  addMessageToChat(text, 'user');
  input.value = '';
  input.disabled = true;

  // 2. Show Loading
  showChatLoading();

  // 3. Send to Backend
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });

    const data = await res.json();
    hideChatLoading();

    // 4. Add Bot Message
    if (data.reply) {
      addMessageToChat(data.reply, 'bot');
    } else {
      addMessageToChat('Sorry, I am having trouble connecting right now.', 'bot');
    }
  } catch (e) {
    console.error('Chat error:', e);
    hideChatLoading();
    addMessageToChat('Network error. Please try again.', 'bot');
  } finally {
    input.disabled = false;
    input.focus();
  }
}

// ── Download Gate Logic ───────────────────────────────────────────────────────
let activeGateFileId = null;
let gateConfig = { type: 'none', waUrl: '' };
let gateState = { wa: false };

function handleGatedDownload(fileId, type, waUrl) {
  activeGateFileId = fileId;
  gateConfig = { type, waUrl };
  gateState = { wa: false };

  const gateStepWa = document.getElementById('gateStepWa');
  if (gateStepWa) gateStepWa.style.display = (type === 'whatsapp') ? 'block' : 'none';

  if (type === 'whatsapp') {
    const gateWaBtn = document.getElementById('gateWaBtn');
    const gateWaStatus = document.getElementById('gateWaStatus');
    if (gateWaBtn) {
      gateWaBtn.href = waUrl;
      gateWaBtn.style.pointerEvents = 'auto';
    }
    if (gateWaStatus) {
      gateWaStatus.textContent = "";
      gateWaStatus.style.color = "var(--muted)";
    }
  }

  const gateDownloadBtn = document.getElementById('gateDownloadBtn');
  if (gateDownloadBtn) gateDownloadBtn.style.display = 'none';
  const gateModal = document.getElementById('gateModal');
  if (gateModal) gateModal.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeGateModal() {
  const gateModal = document.getElementById('gateModal');
  if (gateModal) gateModal.classList.remove('show');
  activeGateFileId = null;
  document.body.style.overflow = '';
}

function startGateCountdown(platform) {
  if (platform !== 'whatsapp' || gateState.wa) return;

  const btn = document.getElementById('gateWaBtn');
  const status = document.getElementById('gateWaStatus');
  if (!btn || !status) return;

  btn.style.pointerEvents = 'none';

  let count = 7;
  status.textContent = `⏳ Unlocking in ${count}s`;
  status.style.whiteSpace = 'normal';

  const timer = setInterval(() => {
    count--;
    if (count > 0) {
      status.textContent = `⏳ Unlocking in ${count}s`;
    } else {
      clearInterval(timer);
      gateState.wa = true;
      status.textContent = 'Download Unlocked ✓';
      status.style.color = 'var(--accent)';
      checkGateCompletion();
    }
  }, 1000);
}

function checkGateCompletion() {
  let complete = false;
  if (gateConfig.type === 'whatsapp' && gateState.wa) complete = true;

  if (complete) {
    const gateDownloadBtn = document.getElementById('gateDownloadBtn');
    if (gateDownloadBtn) gateDownloadBtn.style.display = 'block';
  }
}

async function executeGatedDownload() {
  if (!activeGateFileId) return;
  const btn = document.getElementById('gateDownloadBtn');
  btn.textContent = 'Generating Secure Link...';
  btn.disabled = true;

  try {
    const res = await fetch(`/api/verify-gate/${activeGateFileId}`, { method: 'POST' });
    const data = await res.json();
    if (data.success && data.token) {
      window.location.href = `/api/download/${activeGateFileId}?token=${data.token}`;
      setTimeout(() => { closeGateModal(); }, 1000);
    } else {
      alert('Failed to verify access. Please try again.');
    }
  } catch (e) {
    alert('Network error. Please try again.');
  } finally {
    btn.textContent = 'Download PDF Now';
    btn.disabled = false;
  }
}

// ── Load Notice Banner ──────────────────────────────────────────────────
async function loadNoticeBanner() {
  try {
    const res = await fetch('/api/banner');
    if (res.ok) {
      const data = await res.json();
      if (data && data.isActive && data.text) {
        const banner = document.getElementById('notice-banner');
        const textEl = document.getElementById('notice-banner-text');
        const linkEl = document.getElementById('notice-banner-link');
        
        if (!banner || !textEl || !linkEl) return;
        
        textEl.textContent = data.text;
        
        if (data.link && data.link.trim() !== '') {
          linkEl.href = data.link;
          linkEl.style.display = 'inline';
        } else {
          linkEl.style.display = 'none';
        }
        
        banner.style.display = 'block';
      }
    }
  } catch (err) {
    console.error('Failed to load banner config', err);
  }
}

document.addEventListener('DOMContentLoaded', loadNoticeBanner);
