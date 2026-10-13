/**
 * public/js/dashboard.js
 * Admin dashboard — upload, manage, delete files.
 */

// ── Auth guard ────────────────────────────────────────────────────────────────
(async () => {
  const res = await fetch('/auth/status');
  const data = await res.json();
  if (!data.loggedIn) window.location.href = '/login.html';
})();

let CONFIG = {};
let deleteTargetId = null;

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  // Fire all independent calls in parallel for maximum speed
  try {
    await Promise.all([
      loadConfig(),
      loadStats(),
      loadRecentFiles(),
      loadAdminFiles(),
      loadCatStructure()
    ]);
    setupDragDrop();
  } catch (e) {
    console.error('Init error:', e);
  }
}

// ── Config ────────────────────────────────────────────────────────────────────
async function loadConfig() {
  const res = await fetch('/api/config');
  CONFIG = await res.json();
}

// ── Stats ─────────────────────────────────────────────────────────────────────
async function loadStats() {
  try {
    const res = await fetch('/api/stats');
    const stats = await res.json();
    document.getElementById('dTotal').textContent = stats.total;
    document.getElementById('dFirst').textContent = stats.byYear.first || 0;
    document.getElementById('dSecond').textContent = stats.byYear.second || 0;
    document.getElementById('dThird').textContent = stats.byYear.third || 0;
    document.getElementById('dFourth').textContent = stats.byYear.fourth || 0;
    if (document.getElementById('dStudents')) {
      document.getElementById('dStudents').textContent = stats.totalStudents || 0;
    }

    // Sidebar Badges
    const bFeedback = document.getElementById('badge-feedback');
    const bRequests = document.getElementById('badge-requests');

    if (stats.totalFeedback > 0) {
      bFeedback.textContent = stats.totalFeedback;
      bFeedback.style.display = 'inline-block';
    } else {
      bFeedback.style.display = 'none';
    }

    if (stats.pendingPremium > 0) {
      bRequests.textContent = stats.pendingPremium;
      bRequests.style.display = 'inline-block';
    } else {
      bRequests.style.display = 'none';
    }
  } catch (e) {
    console.error('Stats load error:', e);
  }
}

// ── Panel navigation ──────────────────────────────────────────────────────────
document.querySelectorAll('.nav-item[data-panel]').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const panelId = item.dataset.panel;

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');

    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`panel-${panelId}`).classList.add('active');
    document.getElementById('topbarTitle').textContent = item.textContent.trim().replace(/^[^ ]+ /, '');

    // Refresh file list on panel switch
    if (panelId === 'files') loadAdminFiles();
    if (panelId === 'students') window.loadAdminStudents();
    if (panelId === 'requests') {
      markRequestsAsSeen();
      window.loadPremiumRequests();
    }
    if (panelId === 'premium') window.loadPremiumAdminFiles();
    if (panelId === 'earnings') window.loadEarningsAnalytics();
    if (panelId === 'categories') loadCatStructure();
    if (panelId === 'feedback') {
      loadFeedback();
      markFeedbackAsRead();
    }
    if (panelId === 'banner') loadBannerConfig();

    // Close sidebar on mobile
    if (window.innerWidth <= 900) document.getElementById('sidebar').classList.remove('open');
  });
});

async function markFeedbackAsRead() {
  try {
    await fetch('/api/feedback/mark-read', { method: 'POST' });
    const bFeedback = document.getElementById('badge-feedback');
    if (bFeedback) bFeedback.style.display = 'none';
  } catch (e) {
    console.error('Mark read error:', e);
  }
}

async function markRequestsAsSeen() {
  try {
    await fetch('/admin/premium-requests/mark-seen', { method: 'POST' });
    const bRequests = document.getElementById('badge-requests');
    if (bRequests) bRequests.style.display = 'none';
  } catch (e) {
    console.error('Mark seen error:', e);
  }
}

// ── Sidebar toggle (mobile) ───────────────────────────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ── Upload form: year → branch ────────────────────────────────────────────────
function onYearChange() {
  const year = document.getElementById('upYear').value;
  const branch = document.getElementById('upBranch');
  const subj = document.getElementById('upSubject');
  const patternGroup = document.getElementById('upPatternGroup');

  branch.innerHTML = '<option value="">— Select Branch —</option>';
  subj.innerHTML = '<option value="">— Select Subject —</option><option value="__custom__">+ Type custom subject…</option>';
  branch.disabled = true;
  subj.disabled = true;

  if (year && year !== 'first') {
    patternGroup.style.display = 'block';
  } else {
    patternGroup.style.display = 'none';
  }

  if (!year || !CONFIG[year]) return;

  const branches = CONFIG[year].branches;
  branches.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b; opt.textContent = b;
    branch.appendChild(opt);
  });
  branch.disabled = false;
}

function onPatternChange() {
  onBranchChange();
}
window.onPatternChange = onPatternChange;

function onBranchChange() {
  const year = document.getElementById('upYear').value;
  const branchVal = document.getElementById('upBranch').value;
  const patternVal = document.getElementById('upPattern').value;
  const subj = document.getElementById('upSubject');

  subj.innerHTML = '<option value="">— Select Subject —</option><option value="__custom__">+ Type custom subject…</option>';
  subj.disabled = true;

  if (!year || !CONFIG[year]) return;

  let subjects = [];
  if (CONFIG[year].subjects) {
    if (Array.isArray(CONFIG[year].subjects)) {
      subjects = CONFIG[year].subjects;
    } else if (typeof CONFIG[year].subjects === 'object') {
      const branchData = CONFIG[year].subjects[branchVal];
      if (branchData) {
        if (Array.isArray(branchData)) {
          subjects = branchData;
        } else if (typeof branchData === 'object') {
          subjects = branchData[patternVal] || [];
        }
      }
    }
  }

  subjects.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s; opt.textContent = s;
    subj.appendChild(opt);
  });
  subj.disabled = false;

  subj.addEventListener('change', function () {
    document.getElementById('customSubjectGroup').style.display =
      this.value === '__custom__' ? 'block' : 'none';
    if (typeof loadSolutionTargetPapers === 'function' && currentUploadMethod === 'solution') {
      loadSolutionTargetPapers();
    }
  });
}

// ── File pick / drop ──────────────────────────────────────────────────────────
function onFileSelect(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 20 * 1024 * 1024) {
    showUploadAlert('File exceeds 20MB limit.', 'error'); return;
  }
  document.getElementById('dropzone').style.display = 'none';
  document.getElementById('filePreview').style.display = 'flex';
  document.getElementById('fileName').textContent = `${file.name} (${formatSize(file.size)})`;
}

function clearFile() {
  document.getElementById('pdfInput').value = '';
  document.getElementById('dropzone').style.display = 'block';
  document.getElementById('filePreview').style.display = 'none';
  document.getElementById('upCustomFileName').value = '';
}

function setupDragDrop() {
  const zone = document.getElementById('dropzone');
  if (zone) {
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault(); zone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) {
        const input = document.getElementById('pdfInput');
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        onFileSelect(input);
      }
    });
  }

  const solZone = document.getElementById('solutionDropzone');
  if (solZone) {
    solZone.addEventListener('dragover', e => { e.preventDefault(); solZone.classList.add('drag-over'); });
    solZone.addEventListener('dragleave', () => solZone.classList.remove('drag-over'));
    solZone.addEventListener('drop', e => {
      e.preventDefault(); solZone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) {
        const input = document.getElementById('solutionPdfInput');
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        onSolutionFileSelect(input);
      }
    });
  }
}

let currentUploadMethod = 'file';
let currentPrmUploadMethod = 'file';
let currentSolSubMethod = 'file';

function setUploadMethod(method) {
  currentUploadMethod = method;
  const btnFile = document.getElementById('btnMethodFile');
  const btnLink = document.getElementById('btnMethodLink');
  const btnSolution = document.getElementById('btnMethodSolution');
  const fileContainer = document.getElementById('fileUploadContainer');
  const linkContainer = document.getElementById('linkUploadContainer');
  const solutionContainer = document.getElementById('solutionUploadContainer');
  const customFileNameGroup = document.getElementById('customFileNameGroup');
  const uploadBtn = document.getElementById('uploadBtn');

  // Reset button styles
  [btnFile, btnLink, btnSolution].forEach(b => {
    if (b) {
      b.style.borderColor = '';
      b.style.background = '';
      b.style.color = '';
    }
  });

  if (method === 'file') {
    if (fileContainer) fileContainer.style.display = 'block';
    if (linkContainer) linkContainer.style.display = 'none';
    if (solutionContainer) solutionContainer.style.display = 'none';
    if (customFileNameGroup) customFileNameGroup.style.display = 'block';
    if (btnFile) {
      btnFile.style.borderColor = 'var(--accent)';
      btnFile.style.background = 'rgba(99,102,241,.15)';
      btnFile.style.color = 'var(--accent)';
    }
    if (uploadBtn) uploadBtn.textContent = 'Upload Paper →';
  } else if (method === 'link') {
    if (fileContainer) fileContainer.style.display = 'none';
    if (linkContainer) linkContainer.style.display = 'block';
    if (solutionContainer) solutionContainer.style.display = 'none';
    if (customFileNameGroup) customFileNameGroup.style.display = 'block';
    if (btnLink) {
      btnLink.style.borderColor = 'var(--accent)';
      btnLink.style.background = 'rgba(99,102,241,.15)';
      btnLink.style.color = 'var(--accent)';
    }
    if (uploadBtn) uploadBtn.textContent = 'Upload Paper →';
  } else if (method === 'solution') {
    if (fileContainer) fileContainer.style.display = 'none';
    if (linkContainer) linkContainer.style.display = 'none';
    if (solutionContainer) solutionContainer.style.display = 'block';
    if (customFileNameGroup) customFileNameGroup.style.display = 'none';
    if (btnSolution) {
      btnSolution.style.borderColor = 'var(--accent)';
      btnSolution.style.background = 'rgba(99,102,241,.15)';
      btnSolution.style.color = 'var(--accent)';
    }
    if (uploadBtn) uploadBtn.textContent = 'Upload Solution →';
    loadSolutionTargetPapers();
  }
}
window.setUploadMethod = setUploadMethod;

