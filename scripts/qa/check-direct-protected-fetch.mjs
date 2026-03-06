import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const SCAN_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.vue'])
const DEFAULT_SRC_DIR = 'src'
const DEFAULT_ALLOWLIST = new Set([
  'src/composables/useAuth.js',
])
const PROTECTED_PATTERNS = [
  /\/api\/manage\b/i,
  /\/api\/v1\/permissions\b/i,
  /\bAPI\.MANAGE_[A-Z0-9_]+\b/,
  /\bAPI\.PERMISSIONS_[A-Z0-9_]+\b/,
  /\bAPI_PREFIX\b/,
]
const IDENTIFIER_PATTERN = /^[A-Za-z_$][\w$]*$/

const normalizePath = (filePath) => filePath.replace(/\\/g, '/')

const shouldScanFile = (filePath) => SCAN_EXTENSIONS.has(path.extname(filePath).toLowerCase())

async function collectFiles(rootDir) {
  const entries = await fs.readdir(rootDir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(fullPath)))
      continue
    }
    if (entry.isFile() && shouldScanFile(fullPath)) {
      files.push(fullPath)
    }
  }

  return files
}

function detectViolations({ source, file, rootDir }) {
  const variableMap = collectVariableAssignments(source)
  const fetchCalls = collectFetchCalls(source)
  const violations = []
  for (const call of fetchCalls) {
    const isProtected = expressionIsProtected(call.firstArg, variableMap)

    if (isProtected) {
      violations.push({
        file: normalizePath(path.relative(rootDir, file)),
        line: call.line,
        snippet: call.preview,
      })
    }
  }

  return violations
}

function collectVariableAssignments(source) {
  const declarations = new Map()
  const declarationPattern = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+)\s*[;\n]/g
  let match = declarationPattern.exec(source)

  while (match) {
    declarations.set(match[1], normalizeExpression(match[2]))
    match = declarationPattern.exec(source)
  }

  return declarations
}

function collectFetchCalls(source) {
  const calls = []
  const fetchPattern = /\bfetch\s*\(/g
  let match = fetchPattern.exec(source)

  while (match) {
    const openParenIndex = match.index + match[0].length - 1
    const closeParenIndex = findMatchingParen(source, openParenIndex)
    if (closeParenIndex === -1) {
      match = fetchPattern.exec(source)
      continue
    }

    const argsRaw = source.slice(openParenIndex + 1, closeParenIndex)
    const firstArg = normalizeExpression(splitFirstArgument(argsRaw))
    const line = source.slice(0, match.index).split(/\r?\n/).length
    const preview = source
      .slice(match.index, Math.min(source.length, closeParenIndex + 1))
      .split(/\r?\n/)
      .slice(0, 4)
      .join(' ')
      .trim()

    calls.push({
      firstArg,
      line,
      preview,
    })

    fetchPattern.lastIndex = closeParenIndex + 1
    match = fetchPattern.exec(source)
  }

  return calls
}

function findMatchingParen(source, openParenIndex) {
  let depth = 0
  let quote = null
  let escaped = false

  for (let i = openParenIndex; i < source.length; i++) {
    const char = source[i]

    if (quote) {
      if (escaped) {
        escaped = false
        continue
      }
      if (char === '\\') {
        escaped = true
        continue
      }
      if (char === quote) {
        quote = null
      }
      continue
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char
      continue
    }

    if (char === '(') {
      depth += 1
      continue
    }

    if (char === ')') {
      depth -= 1
      if (depth === 0) return i
    }
  }

  return -1
}

function splitFirstArgument(argsRaw) {
  let bracketDepth = 0
  let quote = null
  let escaped = false

  for (let i = 0; i < argsRaw.length; i++) {
    const char = argsRaw[i]

    if (quote) {
      if (escaped) {
        escaped = false
        continue
      }
      if (char === '\\') {
        escaped = true
        continue
      }
      if (char === quote) {
        quote = null
      }
      continue
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char
      continue
    }

    if (char === '(' || char === '{' || char === '[') {
      bracketDepth += 1
      continue
    }
    if (char === ')' || char === '}' || char === ']') {
      bracketDepth -= 1
      continue
    }

    if (char === ',' && bracketDepth === 0) {
      return argsRaw.slice(0, i)
    }
  }

  return argsRaw
}

function normalizeExpression(value) {
  return String(value || '').trim().replace(/\s+/g, ' ')
}

function stripWrappingParens(expr) {
  let current = expr.trim()
  while (current.startsWith('(') && current.endsWith(')')) {
    current = current.slice(1, -1).trim()
  }
  return current
}

function expressionIsProtected(expression, variableMap, seen = new Set()) {
  const expr = stripWrappingParens(normalizeExpression(expression))
  if (!expr) return false

  if (PROTECTED_PATTERNS.some((pattern) => pattern.test(expr))) {
    return true
  }

  if (IDENTIFIER_PATTERN.test(expr)) {
    if (seen.has(expr) || !variableMap.has(expr)) return false
    seen.add(expr)
    return expressionIsProtected(variableMap.get(expr), variableMap, seen)
  }

  if (expr.includes('+')) {
    return expr
      .split('+')
      .map((part) => stripWrappingParens(part))
      .some((part) => expressionIsProtected(part, variableMap, new Set(seen)))
  }

  const templateExprPattern = /\$\{([^}]+)\}/g
  let templateMatch = templateExprPattern.exec(expr)
  while (templateMatch) {
    if (expressionIsProtected(templateMatch[1], variableMap, new Set(seen))) {
      return true
    }
    templateMatch = templateExprPattern.exec(expr)
  }

  return false
}

export async function scanForDirectProtectedFetch({
  rootDir = process.cwd(),
  srcDir = DEFAULT_SRC_DIR,
  allowlist = [],
} = {}) {
  const sourceRoot = path.resolve(rootDir, srcDir)
  const allow = new Set([
    ...DEFAULT_ALLOWLIST,
    ...allowlist.map((item) => normalizePath(item)),
  ])

  const files = await collectFiles(sourceRoot)
  const violations = []

  for (const file of files) {
    const relativeFile = normalizePath(path.relative(rootDir, file))
    if (allow.has(relativeFile)) continue

    const source = await fs.readFile(file, 'utf8')
    violations.push(...detectViolations({ source, file, rootDir }))
  }

  return violations.sort((a, b) => {
    if (a.file === b.file) return a.line - b.line
    return a.file.localeCompare(b.file)
  })
}

async function main() {
  const violations = await scanForDirectProtectedFetch()

  if (violations.length === 0) {
    console.log('[check-direct-protected-fetch] PASS: no direct protected fetch usage found.')
    return
  }

  console.error('[check-direct-protected-fetch] FAIL: direct protected fetch detected.')
  for (const item of violations) {
    console.error(`- ${item.file}:${item.line}`)
    console.error(`  ${item.snippet}`)
  }
  process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
