import { lessonScenes } from '../data/lessonScenes'
import type { LessonPosition } from '../types'

export function clampPosition(position: LessonPosition): LessonPosition {
  const sceneIndex = Math.min(Math.max(position.sceneIndex, 0), lessonScenes.length - 1)
  const beatCount = lessonScenes[sceneIndex]?.beats.length ?? 1
  const beatIndex = Math.min(Math.max(position.beatIndex, 0), beatCount - 1)

  return { sceneIndex, beatIndex }
}

export function getNextPosition(position: LessonPosition): LessonPosition {
  const current = clampPosition(position)
  const beatCount = lessonScenes[current.sceneIndex].beats.length

  if (current.beatIndex < beatCount - 1) {
    return { sceneIndex: current.sceneIndex, beatIndex: current.beatIndex + 1 }
  }

  if (current.sceneIndex < lessonScenes.length - 1) {
    return { sceneIndex: current.sceneIndex + 1, beatIndex: 0 }
  }

  return current
}

export function getPreviousPosition(position: LessonPosition): LessonPosition {
  const current = clampPosition(position)

  if (current.beatIndex > 0) {
    return { sceneIndex: current.sceneIndex, beatIndex: current.beatIndex - 1 }
  }

  if (current.sceneIndex > 0) {
    const previousSceneIndex = current.sceneIndex - 1
    return {
      sceneIndex: previousSceneIndex,
      beatIndex: lessonScenes[previousSceneIndex].beats.length - 1,
    }
  }

  return current
}

export function getSceneStartPosition(sceneIndex: number): LessonPosition {
  return clampPosition({ sceneIndex, beatIndex: 0 })
}

export function comparePositions(a: LessonPosition, b: LessonPosition): number {
  const first = clampPosition(a)
  const second = clampPosition(b)

  if (first.sceneIndex !== second.sceneIndex) {
    return first.sceneIndex - second.sceneIndex
  }

  return first.beatIndex - second.beatIndex
}

export function isSamePosition(a: LessonPosition, b: LessonPosition): boolean {
  return comparePositions(a, b) === 0
}

export function isPositionAfter(a: LessonPosition, b: LessonPosition): boolean {
  return comparePositions(a, b) > 0
}

export function isPositionBeforeOrSame(a: LessonPosition, b: LessonPosition): boolean {
  return comparePositions(a, b) <= 0
}