function setSolutionSubMethod(subMethod) {
  currentSolSubMethod = subMethod;
  const btnFile = document.getElementById('btnSolMethodFile');
  const btnLink = document.getElementById('btnSolMethodLink');
  const fileWrap = document.getElementById('solFileUploadWrap');
  const linkWrap = document.getElementById('solLinkUploadWrap');

  if (subMethod === 'file') {
    if (fileWrap) fileWrap.style.display = 'block';
    if (linkWrap) linkWrap.style.display = 'none';
    if (btnFile) {
      btnFile.style.borderColor = 'var(--accent)';
      btnFile.style.background = 'rgba(99,102,241,.15)';
      btnFile.style.color = 'var(--accent)';
    }
    if (btnLink) {
      btnLink.style.borderColor = '';
      btnLink.style.background = '';
      btnLink.style.color = '';
    }
  } else {
    if (fileWrap) fileWrap.style.display = 'none';
    if (linkWrap) linkWrap.style.display = 'block';
    if (btnLink) {
      btnLink.style.borderColor = 'var(--accent)';
      btnLink.style.background = 'rgba(99,102,241,.15)';
      btnLink.style.color = 'var(--accent)';
    }
    if (btnFile) {
      btnFile.style.borderColor = '';
      btnFile.style.background = '';
      btnFile.style.color = '';
    }
  }
}
window.setSolutionSubMethod = setSolutionSubMethod;

async function loadSolutionTargetPapers() {
  const year = document.getElementById('upYear').value;
  const branch = document.getElementById('upBranch').value;
  const subjectEl = document.getElementById('upSubject');
  const customSubEl = document.getElementById('upCustomSubject');
  const selPaper = document.getElementById('upSolutionPaper');
  const hint = document.getElementById('solutionPaperHint');

  if (!selPaper) return;
  selPaper.innerHTML = '<option value="">— Loading papers… —</option>';

  const subjectVal = subjectEl && subjectEl.value === '__custom__' 
    ? (customSubEl ? customSubEl.value.trim() : '') 
    : (subjectEl ? subjectEl.value : '');

  if (!year || !branch || !subjectVal) {
    selPaper.innerHTML = '<option value="">— Select Year, Branch & Subject above first —</option>';
    if (hint) hint.textContent = 'Please choose a Year, Branch, and Subject above to list its question papers.';
    return;
  }

  try {
    const params = new URLSearchParams({ year, branch, subject: subjectVal });
    const res = await fetch(`/admin/subject-papers?${params}`);
    const papers = await res.json();

    if (!papers || papers.length === 0) {
      selPaper.innerHTML = '<option value="">No papers found for this subject</option>';
      if (hint) hint.textContent = 'No question papers exist yet for this subject. Upload a paper first!';
      return;
    }

    selPaper.innerHTML = '<option value="">— Choose Paper to Attach Solution —</option>' +
      papers.map(p => {
        const hasSol = p.solutionUrl ? ' [✓ Has Solution]' : ' [No Solution]';
        return `<option value="${p._id}">${p.originalName}${hasSol}</option>`;
      }).join('');
    if (hint) hint.textContent = `Found ${papers.length} question paper(s) for ${subjectVal}.`;
  } catch (err) {
    selPaper.innerHTML = '<option value="">Error loading papers</option>';
  }
}
window.loadSolutionTargetPapers = loadSolutionTargetPapers;

function onSolutionPaperSelected() {
  const selPaper = document.getElementById('upSolutionPaper');
  const paperId = selPaper ? selPaper.value : '';
  const titleInput = document.getElementById('upSolutionTitle');
  if (paperId && selPaper.selectedIndex > 0) {
    const paperName = selPaper.options[selPaper.selectedIndex].text.replace(/\s*\[.*\]/, '');
    if (titleInput && !titleInput.value) {
      titleInput.value = paperName.replace(/\.pdf$/i, '') + '_Solution.pdf';
    }
  }
}
window.onSolutionPaperSelected = onSolutionPaperSelected;

function onSolutionFileSelect(input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 20 * 1024 * 1024) {
    showUploadAlert('Solution file exceeds 20MB limit.', 'error'); return;
  }
  const drop = document.getElementById('solutionDropzone');
  const prev = document.getElementById('solutionFilePreview');
  const name = document.getElementById('solutionFileName');
  if (drop) drop.style.display = 'none';
  if (prev) prev.style.display = 'flex';
  if (name) name.textContent = `${file.name} (${formatSize(file.size)})`;
}
window.onSolutionFileSelect = onSolutionFileSelect;

function clearSolutionFile() {
  const inp = document.getElementById('solutionPdfInput');
  const drop = document.getElementById('solutionDropzone');
  const prev = document.getElementById('solutionFilePreview');
  if (inp) inp.value = '';
  if (drop) drop.style.display = 'block';
  if (prev) prev.style.display = 'none';
}
window.clearSolutionFile = clearSolutionFile;

function setPrmUploadMethod(method) {
  currentPrmUploadMethod = method;
  const btnFile = document.getElementById('prmBtnMethodFile');
  const btnLink = document.getElementById('prmBtnMethodLink');
  const fileContainer = document.getElementById('prmFileUploadContainer');
  const linkContainer = document.getElementById('prmLinkUploadContainer');

  if (method === 'file') {
    fileContainer.style.display = 'block';
    linkContainer.style.display = 'none';
    btnFile.style.borderColor = 'var(--accent)';
    btnFile.style.background = 'rgba(99,102,241,.15)';
    btnFile.style.color = 'var(--accent)';
    btnLink.style.borderColor = '';
    btnLink.style.background = '';
    btnLink.style.color = '';
  } else {
    fileContainer.style.display = 'none';
    linkContainer.style.display = 'block';
    btnLink.style.borderColor = 'var(--accent)';
    btnLink.style.background = 'rgba(99,102,241,.15)';
    btnLink.style.color = 'var(--accent)';
    btnFile.style.borderColor = '';
    btnFile.style.background = '';
    btnFile.style.color = '';
  }
}
window.setPrmUploadMethod = setPrmUploadMethod;

