import { describe, expect, it } from 'vitest'
import { hasForceStatusPermission } from '../order-state-machine'

describe('order state machine authz projection', () => {
  it('does not treat "*" as force permission', () => {
    expect(hasForceStatusPermission(['*'])).toBe(false)
  })

  it('allows force permission only for admin:full', () => {
    expect(hasForceStatusPermission(['admin:full'])).toBe(true)
  })
})
