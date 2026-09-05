const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'public', 'js', 'dashboard.js');
let content = fs.readFileSync(filePath, 'utf8');

const regex = /window\.loadPremiumAdminFiles\s*=\s*async\s*function\s*\(\)\s*\{[\s\S]*?\}\s*catch\s*\([^)]+\)\s*\{[\s\S]*?\}\n\}/;

const newFunc = `window.loadPremiumAdminFiles = async function () {
  const el = document.getElementById('premiumAdminFileList');
  if (!el) return;

  try {
    const res = await fetch('/admin/premium-files');
    const files = await res.json();

    if (!files || !files.length) {
      el.innerHTML = '<div class="empty-state small">No premium files found.</div>';
      return;
    }

    el.innerHTML = \`
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
          \${files.map(f => {
      let badge = '';
      if (f.contentType === 'pyq') badge = '<span class="badge" style="background:#f59e0b;color:#111">PYQ</span>';
      else if (f.contentType === 'notes') badge = '<span class="badge" style="background:#8b5cf6;color:#fff">Notes</span>';
      else badge = \`<span class="badge" style="background:#ec4899;color:#fff">\${f.contentType || 'Other'}</span>\`;

      return \`
            <tr>
              <td>\${badge}</td>
              <td><a href="\${escHtml(f.pdfUrl)}" target="_blank" style="color:var(--accent); font-weight: 500;">\${escHtml(f.title)}</a></td>
              <td><span class="badge badge-year" style="font-size:0.7rem">\${escHtml(f.year)}</span> <span class="badge badge-branch" style="font-size:0.7rem">\${escHtml(f.branch)}</span></td>
              <td style="color:#10b981; font-weight:600;">₹\${f.price}</td>
              <td>
                <button class="btn-del small" onclick="window.deleteProduct('\${escHtml(f._id)}')">Delete</button>
              </td>
            </tr>
            \`;
    }).join('')}
        </tbody>
      </table>
    </div>\`;
  } catch (e) {
    el.innerHTML = '<div class="empty-state small">Error loading premium files.</div>';
  }
}`;

content = content.replace(regex, newFunc);
fs.writeFileSync(filePath, content);
console.log('Replaced function.');
