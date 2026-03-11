import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const forbiddenPatterns = [
  'varinfo',
  'varsuccess',
  'vardanger',
  'varwarning',
  '--bg-input',
  '--bg-subtle',
  '--text-quaternary',
  '--bg-card-hover',
  '--color-danger-hover',
  'material-symbols-outlined',
  '#ec5b13',
  '#f97316',
];

const getFiles = () => {
  const output = execSync('rg --files src', { encoding: 'utf8' });
  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((file) => file.endsWith('.vue') || file.endsWith('.js'))
    .filter((file) => !file.includes('__tests__'));
};

const offenders = [];

for (const file of getFiles()) {
  const content = readFileSync(file, 'utf8');
  for (const pattern of forbiddenPatterns) {
    if (content.includes(pattern)) {
      offenders.push({ file, pattern });
    }
  }
}

if (offenders.length > 0) {
  console.error('UI token integrity check failed:');
  for (const offender of offenders) {
    console.error(`- ${offender.file}: ${offender.pattern}`);
  }
  process.exit(1);
}

console.log('UI token integrity check passed.');
