const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'public', 'js', 'dashboard.js');
let content = fs.readFileSync(filePath, 'utf8');

const funcToAdd = `
window.deleteProduct = async function (id) {
  if (!confirm('Are you sure you want to delete this premium product?')) return;
  try {
    const res = await fetch('/admin/product/' + id, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      alert('Product deleted successfully');
      window.loadPremiumAdminFiles();
    } else {
      alert(data.error || 'Failed to delete product');
    }
  } catch (e) {
    alert('Network error during deletion');
  }
};
`;

if (content.includes('window.deleteProduct =')) {
  console.log('Already has deleteProduct definition');
} else {
  content += "\n" + funcToAdd;
  fs.writeFileSync(filePath, content);
  console.log('Appended window.deleteProduct');
}
