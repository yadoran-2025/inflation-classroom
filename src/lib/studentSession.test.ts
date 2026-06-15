import { describe, expect, it } from 'vitest'
import {
  getSavedStudentJoin,
  normalizeSavedStudentJoins,
  readSavedStudentJoins,
  saveStudentJoin,
} from './studentSession'

describe('student session storage', () => {
  function createMemoryStorage(): Storage {
    const values = new Map<string, string>()
    return {
      get length() { return values.size },
      clear: () => values.clear(),
      getItem: (key) => values.get(key) ?? null,
      key: (index) => [...values.keys()][index] ?? null,
      removeItem: (key) => { values.delete(key) },
      setItem: (key, value) => { values.set(key, value) },
    }
  }

  it('removes legacy personal nicknames while preserving anonymous codes', () => {
    expect(normalizeSavedStudentJoins({
      classA: { classId: 'classA', studentId: 'studentA', nickname: '민지' },
      classB: { classId: 'classB', studentId: 'studentB', nickname: '학생-b' },
    })).toEqual({
      classA: { classId: 'classA', studentId: 'studentA' },
      classB: { classId: 'classB', studentId: 'studentB', studentCode: '학생-b' },
    })
  })

  it('stores only the anonymous code needed for re-entry', () => {
    const storage = createMemoryStorage()
    saveStudentJoin({ classId: 'classA', studentId: 'studentA', studentCode: '학생-a' }, storage)

    expect(getSavedStudentJoin('classA', storage)).toEqual({
      classId: 'classA',
      studentId: 'studentA',
      studentCode: '학생-a',
    })
    expect(readSavedStudentJoins(storage)).toEqual({
      classA: { classId: 'classA', studentId: 'studentA', studentCode: '학생-a' },
    })
  })
})
