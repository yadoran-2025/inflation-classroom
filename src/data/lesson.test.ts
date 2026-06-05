import { describe, expect, it } from 'vitest'
import {
  centralBankOptions,
  centralBankScenarios,
  lessonChoiceItems,
  newsItems,
  newsOptions,
  peopleCards,
  peopleOptions,
} from './lesson'
import { lessonScenes } from './lessonScenes'

describe('lesson data', () => {
  it('has six scenes and at least one beat per scene', () => {
    expect(lessonScenes).toHaveLength(6)
    expect(lessonScenes.every((scene) => scene.beats.length > 0)).toBe(true)
  })

  it('starts with the interest-rate conflict framing scene', () => {
    expect(lessonScenes[0]).toMatchObject({
      id: 'scene-0',
      number: 0,
      title: '금리 문제, 대체 왜 이렇게 싸우는가?',
    })
    expect(lessonScenes[0].beats.map((beat) => beat.id)).toEqual(['s0-b1', 's0-b2', 's0-b3', 's0-b4', 's0-b5', 's0-b6'])
  })

  it('has complete news activity answers', () => {
    const optionIds = new Set(newsOptions.map((option) => option.id))
    expect(newsItems).toHaveLength(3)
    expect(newsItems.every((item) => optionIds.has(item.answer))).toBe(true)
  })

  it('has structured choice and concept beats', () => {
    expect(lessonChoiceItems).toHaveLength(2)
    expect(lessonChoiceItems.every((item) => item.options.some((option) => option.id === item.answer))).toBe(true)
    expect(lessonScenes.some((scene) => scene.beats.some((beat) => beat.choice))).toBe(true)
    expect(lessonScenes.some((scene) => scene.beats.some((beat) => beat.concept))).toBe(true)
  })

  it('declares the interest rate simulator and unique short-answer prompts', () => {
    const sceneTwo = lessonScenes.find((scene) => scene.id === 'scene-2')
    const interestRateBeat = sceneTwo?.beats.find((beat) => beat.id === 's2-b4')
    const responseIds = lessonScenes.flatMap((scene) =>
      scene.beats.flatMap((beat) => (beat.response ? [beat.response.id] : [])),
    )

    expect(interestRateBeat?.simulator?.type).toBe('interest-rate')
    expect(new Set(responseIds).size).toBe(responseIds.length)
  })

  it('has complete people card answers', () => {
    const optionIds = new Set(peopleOptions.map((option) => option.id))
    expect(peopleOptions.map((option) => option.id)).toEqual(['benefit', 'harm'])
    expect(peopleOptions.map((option) => option.id)).not.toContain('mixed')
    expect(peopleCards).toHaveLength(7)
    expect(peopleCards.every((card) => optionIds.has(card.expected))).toBe(true)
    expect(peopleCards.every((card) => card.line.length > 0 && card.hint.length > 0)).toBe(true)
  })

  it('has central bank scenarios and choices', () => {
    expect(centralBankScenarios.length).toBeGreaterThanOrEqual(3)
    expect(centralBankOptions.map((option) => option.id)).toEqual(['raise', 'hold', 'cut'])
    expect(centralBankScenarios.every((scenario) => scenario.context.length > 0)).toBe(true)
    expect(centralBankScenarios.every((scenario) => scenario.gauge.prices > 0 && scenario.gauge.jobs > 0)).toBe(true)
    expect(
      centralBankScenarios.every((scenario) =>
        centralBankOptions.every((option) => option.id in scenario.policyGauges),
      ),
    ).toBe(true)
  })
})
