export type SavedStudentJoin = {
  classId: string
  studentId: string
  studentCode?: string
}

type LegacySavedStudentJoin = SavedStudentJoin & {
  nickname?: unknown
}

const studentJoinStorageKey = 'inflation-classroom-student-joins'
const studentCodePattern = /^학생-[a-z]+$/
type StudentSessionStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function getBrowserStorage(): StudentSessionStorage | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage ?? null
  } catch {
    return null
  }
}

export function normalizeSavedStudentJoins(value: unknown): Record<string, SavedStudentJoin> {
  if (!value || typeof value !== 'object') {
    return {}
  }

  return Object.entries(value).reduce<Record<string, SavedStudentJoin>>((result, [classId, entry]) => {
    if (!entry || typeof entry !== 'object') {
      return result
    }

    const candidate = entry as LegacySavedStudentJoin
    if (typeof candidate.studentId !== 'string' || !candidate.studentId) {
      return result
    }

    const storedCode = typeof candidate.studentCode === 'string' && studentCodePattern.test(candidate.studentCode)
      ? candidate.studentCode
      : typeof candidate.nickname === 'string' && studentCodePattern.test(candidate.nickname)
        ? candidate.nickname
        : undefined

    result[classId] = {
      classId,
      studentId: candidate.studentId,
      ...(storedCode ? { studentCode: storedCode } : {}),
    }
    return result
  }, {})
}

export function readSavedStudentJoins(
  storage: StudentSessionStorage | null = getBrowserStorage(),
): Record<string, SavedStudentJoin> {
  if (!storage) {
    return {}
  }

  const raw = storage.getItem(studentJoinStorageKey)
  if (!raw) {
    return {}
  }

  try {
    const normalized = normalizeSavedStudentJoins(JSON.parse(raw))
    const serialized = JSON.stringify(normalized)
    if (serialized !== raw) {
      storage.setItem(studentJoinStorageKey, serialized)
    }
    return normalized
  } catch {
    storage.removeItem(studentJoinStorageKey)
    return {}
  }
}

export function getSavedStudentJoin(
  classId: string | undefined,
  storage: StudentSessionStorage | null = getBrowserStorage(),
): SavedStudentJoin | null {
  return classId ? readSavedStudentJoins(storage)[classId] ?? null : null
}

export function saveStudentJoin(
  join: SavedStudentJoin,
  storage: StudentSessionStorage | null = getBrowserStorage(),
): void {
  if (!storage) {
    return
  }

  storage.setItem(
    studentJoinStorageKey,
    JSON.stringify({
      ...readSavedStudentJoins(storage),
      [join.classId]: join,
    }),
  )
}

export function clearSavedStudentJoin(
  classId: string,
  storage: StudentSessionStorage | null = getBrowserStorage(),
): void {
  if (!storage) {
    return
  }

  const joins = readSavedStudentJoins(storage)
  delete joins[classId]
  storage.setItem(studentJoinStorageKey, JSON.stringify(joins))
}
