export function formatStudentCode(sequence: number): string {
  let remaining = Math.max(0, Math.floor(sequence))
  let suffix = ''

  do {
    suffix = String.fromCharCode(97 + (remaining % 26)) + suffix
    remaining = Math.floor(remaining / 26) - 1
  } while (remaining >= 0)

  return `학생-${suffix}`
}

export function parseStudentCodeSequence(code: string): number | null {
  const match = /^학생-([a-z]+)$/.exec(code)
  if (!match) {
    return null
  }

  return [...match[1]].reduce((value, character) => value * 26 + character.charCodeAt(0) - 96, 0) - 1
}

export function assignStudentCodes(
  students: Array<{ id: string; nickname: string; createdAt: number }>,
): { codesByStudentId: Map<string, string>; nextSequence: number } {
  const codesByStudentId = new Map<string, string>()
  const usedSequences = new Set<number>()

  for (const student of students) {
    const sequence = parseStudentCodeSequence(student.nickname)
    if (sequence !== null && !usedSequences.has(sequence)) {
      usedSequences.add(sequence)
      codesByStudentId.set(student.id, student.nickname)
    }
  }

  let candidate = 0
  const legacyStudents = students
    .filter((student) => !codesByStudentId.has(student.id))
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))

  for (const student of legacyStudents) {
    while (usedSequences.has(candidate)) {
      candidate += 1
    }
    usedSequences.add(candidate)
    codesByStudentId.set(student.id, formatStudentCode(candidate))
    candidate += 1
  }

  const nextSequence = usedSequences.size === 0 ? 0 : Math.max(...usedSequences) + 1
  return { codesByStudentId, nextSequence }
}
