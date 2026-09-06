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
  
  // Auto select title if empty? Maybe let user do it.
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