// ── Upload ────────────────────────────────────────────────────────────────────
async function doUpload() {
  if (currentUploadMethod === 'solution') {
    const paperId = document.getElementById('upSolutionPaper').value;
    if (!paperId) {
      showUploadAlert('Please select a question paper to attach the solution to.', 'error');
      return;
    }

    const solTitle = document.getElementById('upSolutionTitle').value.trim();
    const solFile = document.getElementById('solutionPdfInput').files[0];
    const solLink = document.getElementById('upSolutionLink').value.trim();

    if (currentSolSubMethod === 'file') {
      if (!solFile) {
        showUploadAlert('Please select a solution PDF file.', 'error');
        return;
      }
    } else {
      if (!solLink || (!solLink.startsWith('http://') && !solLink.startsWith('https://'))) {
        showUploadAlert('Please enter a valid Solution URL (starting with http:// or https://).', 'error');
        return;
      }
    }

    const btn = document.getElementById('uploadBtn');
    btn.disabled = true; btn.textContent = 'Uploading Solution…';

    const progressWrap = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    progressWrap.style.display = 'block';
    progressFill.style.width = '0%';

    let prog = 0;
    const interval = setInterval(() => {
      prog = Math.min(prog + 8, 85);
      progressFill.style.width = `${prog}%`;
      progressText.textContent = `Uploading… ${prog}%`;
    }, 150);

    const fd = new FormData();
    fd.append('paperId', paperId);
    fd.append('solutionType', currentSolSubMethod);
    if (solTitle) fd.append('solutionTitle', solTitle);

    if (currentSolSubMethod === 'file') {
      fd.append('solutionPdf', solFile);
    } else {
      fd.append('solutionLink', solLink);
    }

    try {
      const res = await fetch('/admin/upload-solution', { method: 'POST', body: fd });
      const data = await res.json();
      clearInterval(interval);

      if (data.success) {
        progressFill.style.width = '100%';
        progressText.textContent = 'Solution attached successfully!';
        showUploadAlert('Solution attached successfully! ✓', 'success');
        clearSolutionFile();
        document.getElementById('upSolutionLink').value = '';
        document.getElementById('upSolutionTitle').value = '';
        await loadSolutionTargetPapers();
        if (typeof loadAdminFiles === 'function') await loadAdminFiles();
      } else {
        showUploadAlert(data.error || 'Failed to attach solution.', 'error');
        progressFill.style.width = '0%';
      }
    } catch (e) {
      clearInterval(interval);
      showUploadAlert('Network error. Please try again.', 'error');
      progressFill.style.width = '0%';
    } finally {
      btn.disabled = false; btn.textContent = 'Upload Solution →';
      setTimeout(() => { progressWrap.style.display = 'none'; }, 2000);
    }
    return;
  }

  const year = document.getElementById('upYear').value;
  const branch = document.getElementById('upBranch').value;
  const semesterEl = document.getElementById('upSemester');
  const semester = semesterEl ? semesterEl.value : '';
  const subject = document.getElementById('upSubject').value;
  const customSubject = document.getElementById('upCustomSubject').value.trim();
  const customFileName = document.getElementById('upCustomFileName').value.trim();
  const file = document.getElementById('pdfInput').files[0];
  const linkUrl = document.getElementById('upLink').value.trim();
  const patternVal = document.getElementById('upPattern').value;

  if (!year) { showUploadAlert('Please select a year.', 'error'); return; }
  if (!branch) { showUploadAlert('Please select a branch.', 'error'); return; }
  if (semesterEl && !semester) { showUploadAlert('Please select a semester.', 'error'); return; }
  if (!subject) { showUploadAlert('Please select a subject.', 'error'); return; }
  if (subject === '__custom__' && !customSubject) {
    showUploadAlert('Please enter a custom subject name.', 'error'); return;
  }

  if (currentUploadMethod === 'file') {
    if (!file) { showUploadAlert('Please select a PDF file.', 'error'); return; }
  } else {
    if (!linkUrl) { showUploadAlert('Please enter a Google Drive / PDF Link.', 'error'); return; }
    const lines = linkUrl.split(/[\r\n,]+/).map(u => u.trim()).filter(Boolean);
    if (!lines.length) { showUploadAlert('Please enter a Google Drive / PDF Link.', 'error'); return; }
    for (const line of lines) {
      if (!line.startsWith('http://') && !line.startsWith('https://')) {
        showUploadAlert(`Invalid URL: "${line}". All links must start with http:// or https://`, 'error'); return;
      }
    }
  }

  const btn = document.getElementById('uploadBtn');
  btn.disabled = true; btn.textContent = 'Uploading…';

  const progressWrap = document.getElementById('uploadProgress');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  progressWrap.style.display = 'block';
  progressFill.style.width = '0%';

  // Simulate progress for UX
  let prog = 0;
  const interval = setInterval(() => {
    prog = Math.min(prog + 8, 85);
    progressFill.style.width = `${prog}%`;
    progressText.textContent = `Uploading… ${prog}%`;
  }, 150);

  const fd = new FormData();
  fd.append('year', year);
  fd.append('branch', branch);
  fd.append('semester', semester);
  fd.append('subject', subject === '__custom__' ? customSubject : subject);
  if (subject === '__custom__') fd.append('customSubject', customSubject);
  if (customFileName) fd.append('customFileName', customFileName);
  if (year !== 'first') {
    // pattern Val will be e.g. "2024 Pattern" or "2019 Pattern", let's extract the year part e.g. "2024" or "2019"
    const patternYear = patternVal.split(' ')[0];
    fd.append('pattern', patternYear);
  }
  
  if (currentUploadMethod === 'file') {
    fd.append('pdf', file);
  } else {
    fd.append('isLink', 'true');
    fd.append('linkUrl', linkUrl);
  }

  try {
    const res = await fetch('/admin/upload', { method: 'POST', body: fd });
    const data = await res.json();
    clearInterval(interval);

    if (data.success) {
      progressFill.style.width = '100%';
      progressText.textContent = 'Upload complete!';
      showUploadAlert('Paper uploaded successfully! ✓', 'success');
      clearFile();
      document.getElementById('upLink').value = '';
      document.getElementById('upYear').value = '';
      document.getElementById('upBranch').value = '';
      if (semesterEl) semesterEl.value = '';
      document.getElementById('upSubject').value = '';
      document.getElementById('upCustomFileName').value = '';
      document.getElementById('upBranch').disabled = true;
      document.getElementById('upSubject').disabled = true;
      await loadStats();
      await loadRecentFiles();
    } else {
      showUploadAlert(data.error || 'Upload failed.', 'error');
      progressFill.style.width = '0%';
    }
  } catch (e) {
    clearInterval(interval);
    showUploadAlert('Network error. Please try again.', 'error');
    progressFill.style.width = '0%';
  } finally {
    btn.disabled = false; btn.textContent = 'Upload Paper →';
    setTimeout(() => { progressWrap.style.display = 'none'; }, 2000);
  }
}

function showUploadAlert(msg, type) {
  const el = document.getElementById('uploadAlert');
  el.textContent = msg;
  el.className = `alert ${type}`;
  el.style.display = 'block';
  if (type === 'success') setTimeout(() => { el.style.display = 'none'; }, 4000);
}

// ── Recent files ──────────────────────────────────────────────────────────────
async function loadRecentFiles() {
  const res = await fetch('/admin/files');
  const files = await res.json();
  const el = document.getElementById('recentList');

  if (!files.length) {
    el.innerHTML = '<div class="empty-state small">No files uploaded yet</div>';
    return;
  }

  el.innerHTML = files.slice(0, 6).map(f => `
    <div class="recent-item">
      <div class="recent-dot"></div>
      <div>
        <div class="recent-name" title="${escHtml(f.originalName)}">${escHtml(f.originalName)}</div>
        <div class="recent-meta">${escHtml(f.year)} · ${escHtml(f.branch)} · ${formatDate(f.uploadDate)}</div>
      </div>
    </div>
  `).join('');
}

// ── Manage files panel ────────────────────────────────────────────────────────
window.currentFileTab = 'free';

window.switchFileTab = function(tab) {
  window.currentFileTab = tab;
  const freeBtn = document.getElementById('subTabFree');
  const premiumBtn = document.getElementById('subTabPremium');
  const freeList = document.getElementById('adminFileList');
  const premiumList = document.getElementById('adminPremiumFileList');

  if (tab === 'free') {
    freeBtn.style.color = 'var(--accent)';
    freeBtn.style.borderBottom = '2px solid var(--accent)';
    freeBtn.style.fontWeight = '600';
    premiumBtn.style.color = 'var(--text-secondary)';
    premiumBtn.style.borderBottom = '2px solid transparent';
    premiumBtn.style.fontWeight = '500';
    
    freeList.style.display = 'block';
    premiumList.style.display = 'none';
    
    loadAdminFiles();
  } else {
    premiumBtn.style.color = 'var(--accent)';
    premiumBtn.style.borderBottom = '2px solid var(--accent)';
    premiumBtn.style.fontWeight = '600';
    freeBtn.style.color = 'var(--text-secondary)';
    freeBtn.style.borderBottom = '2px solid transparent';
    freeBtn.style.fontWeight = '500';
    
    freeList.style.display = 'none';
    premiumList.style.display = 'block';
    
    window.loadPremiumAdminFilesForTab();
  }
};

window.loadPremiumAdminFilesForTab = async function () {
  const el = document.getElementById('adminPremiumFileList');
  if (!el) return;
  const year = document.getElementById('filterYear').value;
  const search = document.getElementById('filterSearch').value.toLowerCase();

  try {
    const res = await fetch('/admin/premium-files?t=' + Date.now());
    let files = await res.json();

    if (year) files = files.filter(f => f.year === year);
    if (search) files = files.filter(f => f.title.toLowerCase().includes(search) || (f.subject && f.subject.toLowerCase().includes(search)));

    if (!files || !files.length) {
      el.innerHTML = '<div class="empty-state small">No premium files found.</div>';
      return;
    }

    el.innerHTML = `
    <div class="file-table-wrap">
      <table class="file-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Title</th>
            <th>Year/Branch</th>
            <th>Price</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${files.map(f => {
      let badge = '';
      if (f.contentType === 'pyq') badge = '<span class="badge" style="background:#f59e0b;color:#111">PYQ</span>';
      else if (f.contentType === 'notes') badge = '<span class="badge" style="background:#8b5cf6;color:#fff">Notes</span>';
      else badge = `<span class="badge" style="background:#ec4899;color:#fff">${f.contentType || 'Other'}</span>`;

      return `
            <tr>
              <td>${badge}</td>
              <td><a href="${escHtml(f.pdfUrl)}" target="_blank" style="color:var(--accent); font-weight: 500;">${escHtml(f.title)}</a></td>
              <td><span class="badge badge-year" style="font-size:0.7rem">${escHtml(f.year)}</span> <span class="badge badge-branch" style="font-size:0.7rem">${escHtml(f.branch)}</span></td>
              <td style="color:#10b981; font-weight:600;">₹${f.price}</td>
              <td>
                <div style="display:flex; gap:6px; align-items:center;">
                  <button class="btn-edit small" onclick="openEditPremiumModal('${escHtml(f._id)}')">Edit</button>
                  <button class="btn-del small" onclick="openDeleteModal('${escHtml(f._id)}', '${escHtml(f.title).replace(/'/g, "\\'")}', 'premium')">Delete</button>
                </div>
              </td>
            </tr>
            `;
    }).join('')}
        </tbody>
      </table>
    </div>`;
  } catch (e) {
    el.innerHTML = '<div class="empty-state small" style="color:var(--danger)">Failed to load premium files</div>';
  }
};

