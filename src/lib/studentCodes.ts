export function formatStudentCode(sequence: number): string {
  let remaining = Math.max(0, Math.floor(sequence))
  let suffix = ''

  do {
    suffix = String.fromCharCode(97 + (remaining % 26)) + suffix
    remaining = Math.floor(remaining / 26) - 1
  } while (remaining >= 0)

  return `학생-${suffix}`
}
