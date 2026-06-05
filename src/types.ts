export type LessonPosition = {
  sceneIndex: number
  beatIndex: number
}

export type ChoiceActivityKind = 'news' | 'people' | 'central-bank' | 'lesson-choice'
export type ActivityKind = ChoiceActivityKind | 'short-answer'

export type ChoiceOption = {
  id: string
  label: string
}

export type LessonChoice = {
  id: string
  title: string
  sceneId: string
  options: readonly ChoiceOption[]
  answer?: string
}

export type LessonConcept = {
  title?: string
  lines: readonly string[]
}

export type SimulatorKind = 'interest-rate' | 'currency-value' | 'price-basket' | 'price-index-base' | 'basket-cpi-ppi'

export type LessonSimulator = {
  type: SimulatorKind
}

export type LessonShortAnswer = {
  id: string
  question: string
  placeholder?: string
}

export type LessonImage = {
  src: string
  alt: string
}

export type LessonBeat = {
  id: string
  title: string
  body: string[]
  buttonLabel?: string
  concept?: LessonConcept
  choice?: LessonChoice
  image?: LessonImage
  visual?:
    | 'rate-conflict'
    | 'debate'
    | 'king'
    | 'coins'
    | 'merchant'
    | 'inflation-flow'
    | 'paper-money'
    | 'bank-flow'
    | 'supply-demand'
    | 'news'
    | 'people'
    | 'central-bank'
    | 'dilemma'
    | 'price-index'
  activity?: ChoiceActivityKind
  simulator?: LessonSimulator
  response?: LessonShortAnswer
}

export type LessonScene = {
  id: string
  number: number
  title: string
  beats: LessonBeat[]
}

export type SpaceDoc = {
  id: string
  region: string
  school: string
  grade: string
  createdAt: number
}

export type ClassDoc = LessonPosition & {
  id: string
  spaceId: string
  name: string
  createdAt: number
  updatedAt: number
  startedAt?: number
}

export type StudentDoc = {
  id: string
  classId: string
  nickname: string
  currentSceneIndex: number
  currentBeatIndex: number
  lastSeenAt: number
  createdAt: number
}

export type ResponseDoc = {
  id: string
  classId: string
  studentId: string
  studentNickname: string
  sceneId: string
  activity: ActivityKind
  itemId: string
  choice: string
  correct: boolean | null
  createdAt: number
  firstChoice?: string
  firstCorrect?: boolean | null
  firstCreatedAt?: number
  updatedAt?: number
}
