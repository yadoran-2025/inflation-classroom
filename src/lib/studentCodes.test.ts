import { describe, expect, it } from 'vitest'
import { assignStudentCodes, formatStudentCode, parseStudentCodeSequence } from './studentCodes'

describe('student codes', () => {
  it('assigns alphabetic codes in entry order', () => {
    expect(formatStudentCode(0)).toBe('학생-a')
    expect(formatStudentCode(1)).toBe('학생-b')
    expect(formatStudentCode(25)).toBe('학생-z')
    expect(formatStudentCode(26)).toBe('학생-aa')
    expect(formatStudentCode(27)).toBe('학생-ab')
  })

  it('parses generated codes back into their sequence', () => {
    expect(parseStudentCodeSequence('학생-a')).toBe(0)
    expect(parseStudentCodeSequence('학생-z')).toBe(25)
    expect(parseStudentCodeSequence('학생-aa')).toBe(26)
    expect(parseStudentCodeSequence('민지')).toBeNull()
  })

  it('migrates legacy names in entry order without changing existing codes', () => {
    const result = assignStudentCodes([
      { id: 'new', nickname: '학생-b', createdAt: 40 },
      { id: 'old-2', nickname: '민지', createdAt: 20 },
      { id: 'old-1', nickname: '현우', createdAt: 10 },
    ])

    expect(Object.fromEntries(result.codesByStudentId)).toEqual({
      new: '학생-b',
      'old-1': '학생-a',
      'old-2': '학생-c',
    })
    expect(result.nextSequence).toBe(3)
  })
})