async function loadAdminFiles() {
  const year = document.getElementById('filterYear').value;
  const search = document.getElementById('filterSearch').value;
  const params = new URLSearchParams();
  if (year) params.append('year', year);
  if (search) params.append('search', search);

  const res = await fetch(`/admin/files?${params}`);
  const files = await res.json();
  const el = document.getElementById('adminFileList');

  if (!files.length) {
    el.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📭</span>
        No papers found. Upload some!
      </div>`;
    return;
  }

  el.innerHTML = `
    <div class="file-table-wrap">
      <table class="file-table">
        <thead>
          <tr>
            <th>File Name</th>
            <th>Year/Branch</th>
            <th>Sem</th>
            <th>Subject</th>
            <th>Solution</th>
            <th>Size</th>
            <th>Uploaded</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${files.map(f => {
            const hasSol = Boolean(f.solutionUrl);
            const solBadge = hasSol 
              ? `<a href="${escHtml(f.solutionUrl)}" target="_blank" rel="noopener noreferrer" class="badge" style="background:rgba(16,185,129,0.15); color:#10b981; border:1px solid rgba(16,185,129,0.3); font-size:0.75rem; text-decoration:none; display:inline-flex; align-items:center; gap:3px;" title="${escHtml(f.solutionOriginalName || 'Solution')}">✓ Solved</a>` 
              : `<span style="color:var(--muted); font-size:0.75rem;">None</span>`;
            
            return `
            <tr>
              <td><a href="${escHtml(f.url)}" target="_blank" style="color:var(--accent)">${escHtml(f.originalName)}</a></td>
              <td><span class="badge badge-year" style="font-size:0.7rem">${escHtml(f.year)}</span> <span class="badge badge-branch" style="font-size:0.7rem">${escHtml(f.branch)}</span></td>
              <td><span class="badge" style="background:var(--card-bg); color:var(--text); border:1px solid var(--border); font-size:0.7rem">${escHtml(f.semester || '—')}</span></td>
              <td>${escHtml(f.subject)}</td>
              <td>${solBadge}</td>
              <td>${formatSize(f.size)}</td>
              <td>${formatDate(f.uploadDate)}</td>
              <td>
                <button class="btn-ghost" style="font-size: 0.75rem; padding: 0.2rem 0.5rem; margin-right: 0.3rem; ${hasSol ? '' : 'color:var(--accent); border-color:var(--accent);'}" onclick="openSolutionModal('${escHtml(f._id)}', '${escHtml(f.originalName)}', '${escHtml(f.solutionUrl || '')}', '${escHtml(f.solutionType || 'none')}', '${escHtml(f.solutionOriginalName || '')}')">${hasSol ? 'Edit Sol' : '+ Solution'}</button>
                <button class="btn-primary" style="font-size: 0.75rem; padding: 0.2rem 0.5rem; margin-right: 0.3rem;" onclick="openGateModal('${escHtml(f._id)}', '${escHtml(f.originalName)}', '${f.downloadGate ? escHtml(f.downloadGate.type) : 'none'}', '${f.downloadGate ? escHtml(f.downloadGate.whatsappUrl || '') : ''}')">Gate</button>
                <button class="btn-del" onclick="openDeleteModal('${escHtml(f._id)}', '${escHtml(f.originalName)}')">Delete</button>
              </td>
            </tr>
          `}).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ── Delete modal ──────────────────────────────────────────────────────────────
function openDeleteModal(id, name, type = 'free') {
  deleteTargetId = id;
  deleteTargetType = type;
  document.getElementById('deleteModalText').textContent = `Delete "${name}"? This cannot be undone.`;
  document.getElementById('deleteModal').style.display = 'flex';
  document.getElementById('confirmDeleteBtn').onclick = type === 'premium' ? doPremiumDelete : doDelete;
}

function closeDeleteModal() {
  document.getElementById('deleteModal').style.display = 'none';
  deleteTargetId = null;
  deleteTargetType = 'free';
}

async function doDelete() {
  if (!deleteTargetId) return;
  const btn = document.getElementById('confirmDeleteBtn');
  btn.disabled = true; btn.textContent = 'Deleting…';

  try {
    const res = await fetch(`/admin/files/${deleteTargetId}`, { method: 'DELETE' });
    const data = await res.json();
    closeDeleteModal();
    if (data.success) {
      if (typeof loadStats === 'function') await loadStats();
      if (typeof loadAdminFiles === 'function') await loadAdminFiles();
      if (typeof loadRecentFiles === 'function') await loadRecentFiles();
    } else {
      alert(data.error || 'Delete failed.');
    }
  } catch (e) {
    alert('Network error. Please try again.');
  } finally {
    btn.disabled = false; btn.textContent = 'Delete';
  }
}

async function doPremiumDelete() {
  if (!deleteTargetId) return;
  const btn = document.getElementById('confirmDeleteBtn');
  btn.disabled = true; btn.textContent = 'Deleting…';

  try {
    const res = await fetch(`/admin/product/${deleteTargetId}`, { method: 'DELETE' });
    const data = await res.json();
    closeDeleteModal();

    if (data.success) {
      if (typeof window.loadPremiumAdminFiles === 'function') window.loadPremiumAdminFiles();
      if (typeof window.loadPremiumAdminFilesForTab === 'function') window.loadPremiumAdminFilesForTab();
    } else {
      alert(data.error || 'Delete failed.');
    }
  } catch (e) {
    closeDeleteModal();
    alert('Network error');
  } finally {
    btn.disabled = false; btn.textContent = 'Delete';
  }
}

// ── Download Gate modal ───────────────────────────────────────────────────────
let gateTargetId = null;

function openGateModal(id, name, type, waUrl) {
  gateTargetId = id;
  document.getElementById('gateModalText').textContent = `Settings for: ${name}`;
  document.getElementById('gateType').value = type || 'none';
  document.getElementById('gateWaUrl').value = waUrl || '';
  document.getElementById('gateAlert').style.display = 'none';
  
  toggleGateFields();
  document.getElementById('gateModal').style.display = 'flex';
}

function closeGateModal() {
  document.getElementById('gateModal').style.display = 'none';
  gateTargetId = null;
}

function toggleGateFields() {
  const type = document.getElementById('gateType').value;
  const waGroup = document.getElementById('gateWaGroup');
  if (waGroup) waGroup.style.display = (type === 'whatsapp') ? 'block' : 'none';
}

async function saveGateSettings() {
  if (!gateTargetId) return;
  const btn = document.getElementById('saveGateBtn');
  const alertEl = document.getElementById('gateAlert');
  
  const type = document.getElementById('gateType').value;
  const whatsappUrl = document.getElementById('gateWaUrl').value.trim();
  const enabled = type !== 'none';

  if (type === 'whatsapp' && !whatsappUrl) {
    alertEl.textContent = 'WhatsApp Group Link is required.';
    alertEl.className = 'alert error';
    alertEl.style.display = 'block';
    return;
  }

  btn.disabled = true; btn.textContent = 'Saving...';
  alertEl.style.display = 'none';

  try {
    const res = await fetch(`/admin/files/${gateTargetId}/gate`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, type, whatsappUrl })
    });
    const data = await res.json();
    if (data.success) {
      closeGateModal();
      await loadAdminFiles(); // Refresh list to reflect changes
    } else {
      alertEl.textContent = data.error || 'Failed to save settings.';
      alertEl.className = 'alert error';
      alertEl.style.display = 'block';
    }
  } catch (e) {
    alertEl.textContent = 'Network error. Please try again.';
    alertEl.className = 'alert error';
    alertEl.style.display = 'block';
  } finally {
    btn.disabled = false; btn.textContent = 'Save Settings';
  }
}

// ── Feedback ──────────────────────────────────────────────────────────────────
async function loadFeedback() {
  const el = document.getElementById('adminFeedbackList');
  if (!el) return;

  try {
    const res = await fetch('/admin/feedback');
    const list = await res.json();

    if (!list.length) {
      el.innerHTML = '<div class="empty-state"><span class="empty-icon">📭</span>No feedback received yet.</div>';
      return;
    }

    el.innerHTML = `<div class="fb-grid">
      ${list.map(f => `
        <div class="fb-card">
          <div class="fb-header">
            <div>
              <div class="fb-name">${escHtml(f.name)}</div>
              <div class="fb-date">${formatDate(f.date)}</div>
            </div>
            <button class="btn-del small" onclick="deleteFeedback('${f._id}')">Delete</button>
          </div>
          <div class="fb-msg">${escHtml(f.message)}</div>
        </div>
      `).join('')}
    </div>`;
  } catch (e) {
    el.innerHTML = '<div class="empty-state">Failed to load feedback.</div>';
  }
}

