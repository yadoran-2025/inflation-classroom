import { describe, expect, it } from 'vitest'
import { formatStudentCode } from './studentCodes'

describe('student codes', () => {
  it('assigns alphabetic codes in entry order', () => {
    expect(formatStudentCode(0)).toBe('학생-a')
    expect(formatStudentCode(1)).toBe('학생-b')
    expect(formatStudentCode(25)).toBe('학생-z')
    expect(formatStudentCode(26)).toBe('학생-aa')
    expect(formatStudentCode(27)).toBe('학생-ab')
  })
})
