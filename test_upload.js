const http = require('http');
const FormData = require('form-data');
const fs = require('fs');

const form = new FormData();
form.append('contentType', 'notes');
form.append('year', 'second');
form.append('branch', 'AI & ML');
form.append('title', 'DSA');
form.append('price', '34');
form.append('isLink', 'true');
form.append('linkUrl', 'https://drive.google.com/file/d/test/view');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/admin/product',
  method: 'POST',
  headers: form.getHeaders()
};

// We need an admin session cookie.
// But wait, the route is protected by requireAdmin.
// Let's just bypass it for testing or log the error.
console.log('Sending request...');
const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    console.log(`BODY: ${chunk}`);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

form.pipe(req);