async function deleteFeedback(id) {
  if (!confirm('Delete this feedback?')) return;
  try {
    const res = await fetch(`/admin/feedback/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      loadFeedback();
    } else {
      alert(data.error || 'Failed to delete');
    }
  } catch (e) {
    alert('Network error');
  }
}

// ── Categories ────────────────────────────────────────────────────────────────
async function loadCatStructure() {
  const res = await fetch('/api/config');
  const data = await res.json();
  const el = document.getElementById('catStructure');

  el.innerHTML = Object.entries(data).map(([key, yearData]) => {
    let subjectsHtml = '';
    if (yearData.subjects) {
      if (Array.isArray(yearData.subjects)) {
        if (yearData.subjects.length > 0) {
          subjectsHtml = `
            <div style="margin-bottom:.4rem;font-size:.78rem;color:var(--muted)">Subjects:</div>
            <div class="cat-tag-list">
              ${yearData.subjects.map(s => `<span class="cat-tag">${escHtml(s)}</span>`).join('')}
            </div>
          `;
        }
      } else if (typeof yearData.subjects === 'object') {
        const entries = Object.entries(yearData.subjects);
        const hasSubjects = entries.some(([_, subjs]) => {
          if (!subjs) return false;
          if (Array.isArray(subjs)) return subjs.length > 0;
          return Object.values(subjs).some(arr => arr && arr.length > 0);
        });
        if (hasSubjects) {
          subjectsHtml = `
            <div style="margin-bottom:.4rem;font-size:.78rem;color:var(--muted)">Subjects by Branch:</div>
            <div style="display:flex; flex-direction:column; gap:0.5rem; padding-left:0.5rem; border-left: 2px solid var(--border);">
              ${entries.map(([branchName, subjs]) => {
                if (!subjs) return '';
                if (Array.isArray(subjs)) {
                  if (!subjs.length) return '';
                  return `
                    <div>
                      <div style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.2rem; font-weight:600;">${escHtml(branchName)}:</div>
                      <div class="cat-tag-list">
                        ${subjs.map(s => `<span class="cat-tag">${escHtml(s)}</span>`).join('')}
                      </div>
                    </div>
                  `;
                } else {
                  const patternEntries = Object.entries(subjs);
                  const hasPatternSubjects = patternEntries.some(([_, sList]) => sList && sList.length > 0);
                  if (!hasPatternSubjects) return '';
                  return `
                    <div>
                      <div style="font-size:0.75rem; color:var(--text-secondary); margin-bottom:0.2rem; font-weight:600;">${escHtml(branchName)}:</div>
                      <div style="display:flex; flex-direction:column; gap:0.3rem; padding-left:0.5rem; margin-top:0.2rem;">
                        ${patternEntries.map(([patternName, sList]) => {
                          if (!sList || !sList.length) return '';
                          return `
                            <div>
                              <div style="font-size:0.7rem; color:var(--muted); margin-bottom:0.1rem; font-style:italic;">${escHtml(patternName)}:</div>
                              <div class="cat-tag-list">
                                ${sList.map(s => `<span class="cat-tag">${escHtml(s)}</span>`).join('')}
                              </div>
                            </div>
                          `;
                        }).join('')}
                      </div>
                    </div>
                  `;
                }
              }).join('')}
            </div>
          `;
        }
      }
    }

    return `
      <div class="cat-year-block">
        <div class="cat-year-title">${escHtml(yearData.label)}</div>
        <div style="margin-bottom:.4rem;font-size:.78rem;color:var(--muted)">Branches:</div>
        <div class="cat-tag-list" style="margin-bottom:.6rem">
          ${yearData.branches.map(b => `<span class="cat-tag">${escHtml(b)}</span>`).join('')}
        </div>
        ${subjectsHtml}
      </div>
    `;
  }).join('');
}

function onCatYearChange() {
  const year = document.getElementById('catYear').value;
  const branchGroup = document.getElementById('catBranchGroup');
  const branchSelect = document.getElementById('catBranchSelect');
  const patternGroup = document.getElementById('catPatternGroup');

  branchSelect.innerHTML = '<option value="">— Select Branch —</option>';
  branchGroup.style.display = 'none';
  patternGroup.style.display = 'none';

  if (!year || year === 'first') return;

  if (CONFIG && CONFIG[year]) {
    const branches = CONFIG[year].branches || [];
    branches.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b;
      opt.textContent = b;
      branchSelect.appendChild(opt);
    });
    branchGroup.style.display = 'block';
    patternGroup.style.display = 'block';
  }
}
window.onCatYearChange = onCatYearChange;

async function addSubject() {
  const year = document.getElementById('catYear').value;
  const branch = document.getElementById('catBranchSelect').value;
  const pattern = document.getElementById('catPatternSelect').value;
  const subject = document.getElementById('catSubject').value.trim();
  
  if (!year) { showCatAlert('Select a year.', 'error'); return; }
  if (year !== 'first' && !branch) { showCatAlert('Select a branch.', 'error'); return; }
  if (year !== 'first' && !pattern) { showCatAlert('Select a pattern.', 'error'); return; }
  if (!subject) { showCatAlert('Enter a subject name.', 'error'); return; }

  const res = await fetch('/admin/config/subject', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ year, branch, subject, pattern })
  });
  const data = await res.json();
  if (data.success) {
    showCatAlert('Subject added!', 'success');
    document.getElementById('catSubject').value = '';
    await loadCatStructure();
    await loadConfig();
  } else {
    showCatAlert(data.error || 'Failed.', 'error');
  }
}

async function addBranch() {
  const year = document.getElementById('catBYear').value;
  const branch = document.getElementById('catBranch').value.trim();
  if (!branch) { showCatBAlert('Enter a branch name.', 'error'); return; }

  const res = await fetch('/admin/config/branch', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ year, branch })
  });
  const data = await res.json();
  if (data.success) {
    showCatBAlert('Branch added!', 'success');
    document.getElementById('catBranch').value = '';
    await loadCatStructure();
    await loadConfig();
  } else {
    showCatBAlert(data.error || 'Failed.', 'error');
  }
}

function showCatAlert(msg, type) {
  const el = document.getElementById('catAlert');
  el.textContent = msg; el.className = `alert ${type}`; el.style.display = 'block';
  if (type === 'success') setTimeout(() => { el.style.display = 'none'; }, 3000);
}
function showCatBAlert(msg, type) {
  const el = document.getElementById('catBAlert');
  el.textContent = msg; el.className = `alert ${type}`; el.style.display = 'block';
  if (type === 'success') setTimeout(() => { el.style.display = 'none'; }, 3000);
}

// ── Password change ───────────────────────────────────────────────────────────
async function doChangePassword() {
  const cur = document.getElementById('pwCurrent').value;
  const nw = document.getElementById('pwNew').value;
  const conf = document.getElementById('pwConfirm').value;
  const el = document.getElementById('pwAlert');

  el.style.display = 'none';

  if (!cur || !nw || !conf) { showPwAlert('All fields are required.', 'error'); return; }
  if (nw !== conf) { showPwAlert('New passwords do not match.', 'error'); return; }
  if (nw.length < 8) { showPwAlert('Password must be at least 8 characters.', 'error'); return; }

  const res = await fetch('/auth/change-password', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword: cur, newPassword: nw })
  });
  const data = await res.json();
  if (data.success) {
    showPwAlert('Password updated successfully! ✓', 'success');
    document.getElementById('pwCurrent').value = '';
    document.getElementById('pwNew').value = '';
    document.getElementById('pwConfirm').value = '';
  } else {
    showPwAlert(data.error || 'Failed to update password.', 'error');
  }
}

function showPwAlert(msg, type) {
  const el = document.getElementById('pwAlert');
  el.textContent = msg; el.className = `alert ${type}`; el.style.display = 'block';
}

// ── Logout ────────────────────────────────────────────────────────────────────
async function doLogout() {
  await fetch('/auth/logout', { method: 'POST' });
  window.location.href = '/login.html';
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Close modal on background click ──────────────────────────────────────────
document.getElementById('deleteModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeDeleteModal();
});

// ── Premium Upload & Listing ──────────────────────────────────────────────────
window.onPremiumFileSelect = function (input) {
  const file = input.files[0];
  if (!file) return;
  if (file.size > 20 * 1024 * 1024) {
    showPrmAlert('File exceeds 20MB limit.', 'error'); return;
  }
  document.getElementById('prmDropzone').style.display = 'none';
  document.getElementById('prmFilePreview').style.display = 'flex';
  document.getElementById('prmFileNameDisplay').textContent = `${file.name} (${formatSize(file.size)})`;
}

window.clearPremiumFile = function () {
  const prmPdfInput = document.getElementById('prmPdfInput');
  if (prmPdfInput) prmPdfInput.value = '';
  const dropzone = document.getElementById('prmDropzone');
  if (dropzone) dropzone.style.display = 'block';
  const filePreview = document.getElementById('prmFilePreview');
  if (filePreview) filePreview.style.display = 'none';
}

window.onPrmYearChange = function () {
  const year = document.getElementById('prmYear').value;
  const branch = document.getElementById('prmBranch');
  const branchPatternRow = document.getElementById('prmBranchPatternRow');
  const patternGroup = document.getElementById('prmPatternGroup');

  if (branch) {
    branch.innerHTML = '<option value="">— Select Branch —</option>';
    branch.disabled = true;
  }

  if (branchPatternRow && patternGroup) {
    if (year && year !== 'first') {
      branchPatternRow.style.display = 'flex';
      patternGroup.style.display = 'block';
    } else if (year === 'first') {
      branchPatternRow.style.display = 'flex';
      patternGroup.style.display = 'none';
    } else {
      branchPatternRow.style.display = 'none';
      patternGroup.style.display = 'none';
    }
  }

  if (!year || !CONFIG[year]) {
    if (year === 'first') {
      const opt = document.createElement('option');
      opt.value = 'FE'; opt.textContent = 'FE';
      branch.appendChild(opt);
      branch.value = 'FE';
    }
    return;
  }

  const branches = CONFIG[year].branches;
  branches.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b; opt.textContent = b;
    branch.appendChild(opt);
  });
  branch.disabled = false;
}

window.doPremiumUpload = async function () {
  const type = document.getElementById('prmType').value;
  const year = document.getElementById('prmYear').value;
  const branch = document.getElementById('prmBranch').value;
  const title = document.getElementById('prmSubject').value.trim();
  const price = document.getElementById('prmPrice').value;
  const file = document.getElementById('prmPdfInput').files[0];
  const linkUrl = document.getElementById('prmLink').value.trim();

  if (!type) { showPrmAlert('Please select a content type.', 'error'); return; }
  if (!year) { showPrmAlert('Please select a year.', 'error'); return; }
  if (!branch) { showPrmAlert('Please select a branch.', 'error'); return; }
  if (!title) { showPrmAlert('Please enter a product title.', 'error'); return; }
  if (!price) { showPrmAlert('Please enter a price.', 'error'); return; }

  if (currentPrmUploadMethod === 'file') {
    if (!file) { showPrmAlert('Please select a PDF file.', 'error'); return; }
  } else {
    if (!linkUrl) { showPrmAlert('Please enter a Google Drive / PDF Link.', 'error'); return; }
    const lines = linkUrl.split(/[\r\n,]+/).map(u => u.trim()).filter(Boolean);
    if (!lines.length) { showPrmAlert('Please enter a Google Drive / PDF Link.', 'error'); return; }
    for (const line of lines) {
      if (!line.startsWith('http://') && !line.startsWith('https://')) {
        showPrmAlert(`Invalid URL: "${line}". All links must start with http:// or https://`, 'error'); return;
      }
    }
  }

  const btn = document.getElementById('prmUploadBtn');
  btn.disabled = true; btn.textContent = 'Uploading…';

  const progressWrap = document.getElementById('prmUploadProgress');
  const progressFill = document.getElementById('prmProgressFill');
  const progressText = document.getElementById('prmProgressText');
  progressWrap.style.display = 'block';
  progressFill.style.width = '0%';

  let prog = 0;
  const interval = setInterval(() => {
    prog = Math.min(prog + 8, 85);
    progressFill.style.width = `${prog}%`;
    progressText.textContent = `Uploading… ${prog}%`;
  }, 150);

  const desc = document.getElementById('prmDesc').value.trim();
  const thumbnail = document.getElementById('prmThumbnail').value.trim();
  const originalPrice = document.getElementById('prmOriginalPrice') ? document.getElementById('prmOriginalPrice').value.trim() : '';

  const fd = new FormData();
  fd.append('contentType', type);
  fd.append('year', year);
  fd.append('branch', branch);
  fd.append('title', title);
  fd.append('price', price);
  if (originalPrice) fd.append('originalPrice', originalPrice);
  if (desc) fd.append('description', desc);
  if (thumbnail) fd.append('thumbnailUrl', thumbnail);
  
  if (currentPrmUploadMethod === 'file') {
    fd.append('pdf', file);
  } else {
    fd.append('isLink', 'true');
    fd.append('linkUrl', linkUrl);
  }

  try {
    const res = await fetch('/admin/product', { method: 'POST', body: fd });
    const data = await res.json();
    clearInterval(interval);

    if (data.success) {
      progressFill.style.width = '100%';
      progressText.textContent = 'Upload complete!';
      showPrmAlert('Premium content uploaded successfully! ✨', 'success');
      window.clearPremiumFile();
      document.getElementById('prmLink').value = '';
      document.getElementById('prmType').value = '';
      document.getElementById('prmYear').value = '';
      document.getElementById('prmBranch').value = '';
      if (typeof semesterEl !== 'undefined' && semesterEl) semesterEl.value = '';
      document.getElementById('prmSubject').value = '';
      document.getElementById('prmPrice').value = '';
      if (document.getElementById('prmOriginalPrice')) document.getElementById('prmOriginalPrice').value = '';

      // Don't disable branch, let user upload another quickly
      // document.getElementById('prmBranch').disabled = true;

      await window.loadPremiumAdminFiles();
    } else {
      showPrmAlert(data.error || 'Upload failed.', 'error');
      progressFill.style.width = '0%';
    }
  } catch (e) {
    clearInterval(interval);
    console.error("Dashboard upload error:", e);
    showPrmAlert(e.message || 'Network error. Please try again.', 'error');
    progressFill.style.width = '0%';
  } finally {
    btn.disabled = false; btn.textContent = 'Upload Premium File ✨';
    setTimeout(() => { progressWrap.style.display = 'none'; }, 2000);
  }
}

