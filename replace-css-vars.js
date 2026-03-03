import fs from 'fs';
import path from 'path';

let updatedCount = 0;

function processDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      processDirectory(fullPath);
    } else if (entry.isFile() && (fullPath.endsWith('.vue') || fullPath.endsWith('.js'))) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const original = content;

      // Replace generic [var(--...)] with (--...)
      content = content.replace(/\[var\((--[\w-]+)\)\]/g, '($1)');

      // Replace explicit color names to their tailwind native equivalents
      const colors = ['primary', 'danger', 'success', 'warning', 'info'];
      for (const color of colors) {
        content = content.replace(new RegExp(`\\(\\-*color\\-${color}\\)`, 'g'), color);
      }

      if (content !== original) {
        fs.writeFileSync(fullPath, content, 'utf8');
        updatedCount++;
        console.log(`Updated ${fullPath}`);
      }
    }
  }
}

console.log('Starting global CSS variable update...');
processDirectory('./src');
console.log(`Finished update. Updated ${updatedCount} files.`);
