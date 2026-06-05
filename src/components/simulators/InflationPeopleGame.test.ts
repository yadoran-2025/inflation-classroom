import { describe, expect, it } from 'vitest'
import { resolvePeopleSwipeChoice } from './InflationPeopleGame.logic'

describe('resolvePeopleSwipeChoice', () => {
  it('requires intentional horizontal movement before selecting a side', () => {
    expect(resolvePeopleSwipeChoice(0, 900)).toBeNull()
    expect(resolvePeopleSwipeChoice(24, 1200)).toBeNull()
    expect(resolvePeopleSwipeChoice(-24, -1200)).toBeNull()
  })

  it('selects a side after a deliberate drag or flick', () => {
    expect(resolvePeopleSwipeChoice(93, 0)).toBe('benefit')
    expect(resolvePeopleSwipeChoice(-93, 0)).toBe('harm')
    expect(resolvePeopleSwipeChoice(54, 760)).toBe('benefit')
    expect(resolvePeopleSwipeChoice(-54, -760)).toBe('harm')
  })
})
