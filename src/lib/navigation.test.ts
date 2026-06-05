import { describe, expect, it } from 'vitest'
import { lessonScenes } from '../data/lessonScenes'
import {
  comparePositions,
  getNextPosition,
  getPreviousPosition,
  getSceneStartPosition,
  isPositionAfter,
  isPositionBeforeOrSame,
  isSamePosition,
} from './navigation'

describe('lesson navigation', () => {
  it('moves to the next beat inside the same scene', () => {
    expect(getNextPosition({ sceneIndex: 0, beatIndex: 0 })).toEqual({ sceneIndex: 0, beatIndex: 1 })
  })

  it('moves from the last beat to the next scene', () => {
    const lastBeat = lessonScenes[0].beats.length - 1
    expect(getNextPosition({ sceneIndex: 0, beatIndex: lastBeat })).toEqual({ sceneIndex: 1, beatIndex: 0 })
  })

  it('moves backward across scene boundaries', () => {
    const previousSceneLastBeat = lessonScenes[0].beats.length - 1
    expect(getPreviousPosition({ sceneIndex: 1, beatIndex: 0 })).toEqual({
      sceneIndex: 0,
      beatIndex: previousSceneLastBeat,
    })
  })

  it('returns the first beat when a scene dot is selected', () => {
    expect(getSceneStartPosition(3)).toEqual({ sceneIndex: 3, beatIndex: 0 })
  })

  it('compares lesson positions across scenes and beats', () => {
    expect(comparePositions({ sceneIndex: 1, beatIndex: 0 }, { sceneIndex: 0, beatIndex: 5 })).toBeGreaterThan(0)
    expect(isPositionAfter({ sceneIndex: 0, beatIndex: 2 }, { sceneIndex: 0, beatIndex: 1 })).toBe(true)
    expect(isPositionBeforeOrSame({ sceneIndex: 0, beatIndex: 1 }, { sceneIndex: 0, beatIndex: 1 })).toBe(true)
    expect(isSamePosition({ sceneIndex: 2, beatIndex: 0 }, { sceneIndex: 2, beatIndex: 0 })).toBe(true)
  })
})
