import { afterEach, describe, expect, it } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { scanForDirectProtectedFetch } from '../check-direct-protected-fetch.mjs'

const tempDirs = []

const writeFile = async (rootDir, relativePath, content) => {
  const filePath = path.join(rootDir, relativePath)
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  await fs.writeFile(filePath, content, 'utf8')
}

const createFixture = async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kk-fetch-guard-'))
  tempDirs.push(rootDir)
  return rootDir
}

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
  )
})

describe('check-direct-protected-fetch', () => {
  it('fails when src contains direct fetch to /api/manage or /api/v1/permissions', async () => {
    const rootDir = await createFixture()
    await writeFile(
      rootDir,
      'src/components/bad.js',
      "export const run = () => fetch('/api/manage/products')\n",
    )
    await writeFile(
      rootDir,
      'src/views/permissions.js',
      "export const load = () => fetch('/api/v1/permissions/user')\n",
    )

    const violations = await scanForDirectProtectedFetch({ rootDir })

    expect(violations.length).toBe(2)
    expect(violations[0].file).toContain('src/components/bad.js')
    expect(violations[1].file).toContain('src/views/permissions.js')
  })

  it('fails when protected endpoint is passed through variables before fetch', async () => {
    const rootDir = await createFixture()
    await writeFile(
      rootDir,
      'src/composables/indirect.js',
      [
        "import { API } from '@/utils/constants'",
        "const endpoint = API.MANAGE_PRODUCTS",
        "const url = endpoint",
        "export const run = () => fetch(url)",
        '',
      ].join('\n'),
    )

    const violations = await scanForDirectProtectedFetch({ rootDir })

    expect(violations.length).toBe(1)
    expect(violations[0].file).toContain('src/composables/indirect.js')
  })

  it('allows explicit exceptions like useAuth.js', async () => {
    const rootDir = await createFixture()
    await writeFile(
      rootDir,
      'src/composables/useAuth.js',
      "export const call = () => fetch('/api/manage/auth-check')\n",
    )

    const violations = await scanForDirectProtectedFetch({ rootDir })

    expect(violations).toEqual([])
  })
})
