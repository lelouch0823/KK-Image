import fs from 'node:fs';
import path from 'node:path';
import { expect } from 'vitest';

export function countEffectiveLines(source) {
  let inBlockComment = false;
  let inHtmlComment = false;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inTemplateLiteral = false;
  let escapeNext = false;
  let effectiveLines = 0;

  for (const line of source.split('\n')) {
    let hasCode = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const next = line[index + 1] || '';
      const nextTwo = line.slice(index, index + 2);
      const nextThree = line.slice(index, index + 3);
      const nextFour = line.slice(index, index + 4);

      if (inHtmlComment) {
        if (nextThree === '-->') {
          inHtmlComment = false;
          index += 2;
        }
        continue;
      }

      if (inBlockComment) {
        if (nextTwo === '*/') {
          inBlockComment = false;
          index += 1;
        }
        continue;
      }

      if (inSingleQuote || inDoubleQuote || inTemplateLiteral) {
        hasCode = true;

        if (escapeNext) {
          escapeNext = false;
          continue;
        }

        if (char === '\\') {
          escapeNext = true;
          continue;
        }

        if (inSingleQuote && char === '\'') {
          inSingleQuote = false;
          continue;
        }

        if (inDoubleQuote && char === '"') {
          inDoubleQuote = false;
          continue;
        }

        if (inTemplateLiteral && char === '`') {
          inTemplateLiteral = false;
        }
        continue;
      }

      if (nextFour === '<!--') {
        inHtmlComment = true;
        index += 3;
        continue;
      }

      if (nextTwo === '/*') {
        inBlockComment = true;
        index += 1;
        continue;
      }

      if (nextTwo === '//') {
        break;
      }

      if (char === '\'') {
        inSingleQuote = true;
        hasCode = true;
        continue;
      }

      if (char === '"') {
        inDoubleQuote = true;
        hasCode = true;
        continue;
      }

      if (char === '`') {
        inTemplateLiteral = true;
        hasCode = true;
        continue;
      }

      if (!/\s/u.test(char)) {
        hasCode = true;
      }

      if (nextThree === '-->' && !inHtmlComment) {
        index += 2;
      }
    }

    if (hasCode) {
      effectiveLines += 1;
    }
  }

  return effectiveLines;
}

export function expectFileUnderEffectiveLineBudget(relativePath, maxLines) {
  const source = fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
  expect(countEffectiveLines(source)).toBeLessThan(maxLines);
}
