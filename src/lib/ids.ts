export function slugify(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, '-')
  return encodeURIComponent(normalized || 'blank').replace(/%/g, '')
}

export function buildSpaceId(region: string, school: string, grade: string): string {
  return [region, school, grade].map(slugify).join('__')
}

export function makeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
