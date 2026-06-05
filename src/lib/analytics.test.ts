import { describe, expect, it } from 'vitest'
import type { ResponseDoc } from '../types'
import { summarizeActivity } from './analytics'

function response(overrides: Partial<ResponseDoc>): ResponseDoc {
  return {
    id: 'response',
    classId: 'class-1',
    studentId: 'student-1',
    studentNickname: '학생',
    sceneId: 'scene-3',
    activity: 'news',
    itemId: 'support-spending',
    choice: 'demand-pull',
    correct: true,
    createdAt: 1,
    ...overrides,
  }
}

describe('activity analytics', () => {
  it('summarizes option distribution and accuracy from first student answers', () => {
    const stats = summarizeActivity(
      [
        response({ id: 'old', studentId: 'a', choice: 'cost-push', correct: false, createdAt: 1 }),
        response({ id: 'new', studentId: 'a', choice: 'demand-pull', correct: true, createdAt: 2 }),
        response({ id: 'other', studentId: 'b', choice: 'demand-pull', correct: true, createdAt: 3 }),
        response({
          id: 'short',
          studentId: 'c',
          sceneId: 'scene-2',
          activity: 'short-answer',
          itemId: 's2-b3-interest-rate-recall',
          choice: '통화량은 늘어나고 화폐가치는 약해진다.',
          correct: null,
          createdAt: 4,
        }),
      ],
      'news',
    )

    const support = stats.find((item) => item.itemId === 'support-spending')

    expect(support?.total).toBe(2)
    expect(support?.accuracy).toBe(50)
    expect(support?.options.find((option) => option.id === 'cost-push')?.percent).toBe(50)
    expect(support?.options.find((option) => option.id === 'demand-pull')?.percent).toBe(50)
  })

  it('uses stored first submission fields from overwritten response documents', () => {
    const stats = summarizeActivity(
      [
        response({
          id: 'student-a-news-support',
          studentId: 'a',
          choice: 'demand-pull',
          correct: true,
          createdAt: 10,
          firstChoice: 'cost-push',
          firstCorrect: false,
          firstCreatedAt: 1,
          updatedAt: 10,
        }),
      ],
      'news',
    )

    const support = stats.find((item) => item.itemId === 'support-spending')

    expect(support?.total).toBe(1)
    expect(support?.accuracy).toBe(0)
    expect(support?.options.find((option) => option.id === 'cost-push')?.count).toBe(1)
    expect(support?.options.find((option) => option.id === 'demand-pull')?.count).toBe(0)
  })
})
