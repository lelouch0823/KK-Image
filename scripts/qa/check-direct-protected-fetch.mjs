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
]

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
  const violations = []
  const fetchPattern = /\bfetch\s*\(/g
  let match = fetchPattern.exec(source)

  while (match) {
    const index = match.index
    const snippet = source.slice(index, index + 500)
    const isProtected = PROTECTED_PATTERNS.some((pattern) => pattern.test(snippet))

    if (isProtected) {
      const line = source.slice(0, index).split(/\r?\n/).length
      violations.push({
        file: normalizePath(path.relative(rootDir, file)),
        line,
        snippet: snippet.split(/\r?\n/).slice(0, 4).join(' ').trim(),
      })
    }

    match = fetchPattern.exec(source)
  }

  return violations
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
