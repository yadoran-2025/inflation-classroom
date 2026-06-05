import {
  centralBankOptions,
  centralBankScenarios,
  lessonChoiceItems,
  newsItems,
  newsOptions,
  peopleCards,
  peopleOptions,
} from '../data/lesson'
import type { ChoiceActivityKind, ResponseDoc } from '../types'

export type OptionCount = {
  id: string
  label: string
  count: number
  percent: number
}

export type ItemStat = {
  itemId: string
  title: string
  total: number
  correct: number
  accuracy: number | null
  options: OptionCount[]
}

const activityItems = {
  news: newsItems.map((item) => ({ id: item.id, title: item.text })),
  people: peopleCards.map((item) => ({ id: item.id, title: item.title })),
  'central-bank': centralBankScenarios.map((item) => ({ id: item.id, title: item.title })),
  'lesson-choice': lessonChoiceItems.map((item) => ({ id: item.id, title: item.title })),
} satisfies Record<ChoiceActivityKind, { id: string; title: string }[]>

function optionsForActivityItem(activity: ChoiceActivityKind, itemId: string): readonly { id: string; label: string }[] {
  if (activity === 'lesson-choice') {
    return lessonChoiceItems.find((item) => item.id === itemId)?.options ?? []
  }
  if (activity === 'people') {
    return peopleOptions
  }
  if (activity === 'central-bank') {
    return centralBankOptions
  }
  return newsOptions
}

export function latestResponsesByStudentAndItem(responses: ResponseDoc[]): ResponseDoc[] {
  const latest = new Map<string, ResponseDoc>()

  for (const response of responses) {
    const key = `${response.activity}:${response.itemId}:${response.studentId}`
    const previous = latest.get(key)

    if (!previous || response.createdAt > previous.createdAt) {
      latest.set(key, response)
    }
  }

  return [...latest.values()]
}

function firstSubmission(response: ResponseDoc): ResponseDoc {
  return {
    ...response,
    choice: response.firstChoice ?? response.choice,
    correct: response.firstCorrect ?? response.correct,
    createdAt: response.firstCreatedAt ?? response.createdAt,
  }
}

export function firstResponsesByStudentAndItem(responses: ResponseDoc[]): ResponseDoc[] {
  const first = new Map<string, ResponseDoc>()

  for (const response of responses) {
    const firstResponse = firstSubmission(response)
    const key = `${response.activity}:${response.itemId}:${response.studentId}`
    const previous = first.get(key)

    if (!previous || firstResponse.createdAt < previous.createdAt) {
      first.set(key, firstResponse)
    }
  }

  return [...first.values()]
}

export function summarizeActivity(responses: ResponseDoc[], activity: ChoiceActivityKind): ItemStat[] {
  const first = firstResponsesByStudentAndItem(responses).filter((response) => response.activity === activity)
  const items = activityItems[activity]

  return items.map((item) => {
    const itemResponses = first.filter((response) => response.itemId === item.id)
    const total = itemResponses.length
    const correct = itemResponses.filter((response) => response.correct).length

    return {
      itemId: item.id,
      title: item.title,
      total,
      correct,
      accuracy: total === 0 ? null : Math.round((correct / total) * 100),
      options: optionsForActivityItem(activity, item.id).map((option) => {
        const count = itemResponses.filter((response) => response.choice === option.id).length
        return {
          ...option,
          count,
          percent: total === 0 ? 0 : Math.round((count / total) * 100),
        }
      }),
    }
  })
}

export function countSubmittedStudents(responses: ResponseDoc[], activity: ChoiceActivityKind): number {
  return new Set(responses.filter((response) => response.activity === activity).map((response) => response.studentId)).size
}
