import fs from 'node:fs'
import path from 'node:path'
import { cwd } from 'node:process'
import { describe, expect, it } from 'vitest'

describe('forbidden flow', () => {
  it('navigates to unified forbidden page when route permission fails', () => {
    const routerSource = fs.readFileSync(path.resolve(cwd(), 'src/router/index.js'), 'utf8')

    expect(routerSource).toContain("component: () => import('@/views/Forbidden.vue')")
    expect(routerSource).toContain("next({ name: 'Forbidden', query: { permission: requiredPermission } })")
  })
})
