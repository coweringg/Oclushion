const fs = require('fs');
const path = require('path');

function walk(dir) {
  const results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory() && !file.includes('node_modules')) {
      results.push(...walk(filePath));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      results.push(filePath);
    }
  }
  return results;
}

const srcDir = path.join(__dirname, '..', 'apps', 'desktop-shell', 'src');
const files = walk(srcDir);
let count = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  if (content.includes('z.record(z.unknown())')) {
    content = content.replace(/z\.record\(z\.unknown\(\)\)/g, 'z.record(z.string(), z.unknown())');
    fs.writeFileSync(file, content, 'utf-8');
    count++;
    console.log('Fixed:', file);
  }
}

console.log('Total files fixed:', count);
