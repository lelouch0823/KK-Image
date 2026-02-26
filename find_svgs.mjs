import fs from 'fs';
import path from 'path';

function getFiles(dir, files = []) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const name = dir + '/' + file;
    if (fs.statSync(name).isDirectory()) {
      getFiles(name, files);
    } else if (name.endsWith('.vue')) {
      files.push(name);
    }
  }
  return files;
}

const vueFiles = getFiles('./src');
const counts = {};
const iconMap = {}; // d -> [files]

for (const file of vueFiles) {
  const content = fs.readFileSync(file, 'utf8');
  // Match <svg ...> ... </svg> and extract paths
  const svgRegex = /<svg[^>]*>([\s\S]*?)<\/svg>/g;
  let match;
  while ((match = svgRegex.exec(content)) !== null) {
    const innerHtml = match[1];
    const pathRegex = /d="([^"]+)"/g;
    let pathMatch;
    const currentPaths = [];
    while ((pathMatch = pathRegex.exec(innerHtml)) !== null) {
      currentPaths.push(pathMatch[1]);
    }
    const signature = currentPaths.join('|');
    if (signature) {
      counts[signature] = (counts[signature] || 0) + 1;
      if (!iconMap[signature]) iconMap[signature] = new Set();
      iconMap[signature].add(file);
    }
  }
}

const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
let report = 'Most common SVG paths:\n';
for (const [sig, count] of sorted.slice(0, 30)) {
  report += `\nCount: ${count}\n`;
  report += `Path: ${sig.slice(0, 100)}...\n`;
  report += `Files using it: ${Array.from(iconMap[sig]).join(', ')}\n`;
}
fs.writeFileSync('svg_report.txt', report, 'utf8');
console.log('Report written to svg_report.txt');