function showPrmAlert(msg, type) {
  const el = document.getElementById('premiumAlert');
  el.textContent = msg; el.className = `alert ${type}`; el.style.display = 'block';
  if (type === 'success') setTimeout(() => { el.style.display = 'none'; }, 4000);
}

window.loadPremiumAdminFiles = async function () {
  const el = document.getElementById('premiumAdminFileList');
  if (!el) return;

  try {
    const res = await fetch('/admin/premium-files?t=' + Date.now());
    const files = await res.json();

    if (!files || !files.length) {
      el.innerHTML = '<div class="empty-state small">No premium files found.</div>';
      return;
    }

    el.innerHTML = `
    <div class="file-table-wrap">
      <table class="file-table">
        <thead>
          <tr>
            <th>Type</th>
            <th>Title</th>
            <th>Year/Branch</th>
            <th>Price</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${files.map(f => {
      let badge = '';
      if (f.contentType === 'pyq') badge = '<span class="badge" style="background:#f59e0b;color:#111">PYQ</span>';
      else if (f.contentType === 'notes') badge = '<span class="badge" style="background:#8b5cf6;color:#fff">Notes</span>';
      else badge = `<span class="badge" style="background:#ec4899;color:#fff">${f.contentType || 'Other'}</span>`;

      return `
            <tr>
              <td>${badge}</td>
              <td><a href="${escHtml(f.pdfUrl)}" target="_blank" style="color:var(--accent); font-weight: 500;">${escHtml(f.title)}</a></td>
              <td><span class="badge badge-year" style="font-size:0.7rem">${escHtml(f.year)}</span> <span class="badge badge-branch" style="font-size:0.7rem">${escHtml(f.branch)}</span></td>
              <td style="color:#10b981; font-weight:600;">₹${f.price}</td>
              <td>
                <div style="display:flex; gap:6px; align-items:center;">
                  <button class="btn-edit small" onclick="openEditPremiumModal('${escHtml(f._id)}')">Edit</button>
                  <button class="btn-del small" onclick="openDeleteModal('${escHtml(f._id)}', '${escHtml(f.title).replace(/'/g, "\\'")}', 'premium')">Delete</button>
                </div>
              </td>
            </tr>
            `;
    }).join('')}
        </tbody>
      </table>
    </div>`;
  } catch (e) {
    el.innerHTML = '<div class="empty-state small">Error loading premium files.</div>';
  }
}

window.loadAdminStudents = async function () {
  const el = document.getElementById('adminStudentList');
  if (!el) return;

  try {
    const res = await fetch('/admin/students');
    const students = await res.json();

    if (!students || !students.length) {
      el.innerHTML = '<div class="empty-state">No student accounts created yet.</div>';
      return;
    }

    el.innerHTML = `
    <div class="file-table-wrap">
      <table class="file-table">
        <thead>
          <tr>
            <th>Student Username</th>
            <th>Email Addr.</th>
            <th>Premium Status</th>
            <th>Account Registered Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${students.map(s => {
      let premiumBadge = '<span class="badge" style="background:var(--muted); color:#fff">Free</span>';
      if (s.isPremium) premiumBadge = '<span class="badge" style="background:#10b981; color:#fff">Premium ✨</span>';
      else if (s.premiumStatus === 'pending') premiumBadge = '<span class="badge" style="background:#f59e0b; color:#111">Pending ⏳</span>';

      const revokeBtn = s.isPremium
        ? `<button class="btn-del small" onclick="window.revokePremium('${s._id}')" style="padding: 4px 10px;">Revoke</button>`
        : '';

      return `
            <tr>
              <td style="font-weight:600; color:var(--text)">@${escHtml(s.username)}</td>
              <td style="color:var(--muted)">${escHtml(s.email)}</td>
              <td>${premiumBadge}</td>
              <td>${formatDate(s.registeredAt)}</td>
              <td>${revokeBtn}</td>
            </tr>
            `;
    }).join('')}
        </tbody>
      </table>
    </div>`;
  } catch (e) {
    el.innerHTML = '<div class="empty-state">Error loading students list.</div>';
  }
}

window.loadPremiumRequests = async function () {
  const el = document.getElementById('premiumRequestList');
  if (!el) return;

  try {
    const res = await fetch('/admin/premium-requests');
    const requests = await res.json();

    if (!requests || !requests.length) {
      el.innerHTML = '<div class="empty-state">No pending premium requests.</div>';
      return;
    }

    el.innerHTML = `
    <div class="file-table-wrap">
      <table class="file-table">
        <thead>
          <tr>
            <th>Username</th>
            <th>Email</th>
            <th>Requested Date</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${requests.map(r => `
            <tr>
              <td style="font-weight:600; color:var(--text)">@${escHtml(r.username)}</td>
              <td style="color:var(--muted)">${escHtml(r.email)}</td>
              <td>${formatDate(r.requestedAt || r.registeredAt)}</td>
              <td>
                <div style="display:flex; gap:0.5rem;">
                  <button class="btn-primary small" onclick="window.approvePremium('${r._id}')" style="background:#10b981; border-color:#10b981; padding: 4px 10px;">Approve</button>
                  <button class="btn-del small" onclick="window.rejectPremium('${r._id}')" style="padding: 4px 10px;">Reject</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
  } catch (e) {
    el.innerHTML = '<div class="empty-state">Error loading requests.</div>';
  }
}


