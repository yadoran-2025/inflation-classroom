export type PeopleChoice = 'benefit' | 'harm'

const swipeThreshold = 92
const swipeFlickThreshold = 48
const swipeVelocityThreshold = 720

export function resolvePeopleSwipeChoice(offsetX: number, velocityX: number): PeopleChoice | null {
  if (offsetX > swipeThreshold || (offsetX > swipeFlickThreshold && velocityX > swipeVelocityThreshold)) {
    return 'benefit'
  }

  if (offsetX < -swipeThreshold || (offsetX < -swipeFlickThreshold && velocityX < -swipeVelocityThreshold)) {
    return 'harm'
  }

  return null
}