window.approvePremium = async function (id) {
  if (!confirm('Approve this student for Premium access?')) return;
  try {
    const res = await fetch(`/admin/approve-premium/${id}`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      alert(data.message);
      window.loadPremiumRequests();
      loadStats();
    } else {
      alert(data.error || 'Failed to approve');
    }
  } catch (e) {
    alert('Network error');
  }
}

window.rejectPremium = async function (id) {
  if (!confirm('Reject this premium request?')) return;
  try {
    const res = await fetch(`/admin/reject-premium/${id}`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      alert(data.message);
      window.loadPremiumRequests();
      loadStats();
    } else {
      alert(data.error || 'Failed to reject');
    }
  } catch (e) {
    alert('Network error');
  }
}

window.revokePremium = async function (id) {
  if (!confirm('Are you sure you want to REVOKE premium access for this student?')) return;
  try {
    const res = await fetch(`/admin/revoke-premium/${id}`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      alert(data.message);
      window.loadAdminStudents();
      loadStats();
    } else {
      alert(data.error || 'Failed to revoke');
    }
  } catch (e) {
    alert('Network error');
  }
};

// ── Start ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);


window.deleteProduct = async function (id) {
  if (!confirm('Are you sure you want to delete this premium product?')) return;
  try {
    const res = await fetch('/admin/product/' + id, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      alert('Product deleted successfully');
      if (typeof window.loadPremiumAdminFiles === 'function') window.loadPremiumAdminFiles();
      if (typeof window.loadPremiumAdminFilesForTab === 'function') window.loadPremiumAdminFilesForTab();
    } else {
      alert(data.error || 'Failed to delete product');
    }
  } catch (e) {
    alert('Network error during deletion');
  }
};

window.loadEarningsAnalytics = async function () {
  const el = document.getElementById('earningsList');
  if (!el) return;
  
  try {
    const res = await fetch('/admin/analytics');
    const data = await res.json();
    
    if (data.success) {
      document.getElementById('totalEarningsVal').textContent = `₹${data.totalEarnings || 0}`;
      document.getElementById('totalSalesVal').textContent = data.totalSales || 0;
      
      const purchases = data.recentPurchases;
      if (!purchases || !purchases.length) {
        el.innerHTML = '<div class="empty-state small">No sales yet. Keep going!</div>';
        return;
      }
      
      el.innerHTML = `
      <div class="file-table-wrap">
        <table class="file-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Student</th>
              <th>Product</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${purchases.map(p => {
              const date = new Date(p.purchasedAt).toLocaleDateString();
              const studentName = p.user ? escHtml(p.user.username) : 'Unknown';
              const productTitle = p.product ? escHtml(p.product.title) : 'Unknown Product';
              return `
                <tr>
                  <td><span class="badge" style="background:var(--surface2); color:var(--text);">${date}</span></td>
                  <td>${studentName}</td>
                  <td style="color:var(--accent); font-weight:500;">${productTitle}</td>
                  <td style="color:#10b981; font-weight:600;">₹${p.pricePaid}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>`;
    }
  } catch (err) {
    console.error('Failed to load earnings', err);
    el.innerHTML = '<div class="empty-state small">Error loading analytics data.</div>';
  }
};

window.onPrmYearChange = function() {
  const year = document.getElementById('prmYear').value;
  const branch = document.getElementById('prmBranch');
  const subj = document.getElementById('prmSubjectDropdown');
  const patternGroup = document.getElementById('prmPatternGroup');

  branch.innerHTML = '<option value="">— Select Branch —</option>';
  if (subj) subj.innerHTML = '<option value="">— Select Subject —</option><option value="__custom__">+ Type custom subject…</option>';
  branch.disabled = true;
  if (subj) subj.disabled = true;

  if (patternGroup) {
    if (year && year !== 'first') {
      patternGroup.style.display = 'block';
    } else {
      patternGroup.style.display = 'none';
    }
  }

  if (!year || !CONFIG[year]) return;

  const branches = CONFIG[year].branches;
  branches.forEach(b => {
    const opt = document.createElement('option');
    opt.value = b; opt.textContent = b;
    branch.appendChild(opt);
  });
  branch.disabled = false;
};

window.onPrmPatternChange = function() {
  window.onPrmBranchChange();
};

window.onPrmBranchChange = function() {
  const year = document.getElementById('prmYear').value;
  const branchVal = document.getElementById('prmBranch').value;
  const patternVal = document.getElementById('prmPattern') ? document.getElementById('prmPattern').value : '2024 Pattern';
  const subj = document.getElementById('prmSubjectDropdown');
  if (!subj) return;

  subj.innerHTML = '<option value="">— Select Subject —</option><option value="__custom__">+ Type custom subject…</option>';
  subj.disabled = true;

  if (!year || !CONFIG[year]) return;

  let subjects = [];
  if (CONFIG[year].subjects) {
    if (Array.isArray(CONFIG[year].subjects)) {
      subjects = CONFIG[year].subjects;
    } else if (typeof CONFIG[year].subjects === 'object') {
      const branchData = CONFIG[year].subjects[branchVal];
      if (branchData) {
        if (Array.isArray(branchData)) {
          subjects = branchData;
        } else if (typeof branchData === 'object') {
          subjects = branchData[patternVal] || [];
        }
      }
    }
  }

  subjects.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s; opt.textContent = s;
    subj.appendChild(opt);
  });
  subj.disabled = false;

  subj.onchange = function () {
    const customGroup = document.getElementById('prmCustomSubjectGroup');
    if (customGroup) customGroup.style.display = this.value === '__custom__' ? 'block' : 'none';
    
    // Auto-fill Product Title
    const titleInput = document.getElementById('prmSubject');
    if (titleInput && this.value && this.value !== '__custom__') {
      titleInput.value = this.value;
    }
  };
};

// ── BANNER CONFIG ─────────────────────────────────────────────────────────────
async function loadBannerConfig() {
  try {
    const res = await fetch('/admin/banner');
    if (res.ok) {
      const data = await res.json();
      document.getElementById('bannerIsActive').checked = data.isActive;
      document.getElementById('bannerText').value = data.text || '';
      document.getElementById('bannerLink').value = data.link || '';
    }
  } catch (err) {
    console.error('Failed to load banner config', err);
  }
}

async function saveBannerConfig() {
  const alertBox = document.getElementById('bannerAlert');
  alertBox.style.display = 'none';

  const text = document.getElementById('bannerText').value.trim();
  const link = document.getElementById('bannerLink').value.trim();
  const isActive = document.getElementById('bannerIsActive').checked;

  if (isActive && !text) {
    alertBox.textContent = 'Banner text is required when banner is active.';
    alertBox.className = 'alert error';
    alertBox.style.display = 'block';
    return;
  }

  try {
    const res = await fetch('/admin/banner', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text, link, isActive })
    });
    
    const data = await res.json();
    if (res.ok && data.success) {
      alertBox.textContent = 'Banner settings saved successfully!';
      alertBox.className = 'alert success';
      alertBox.style.display = 'block';
    } else {
      throw new Error(data.error || 'Failed to save');
    }
  } catch (err) {
    alertBox.textContent = err.message;
    alertBox.className = 'alert error';
    alertBox.style.display = 'block';
  }
}

// ── Solution modal ────────────────────────────────────────────────────────────
let solModalTargetId = null;
let solModalMethod = 'file';

function openSolutionModal(id, paperName, currentUrl, currentType, currentOriginalName) {
  solModalTargetId = id;
  const header = document.getElementById('solModalHeader');
  const paperTitle = document.getElementById('solModalPaperName');
  const curStatus = document.getElementById('solCurrentStatus');
  const btnRemove = document.getElementById('btnRemoveSolution');
  const alertEl = document.getElementById('solModalAlert');
  const fileDropText = document.getElementById('modalSolDropText');
  const fileInp = document.getElementById('modalSolPdfInput');
  const linkInp = document.getElementById('modalSolLinkInput');
  const titleInp = document.getElementById('modalSolTitleInput');

  if (alertEl) alertEl.style.display = 'none';
  if (fileInp) fileInp.value = '';
  if (fileDropText) fileDropText.textContent = 'Click to select Solution PDF';

  if (paperTitle) paperTitle.textContent = `Paper: ${paperName}`;

  if (currentUrl) {
    if (header) header.textContent = 'Edit Solution';
    if (curStatus) {
      curStatus.innerHTML = `<strong>Current Solution:</strong> <a href="${escHtml(currentUrl)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent);">${escHtml(currentOriginalName || 'View Solution Link')}</a> <span class="badge" style="margin-left:6px; font-size:0.75rem;">${currentType === 'link' ? '🔗 External Link' : '📄 File Upload'}</span>`;
      curStatus.style.display = 'block';
    }
    if (btnRemove) btnRemove.style.display = 'inline-block';
    if (linkInp && currentType === 'link') linkInp.value = currentUrl;
    if (titleInp) titleInp.value = currentOriginalName || '';
    setModalSolutionMethod(currentType === 'link' ? 'link' : 'file');
  } else {
    if (header) header.textContent = 'Attach Solution';
    if (curStatus) {
      curStatus.innerHTML = `<span style="color:var(--muted)">No solution attached to this question paper yet.</span>`;
      curStatus.style.display = 'block';
    }
    if (btnRemove) btnRemove.style.display = 'none';
    if (linkInp) linkInp.value = '';
    if (titleInp) titleInp.value = paperName.replace(/\.pdf$/i, '') + '_Solution.pdf';
    setModalSolutionMethod('file');
  }

  const modal = document.getElementById('solutionModal');
  if (modal) modal.style.display = 'flex';
}
window.openSolutionModal = openSolutionModal;

function closeSolutionModal() {
  const modal = document.getElementById('solutionModal');
  if (modal) modal.style.display = 'none';
  solModalTargetId = null;
}
window.closeSolutionModal = closeSolutionModal;

function setModalSolutionMethod(method) {
  solModalMethod = method;
  const btnFile = document.getElementById('modalBtnSolFile');
  const btnLink = document.getElementById('modalBtnSolLink');
  const fileWrap = document.getElementById('modalSolFileWrap');
  const linkWrap = document.getElementById('modalSolLinkWrap');

  if (method === 'file') {
    if (fileWrap) fileWrap.style.display = 'block';
    if (linkWrap) linkWrap.style.display = 'none';
    if (btnFile) {
      btnFile.style.borderColor = 'var(--accent)';
      btnFile.style.background = 'rgba(99,102,241,.15)';
      btnFile.style.color = 'var(--accent)';
    }
    if (btnLink) {
      btnLink.style.borderColor = '';
      btnLink.style.background = '';
      btnLink.style.color = '';
    }
  } else {
    if (fileWrap) fileWrap.style.display = 'none';
    if (linkWrap) linkWrap.style.display = 'block';
    if (btnLink) {
      btnLink.style.borderColor = 'var(--accent)';
      btnLink.style.background = 'rgba(99,102,241,.15)';
      btnLink.style.color = 'var(--accent)';
    }
    if (btnFile) {
      btnFile.style.borderColor = '';
      btnFile.style.background = '';
      btnFile.style.color = '';
    }
  }
}
window.setModalSolutionMethod = setModalSolutionMethod;

function onModalSolFileSelect(input) {
  const file = input.files[0];
  const dropText = document.getElementById('modalSolDropText');
  if (file && dropText) {
    dropText.textContent = `Selected: ${file.name} (${formatSize(file.size)})`;
  }
}
window.onModalSolFileSelect = onModalSolFileSelect;

async function doSaveModalSolution() {
  if (!solModalTargetId) return;
  const alertEl = document.getElementById('solModalAlert');
  const btn = document.getElementById('saveSolutionBtn');
  const fileInp = document.getElementById('modalSolPdfInput');
  const linkInp = document.getElementById('modalSolLinkInput');
  const titleInp = document.getElementById('modalSolTitleInput');

  const file = fileInp && fileInp.files ? fileInp.files[0] : null;
  const link = linkInp ? linkInp.value.trim() : '';
  const title = titleInp ? titleInp.value.trim() : '';

  if (solModalMethod === 'file' && !file) {
    if (alertEl) {
      alertEl.textContent = 'Please choose a solution PDF file.';
      alertEl.className = 'alert error';
      alertEl.style.display = 'block';
    }
    return;
  }
  if (solModalMethod === 'link' && (!link || (!link.startsWith('http://') && !link.startsWith('https://')))) {
    if (alertEl) {
      alertEl.textContent = 'Please provide a valid URL starting with http:// or https://';
      alertEl.className = 'alert error';
      alertEl.style.display = 'block';
    }
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Saving…';
  if (alertEl) alertEl.style.display = 'none';

  const fd = new FormData();
  fd.append('paperId', solModalTargetId);
  fd.append('solutionType', solModalMethod);
  if (title) fd.append('solutionTitle', title);
  if (solModalMethod === 'file') {
    fd.append('solutionPdf', file);
  } else {
    fd.append('solutionLink', link);
  }

  try {
    const res = await fetch('/admin/upload-solution', { method: 'POST', body: fd });
    const data = await res.json();
    if (data.success) {
      closeSolutionModal();
      if (typeof loadAdminFiles === 'function') await loadAdminFiles();
      if (typeof loadSolutionTargetPapers === 'function') await loadSolutionTargetPapers();
    } else {
      if (alertEl) {
        alertEl.textContent = data.error || 'Failed to save solution.';
        alertEl.className = 'alert error';
        alertEl.style.display = 'block';
      }
    }
  } catch (err) {
    if (alertEl) {
      alertEl.textContent = 'Network error. Please try again.';
      alertEl.className = 'alert error';
      alertEl.style.display = 'block';
    }
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Solution';
  }
}
window.doSaveModalSolution = doSaveModalSolution;

async function doRemoveSolution() {
  if (!solModalTargetId) return;
  if (!confirm('Are you sure you want to remove the solution for this question paper?')) return;

  const btn = document.getElementById('btnRemoveSolution');
  const alertEl = document.getElementById('solModalAlert');
  btn.disabled = true;
  btn.textContent = 'Removing…';

  try {
    const res = await fetch(`/admin/files/${solModalTargetId}/solution`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      closeSolutionModal();
      if (typeof loadAdminFiles === 'function') await loadAdminFiles();
      if (typeof loadSolutionTargetPapers === 'function') await loadSolutionTargetPapers();
    } else {
      if (alertEl) {
        alertEl.textContent = data.error || 'Failed to remove solution.';
        alertEl.className = 'alert error';
        alertEl.style.display = 'block';
      }
    }
  } catch (err) {
    if (alertEl) {
      alertEl.textContent = 'Network error. Please try again.';
      alertEl.className = 'alert error';
      alertEl.style.display = 'block';
    }
  } finally {
    btn.disabled = false;
    btn.textContent = 'Remove Solution';
  }
}
window.doRemoveSolution = doRemoveSolution;

// ── EDIT PREMIUM FILE MODAL HANDLERS ──
window.openEditPremiumModal = async function(id) {
  const modal = document.getElementById('editPremiumModal');
  const alertEl = document.getElementById('editPrmAlert');
  if (alertEl) alertEl.style.display = 'none';

  try {
    const res = await fetch(`/admin/product/${id}`);
    const p = await res.json();
    if (!res.ok || !p) {
      alert(p.error || 'Failed to load product details');
      return;
    }

    document.getElementById('editPrmId').value = p._id;
    document.getElementById('editPrmTitle').value = p.title || '';
    document.getElementById('editPrmDesc').value = p.description || '';
    document.getElementById('editPrmOriginalPrice').value = p.originalPrice != null ? p.originalPrice : '';
    document.getElementById('editPrmPrice').value = p.price != null ? p.price : '';
    document.getElementById('editPrmType').value = p.contentType || 'pyq';
    document.getElementById('editPrmYear').value = p.year || 'first';
    document.getElementById('editPrmBranch').value = p.branch || '';
    document.getElementById('editPrmThumbnail').value = p.thumbnailUrl || '';
    document.getElementById('editPrmPdfUrl').value = p.pdfUrl || '';

    modal.style.display = 'flex';
  } catch (err) {
    console.error(err);
    alert('Error loading product details');
  }
};

window.closeEditPremiumModal = function() {
  const modal = document.getElementById('editPremiumModal');
  if (modal) modal.style.display = 'none';
};

window.saveEditPremium = async function() {
  const id = document.getElementById('editPrmId').value;
  const title = document.getElementById('editPrmTitle').value.trim();
  const price = document.getElementById('editPrmPrice').value;
  const originalPrice = document.getElementById('editPrmOriginalPrice').value;
  const contentType = document.getElementById('editPrmType').value;
  const year = document.getElementById('editPrmYear').value;
  const branch = document.getElementById('editPrmBranch').value.trim();
  const description = document.getElementById('editPrmDesc').value.trim();
  const thumbnailUrl = document.getElementById('editPrmThumbnail').value.trim();
  const pdfUrl = document.getElementById('editPrmPdfUrl').value.trim();
  const alertEl = document.getElementById('editPrmAlert');
  const btn = document.getElementById('saveEditPrmBtn');

  if (!title) {
    if (alertEl) {
      alertEl.textContent = 'Product title is required.';
      alertEl.className = 'alert error';
      alertEl.style.display = 'block';
    }
    return;
  }
  if (price === '') {
    if (alertEl) {
      alertEl.textContent = 'Price is required.';
      alertEl.className = 'alert error';
      alertEl.style.display = 'block';
    }
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    const res = await fetch(`/admin/product/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        price,
        originalPrice,
        contentType,
        year,
        branch,
        description,
        thumbnailUrl,
        pdfUrl
      })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      closeEditPremiumModal();
      if (typeof window.loadPremiumAdminFiles === 'function') await window.loadPremiumAdminFiles();
      if (typeof window.loadPremiumAdminFilesForTab === 'function') await window.loadPremiumAdminFilesForTab();
      if (typeof showPrmAlert === 'function') showPrmAlert('Premium file updated successfully! ✨', 'success');
    } else {
      if (alertEl) {
        alertEl.textContent = data.error || 'Failed to update product.';
        alertEl.className = 'alert error';
        alertEl.style.display = 'block';
      }
    }
  } catch (err) {
    console.error(err);
    if (alertEl) {
      alertEl.textContent = 'Network error updating product.';
      alertEl.className = 'alert error';
      alertEl.style.display = 'block';
    }
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save Changes ✨';
  }
};


