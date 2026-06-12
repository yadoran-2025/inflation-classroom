import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Clipboard,
  DoorOpen,
  Eye,
  Home,
  MessageCircle,
  PlayCircle,
  Plus,
  QrCode,
  School,
  Trash2,
  Users,
  Wifi,
  X,
  Download,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, FormEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link, Navigate, Route, BrowserRouter as Router, Routes, useNavigate, useParams } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import { InflationPeopleGame } from './components/simulators/InflationPeopleGame'
import { SimulatorPanel } from './components/simulators/SimulatorPanel'
import { ConfettiProvider, useConfetti } from './components/DoodleConfetti'

import {
  centralBankOptions,
  centralBankScenarios,
  lessonChoiceItems,
  newsItems,
  newsOptions,
  peopleCards,
  peopleOptions,
} from './data/lesson'
import { lessonScenes } from './data/lessonScenes'
import { firstResponsesByStudentAndItem, summarizeActivity } from './lib/analytics'
import { buildSpaceId } from './lib/ids'
import {
  getStudentLessonPosition,
  getNextPosition,
  getPreviousPosition,
  getSceneStartPosition,
  isPositionAfter,
  isPositionBeforeOrSame,
  isSamePosition,
} from './lib/navigation'
import {
  createClass,
  deleteClass,
  getJoinUrl,
  joinClass,
  markStudentPosition,
  startClassActivity,
  submitResponse,
  upsertSpace,
  useClassDoc,
  useClasses,
  useResponses,
  useSpace,
  useStudent,
  useStudentResponses,
  useStudents,
  deleteStudent,
} from './lib/store'
import type {
  ActivityKind,
  ChoiceActivityKind,
  ClassDoc,
  LessonBeat,
  LessonPosition,
  ResponseDoc,
  SimulatorKind,
  StudentDoc,
} from './types'

const SIMULATOR_BODY_MARKER = '[[simulator]]'
const studentJoinStorageKey = 'inflation-classroom-student-joins'
const waitingVideoUrl = 'https://youtu.be/cZwW5bJ5Iqw?si=iSA_9Lg2lyJvf--B'
const waitingVideoThumbnailUrl = 'https://img.youtube.com/vi/cZwW5bJ5Iqw/hqdefault.jpg'
const waitingVideoQuestions = [
  '트럼프와 싸우는 제롬 파월은, 어떤 기관의 의장인가요?',
  '둘은 무엇을 가지고 다투고 있나요?',
  '금리를 인상/ 인하한다는 것의 진정한 의미는 무엇일까요?',
]

type SavedStudentJoin = {
  classId: string
  studentId: string
  nickname: string
}

type ResponseInput = Omit<ResponseDoc, 'id' | 'createdAt'>
type SubmitResponseHandler = (response: ResponseInput, previousResponse?: ResponseDoc) => void | Promise<void>

function getLessonChoiceOptions(): { id: string; label: string }[] {
  return lessonChoiceItems.flatMap((item) =>
    item.options.map((option) => ({
      id: option.id,
      label: option.label,
    })),
  )
}

function formatProgressLabel(sceneIndex: number, beatIndex: number): string {
  return `scene${sceneIndex + 1}-${beatIndex + 1}`
}

function conceptBlankIds(concept: NonNullable<LessonBeat['concept']>): string[] {
  return concept.lines.flatMap((line, lineIndex) =>
    line
      .split(/(__[^_]+__|<u>.*?<\/u>)/g)
      .map((part, partIndex) => {
        const isBlank = (part.startsWith('__') && part.endsWith('__')) || (part.startsWith('<u>') && part.endsWith('</u>'))
        return isBlank ? `${lineIndex}-${partIndex}` : null
      })
      .filter((id): id is string => id !== null),
  )
}

function hasSubmittedResponse(
  responses: ResponseDoc[],
  activity: ActivityKind,
  itemId: string,
): boolean {
  return responses.some((response) => response.activity === activity && response.itemId === itemId)
}

function shouldHandleLessonArrowKey(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return true
  }

  return !target.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""], [role="slider"]')
}

function isBeatWorkComplete(
  beat: LessonBeat,
  responses: ResponseDoc[],
  revealedConceptBlankIds: string[],
  simulatorComplete: boolean,
  visualComplete: boolean,
): { complete: boolean; message: string | null } {
  if (beat.response && !hasSubmittedResponse(responses, 'short-answer', beat.response.id)) {
    return { complete: false, message: '답을 제출해야 다음으로 갈 수 있어요.' }
  }

  if (beat.choice && !hasSubmittedResponse(responses, 'lesson-choice', beat.choice.id)) {
    return { complete: false, message: '문제를 풀어야 다음으로 갈 수 있어요.' }
  }

  if (beat.activity === 'news') {
    const allNewsSubmitted = newsItems.every((item) => hasSubmittedResponse(responses, 'news', item.id))
    if (!allNewsSubmitted) {
      return { complete: false, message: '뉴스 문제 3개를 모두 풀어야 다음으로 갈 수 있어요.' }
    }
  }

  if (beat.activity === 'people') {
    const allPeopleSubmitted = peopleCards.every((item) => hasSubmittedResponse(responses, 'people', item.id))
    if (!allPeopleSubmitted) {
      return { complete: false, message: '인물 카드를 모두 선택해야 다음으로 갈 수 있어요.' }
    }
  }

  if (beat.activity === 'central-bank') {
    const allScenariosSubmitted = centralBankScenarios.every((item) =>
      hasSubmittedResponse(responses, 'central-bank', item.id),
    )
    if (!allScenariosSubmitted) {
      return { complete: false, message: '중앙은행 상황을 모두 풀어야 다음으로 갈 수 있어요.' }
    }
  }

  if (beat.concept) {
    const blankIds = conceptBlankIds(beat.concept)
    const allBlanksRevealed = blankIds.every((id) => revealedConceptBlankIds.includes(id))
    if (!allBlanksRevealed) {
      return { complete: false, message: '개념 정리의 빈칸을 모두 열어야 다음으로 갈 수 있어요.' }
    }
  }

  if (beat.simulator && !simulatorComplete) {
    const messageBySimulator = {
      'interest-rate': '시소의 빈칸을 맞추고 금리 레버까지 움직여 봐야 다음으로 갈 수 있어요.',
      'price-basket': '장바구니 가격 버튼을 하나 눌러 봐야 다음으로 갈 수 있어요.',
      'currency-value': '화폐가치 시소를 움직여 봐야 다음으로 갈 수 있어요.',
      'price-index-base': '가격 조절 슬라이더를 움직여 봐야 다음으로 갈 수 있어요.',
      'basket-cpi-ppi': 'CPI/PPI 전환 버튼을 눌러 봐야 다음으로 갈 수 있어요.',
    } satisfies Record<SimulatorKind, string>

    return { complete: false, message: messageBySimulator[beat.simulator.type] }
  }

  if (beat.id === 's3-b1' && !visualComplete) {
    return { complete: false, message: '수요 증가와 공급 감소 곡선을 모두 움직여 봐야 다음으로 갈 수 있어요.' }
  }

  return { complete: true, message: null }
}

function readSavedStudentJoins(): Record<string, SavedStudentJoin> {
  if (typeof localStorage === 'undefined') {
    return {}
  }

  const raw = localStorage.getItem(studentJoinStorageKey)
  if (!raw) {
    return {}
  }

  try {
    return JSON.parse(raw) as Record<string, SavedStudentJoin>
  } catch {
    return {}
  }
}

function getSavedStudentJoin(classId: string | undefined): SavedStudentJoin | null {
  if (!classId) {
    return null
  }

  return readSavedStudentJoins()[classId] ?? null
}

function saveStudentJoin(join: SavedStudentJoin): void {
  if (typeof localStorage === 'undefined') {
    return
  }

  localStorage.setItem(
    studentJoinStorageKey,
    JSON.stringify({
      ...readSavedStudentJoins(),
      [join.classId]: join,
    }),
  )
}

function clearSavedStudentJoin(classId: string): void {
  if (typeof localStorage === 'undefined') {
    return
  }

  const joins = readSavedStudentJoins()
  delete joins[classId]
  localStorage.setItem(studentJoinStorageKey, JSON.stringify(joins))
}

async function copyTextToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch {
      // Fall back for browser contexts that block the async clipboard API.
    }
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}



function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/space/:spaceId" element={<SpacePage />} />
        <Route path="/teacher/:classId" element={<TeacherPage />} />
        <Route path="/join/:classId" element={<JoinPage />} />
        <Route path="/student/:classId/:studentId" element={<StudentPage />} />
        <Route path="/preview" element={<StudentPreviewPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  )
}

function HomePage() {
  const navigate = useNavigate()
  const [region, setRegion] = useState('수원')
  const [school, setSchool] = useState('잠원중')
  const [grade, setGrade] = useState('3학년')

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const id = buildSpaceId(region, school, grade)
    await upsertSpace({ id, region: region.trim(), school: school.trim(), grade: grade.trim() })
    navigate(`/space/${id}`)
  }

  return (
    <main className="admin-page min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl flex-col justify-center gap-8">
        <section className="grid items-center gap-8 md:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <p className="hand-tag w-fit">인터랙티브 경제 수업</p>
            <div>
              <h1 className="font-display text-4xl font-black leading-tight sm:text-5xl">
                화폐가치,
                <br />
                인플레이션,
                <br />
                실업과의 전쟁
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-ink-soft">
                화폐가치와 물가와의 관계를 직관적으로 살펴보고, 물가와 실업이 갖는 관계를 알아봅니다
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="hand-panel space-y-4 p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <School className="size-6" />
              <h2 className="font-display text-2xl font-bold">학교와 학년 입장</h2>
            </div>
            <TextField label="지역" value={region} onChange={setRegion} />
            <TextField label="학교" value={school} onChange={setSchool} />
            <TextField label="학년명" value={grade} onChange={setGrade} />
            <HandButton type="submit" className="w-full justify-center">
              <DoorOpen className="size-5" />
              공간 만들기 / 입장
            </HandButton>
          </form>
        </section>
        <div className="home-secondary-actions">
          <Link to="/preview" className="home-secondary-action">
            <Eye className="size-5" aria-hidden="true" />
            학생 화면 미리보기
          </Link>
          <a
            href="https://blog.naver.com/yadoransw/224307366490"
            className="home-secondary-action"
          >
            <MessageCircle className="size-5" aria-hidden="true" />
            오류 보고 / 피드백 남기기
          </a>
        </div>
      </div>
    </main>
  )
}

function SpacePage() {
  const { spaceId } = useParams()
  const navigate = useNavigate()
  const space = useSpace(spaceId)
  const classes = useClasses(spaceId)
  const [className, setClassName] = useState('')

  async function handleCreateClass(event: FormEvent) {
    event.preventDefault()
    if (!spaceId || !className.trim()) {
      return
    }

    await createClass(spaceId, className.trim())
    setClassName('')
  }

  if (!spaceId) {
    return <Navigate to="/" replace />
  }

  return (
    <PageFrame>
      <TopBar title={space ? `${space.region} / ${space.school} / ${space.grade}` : '학교 공간'} />
      <section className="space-board">
        <div className="space-board-header">
          <div>
            <p className="hand-tag w-fit">내 반</p>
            <h1>반 관리</h1>
          </div>
          <span className="space-class-count">총 {classes.length}개 반</span>
        </div>

        <form onSubmit={handleCreateClass} className="class-create-form">
          <div className="class-create-input-wrap">
            <Plus className="size-5" aria-hidden="true" />
            <input
              className="hand-input"
              placeholder="예: 1반"
              value={className}
              onChange={(event) => setClassName(event.target.value)}
            />
          </div>
          <HandButton type="submit">
            <Plus className="size-5" />새 반 추가
          </HandButton>
        </form>

        <div className="class-card-grid">
          {classes.map((classDoc) => (
            <ClassCard key={classDoc.id} classDoc={classDoc} onEnter={() => navigate(`/teacher/${classDoc.id}`)} />
          ))}
          {classes.length === 0 ? (
            <div className="class-empty-state">아직 만든 반이 없습니다. 첫 반을 추가해보세요.</div>
          ) : null}
        </div>
      </section>
    </PageFrame>
  )
}

function ClassCard({ classDoc, onEnter }: { classDoc: ClassDoc; onEnter: () => void }) {
  const joinUrl = getJoinUrl(classDoc.id)
  const students = useStudents(classDoc.id)
  const [copied, setCopied] = useState(false)

  async function handleCopyJoinUrl() {
    await copyTextToClipboard(joinUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  async function handleDeleteClass() {
    const studentWarning = students.length > 0 ? `\n현재 학생 ${students.length}명의 입장 정보도 함께 삭제됩니다.` : ''
    const confirmed = window.confirm(
      `"${classDoc.name}" 반을 삭제할까요?\n\n삭제하면 이 반의 학생, 응답, 진행 상태가 모두 사라집니다.${studentWarning}\n이 작업은 되돌릴 수 없습니다.`,
    )

    if (!confirmed) {
      return
    }

    await deleteClass(classDoc.id)
  }

  return (
    <article className="class-card">
      <div className="class-card-main">
        <div className="class-card-title-row">
          <h2>{classDoc.name}</h2>
          <span className={`class-status ${classDoc.startedAt ? 'is-live' : ''}`}>
            {classDoc.startedAt ? '진행 중' : '준비 중'}
          </span>
        </div>
        <div className="class-card-meta">
          <span>{formatProgressLabel(classDoc.sceneIndex, classDoc.beatIndex)}</span>
          <span>학생 {students.length}명</span>
        </div>
      </div>
      <div className="class-card-actions">
        <HandButton className="class-card-action" onClick={onEnter}>
          <DoorOpen className="size-4" />
          대시보드
        </HandButton>
        <HandButton className="class-card-action" variant="quiet" onClick={() => void handleCopyJoinUrl()}>
          <Clipboard className="size-4" />
          {copied ? '복사 완료' : '링크 복사'}
        </HandButton>
        <QrCodeTextButton value={joinUrl} title={`${classDoc.name} 학생 입장 QR`} />
        <HandButton className="class-card-action danger" variant="quiet" onClick={() => void handleDeleteClass()}>
          <Trash2 className="size-4" />
          삭제
        </HandButton>
      </div>
    </article>
  )
}

function TeacherPage() {
  const { classId } = useParams()
  const classDoc = useClassDoc(classId)
  const students = useStudents(classId)
  const responses = useResponses(classId)
  const joinUrl = classId ? getJoinUrl(classId) : ''
  const now = useNowTick()
  const activeStudents = students.filter((student) => now - student.lastSeenAt < 1000 * 60 * 5).length
  const responseCount = responses.length

  // State
  const [selectedStudent, setSelectedStudent] = useState<StudentDoc | null>(null)

  if (!classId) {
    return <Navigate to="/" replace />
  }

  async function handleStartActivity() {
    if (classId) {
      await startClassActivity(classId)
    }
  }

  async function handleKickStudent(studentId: string, nickname: string) {
    if (window.confirm(`"${nickname}" 학생을 강제 퇴장시키겠습니까? 퇴장 시 제출한 응답도 정리됩니다.`)) {
      await deleteStudent(classId!, studentId)
    }
  }

  function downloadCSV() {
    const headers = [
      '학생 닉네임',
      '상태',
      '현재 진도',
      '누적 제출 수',
      'SCENE 1: 선택 (은화 1개 vs 3개)',
      'SCENE 2: 선택 (물가 상승 vs 하락)',
      'SCENE 3: 뉴스1 (대규모 지원금)',
      'SCENE 3: 뉴스2 (통화량 증가)',
      'SCENE 3: 뉴스3 (국제유가 급등)',
      'SCENE 4: 인물1 (월급 직장인)',
      'SCENE 4: 인물2 (은행 예금)',
      'SCENE 4: 인물3 (대출)',
      'SCENE 4: 인물4 (밀 수입 기업)',
      'SCENE 4: 인물5 (채무자)',
      'SCENE 4: 인물6 (채권자)',
      'SCENE 4: 인물7 (실물자산 소유자)',
      'SCENE 5: 시나리오1 (일자리 실업)',
      'SCENE 5: 시나리오2 (장바구니 물가)',
      'SCENE 5: 시나리오3 (스태그플레이션)'
    ]

    const itemKeys = [
      { activity: 'lesson-choice', itemId: 'merchant-silver-choice' },
      { activity: 'lesson-choice', itemId: 'money-value-price-direction' },
      { activity: 'news', itemId: 'support-spending' },
      { activity: 'news', itemId: 'money-flood' },
      { activity: 'news', itemId: 'oil-shock' },
      { activity: 'people', itemId: 'fixed-salary' },
      { activity: 'people', itemId: 'deposit' },
      { activity: 'people', itemId: 'fixed-loan' },
      { activity: 'people', itemId: 'importer' },
      { activity: 'people', itemId: 'future-debtor' },
      { activity: 'people', itemId: 'future-creditor' },
      { activity: 'people', itemId: 'real-assets' },
      { activity: 'central-bank', itemId: 'high-unemployment-low-inflation' },
      { activity: 'central-bank', itemId: 'high-inflation-low-unemployment' },
      { activity: 'central-bank', itemId: 'stagflation' }
    ]

    const rows = students.map((student) => {
      const isOnline = now - student.lastSeenAt < 1000 * 60 * 5
      const statusText = isOnline ? '온라인' : '오프라인'
      const progressText = formatProgressLabel(student.currentSceneIndex, student.currentBeatIndex)
      const studentResponses = responses.filter(r => r.studentId === student.id)
      const totalCount = studentResponses.length

      const itemAnswers = itemKeys.map((k) => {
        const match = studentResponses
          .filter(r => r.activity === k.activity && r.itemId === k.itemId)
          .sort((a, b) => b.createdAt - a.createdAt)[0]

        if (!match) return '-'

        const firstChoice = match.firstChoice ?? match.choice
        const firstCorrect = match.firstCorrect ?? match.correct
        let selectedLabel = firstChoice
        if (k.activity === 'lesson-choice') {
          const opt = getLessonChoiceOptions().find(o => o.id === firstChoice)
          if (opt) selectedLabel = opt.label.replace(/\n/g, ' ')
        } else if (k.activity === 'news') {
          const opt = newsOptions.find(o => o.id === firstChoice)
          if (opt) selectedLabel = opt.label
        } else if (k.activity === 'people') {
          const opt = peopleOptions.find(o => o.id === firstChoice)
          if (opt) selectedLabel = opt.label
        } else if (k.activity === 'central-bank') {
          const opt = centralBankOptions.find(o => o.id === firstChoice)
          if (opt) selectedLabel = opt.label
        }

        const correctness = firstCorrect === true ? '(정답)' : firstCorrect === false ? '(오답)' : ''
        return `${selectedLabel} ${correctness}`
      })

      return [
        student.nickname,
        statusText,
        progressText,
        totalCount,
        ...itemAnswers
      ]
    })

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => {
        const str = String(val)
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      }).join(','))
    ].join('\r\n')

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `${classDoc?.name || 'class'}_학생_응답_리포트.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (!classDoc) {
    return (
      <main className="teacher-page min-h-screen bg-paper px-4 py-4 text-ink lg:px-6">
        <div className="hand-panel p-6">반 정보를 찾는 중입니다. 링크가 맞는지 확인해주세요.</div>
      </main>
    )
  }

  const isActivityStarted = Boolean(classDoc.startedAt)

  const allActivities = [
    { id: 'lesson-choice' as const, sceneNumber: 'SCENE 1-2', title: '수업 중 선택' },
    { id: 'news' as const, sceneNumber: 'SCENE 3', title: '인플레이션 원인 분류 (뉴스)' },
    { id: 'people' as const, sceneNumber: 'SCENE 4', title: '인물 스와이프 (이해관계)' },
    { id: 'central-bank' as const, sceneNumber: 'SCENE 5', title: '중앙은행 금리결정 시뮬레이션' }
  ]

  return (
    <main className="teacher-page min-h-screen bg-paper px-4 py-4 text-ink lg:px-6">
      <nav className="teacher-topbar">
        <Link to="/" className="inline-flex items-center gap-2 font-bold">
          <Home className="size-5" />
          인플레이션 수업
        </Link>
        <div className="teacher-topbar-meta">
          <span>{classDoc.name} 교사용 진행판</span>
        </div>
      </nav>

      {/* New compact stats & student join bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-2 border-ink/20 bg-white/60 backdrop-blur-sm rounded-[14px] p-2.5 px-5 text-sm font-bold mb-4 max-w-[104rem] mx-auto w-full">
        <div className="flex items-center gap-4 text-ink-soft">
          <span className="flex items-center gap-1.5"><Wifi className="size-4" /> 접속 <strong>{activeStudents}</strong>명</span>
          <span className="text-ink/20">|</span>
          <span className="flex items-center gap-1.5"><Users className="size-4" /> 학생 <strong>{students.length}</strong>명</span>
          <span className="text-ink/20">|</span>
          <span className="flex items-center gap-1.5"><Clipboard className="size-4" /> 응답 <strong>{responseCount}</strong>개</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-ink-soft">학생 입장 URL:</span>
          <code className="bg-paper border border-ink/10 px-2.5 py-1 rounded text-xs select-all font-mono font-medium">{joinUrl}</code>
          <button
            type="button"
            className="hand-button !min-h-[1.8rem] !py-0.5 !px-2.5 text-xs font-sans"
            onClick={() => void navigator.clipboard?.writeText(joinUrl)}
          >
            링크 복사
          </button>
          <QrCodeSmallButton value={joinUrl} title={`${classDoc.name} 학생 입장 QR`} />
        </div>
      </div>

      {/* Slimmed Controls Dashboard */}
      <section className="teacher-slim-controls max-w-[104rem] mx-auto">
        <div className="teacher-slim-title-section">
          <p className="hand-tag w-fit">수업 운영</p>
          <h3 className="mt-1">{isActivityStarted ? '활동 진행 중' : '활동 시작 전'}</h3>
        </div>
        
        <div className="teacher-slim-actions">
          {!isActivityStarted ? (
            <HandButton className="!min-h-[2.4rem] !py-1 !px-3 text-sm !bg-yellow-soft" onClick={() => void handleStartActivity()}>
              <DoorOpen className="size-4" />
              활동 시작
            </HandButton>
          ) : null}
          <HandButton
            className="!min-h-[2.4rem] !py-1 !px-3 text-sm !bg-blue-soft"
            onClick={downloadCSV}
          >
            <Download className="size-4" />
            CSV 다운로드
          </HandButton>
        </div>
      </section>

      {/* Main Consolidated Dashboard Layout */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6 mt-4 items-start max-w-[104rem] mx-auto w-full">
        {/* Left Column: 질문별 응답 및 정답률 통계 */}
        <div className="space-y-6">
          <div className="hand-panel p-5 space-y-6 bg-white/40">
            <div>
              <p className="hand-tag w-fit">질문별 통계</p>
              <h2 className="font-display text-2xl font-bold mt-1">질문별 응답 현황 &amp; 정답률</h2>
            </div>
            
            <div className="space-y-6">
              {allActivities.map((act) => (
                <div key={act.id} className="border-t pt-5 border-ink/10 first:border-t-0 first:pt-0">
                  <h3 className="text-xl font-extrabold text-ink mb-3 flex items-center gap-2">
                    <span className="hand-tag !bg-blue-soft">{act.sceneNumber}</span>
                    {act.title}
                  </h3>
                  <ActivityStats
                    title=""
                    activity={act.id}
                    responses={responses}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: 학생별 정답률 */}
        <div className="space-y-6">
          {/* 학생별 총 정답률 Roster */}
          <StudentAccuracyRoster
            students={students}
            responses={responses}
            onSelectStudent={setSelectedStudent}
            onKickStudent={handleKickStudent}
          />
        </div>
      </section>

      {/* Student History Modal */}
      {selectedStudent && (
        <StudentHistoryModal
          student={selectedStudent}
          responses={responses}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </main>
  )
}

const correctableItems = [
  { activity: 'lesson-choice' as const, itemId: 'merchant-silver-choice' },
  { activity: 'news' as const, itemId: 'support-spending' },
  { activity: 'news' as const, itemId: 'money-flood' },
  { activity: 'news' as const, itemId: 'oil-shock' },
  { activity: 'people' as const, itemId: 'fixed-salary' },
  { activity: 'people' as const, itemId: 'deposit' },
  { activity: 'people' as const, itemId: 'fixed-loan' },
  { activity: 'people' as const, itemId: 'importer' },
  { activity: 'people' as const, itemId: 'future-debtor' },
  { activity: 'people' as const, itemId: 'future-creditor' },
  { activity: 'people' as const, itemId: 'real-assets' },
  { activity: 'central-bank' as const, itemId: 'high-unemployment-low-inflation' },
  { activity: 'central-bank' as const, itemId: 'high-inflation-low-unemployment' }
]

function getStudentAccuracy(studentId: string, responses: ResponseDoc[]) {
  const studentResponses = responses.filter((r) => r.studentId === studentId)
  const firstResponses = firstResponsesByStudentAndItem(studentResponses)
  let correctCount = 0
  let submittedCount = 0
  const missingItems: typeof correctableItems = []

  correctableItems.forEach(({ activity, itemId }) => {
    const first = firstResponses.find((r) => r.activity === activity && r.itemId === itemId)
    if (first) {
      submittedCount++
      if (first.correct === true) {
        correctCount++
      }
    } else {
      missingItems.push({ activity, itemId })
    }
  })

  const percent = submittedCount === 0 ? 0 : Math.round((correctCount / submittedCount) * 100)
  return { correctCount, submittedCount, percent, missingItems }
}

function studentProgressScore(student: StudentDoc): number {
  return student.currentSceneIndex * 100 + student.currentBeatIndex
}

function StudentAccuracyRoster({
  students,
  responses,
  onSelectStudent,
  onKickStudent,
}: {
  students: StudentDoc[]
  responses: ResponseDoc[]
  onSelectStudent: (student: StudentDoc) => void
  onKickStudent: (studentId: string, nickname: string) => void
}) {
  const now = useNowTick()

  const rows = useMemo(() => {
    return students.map((student) => {
      const isOnline = now - student.lastSeenAt < 1000 * 60 * 5
      const { correctCount, submittedCount, percent } = getStudentAccuracy(student.id, responses)
      return {
        student,
        isOnline,
        correctCount,
        submittedCount,
        percent,
        progressScore: studentProgressScore(student),
      }
    }).sort((a, b) =>
      b.progressScore - a.progressScore ||
      b.submittedCount - a.submittedCount ||
      b.percent - a.percent ||
      b.correctCount - a.correctCount ||
      a.student.nickname.localeCompare(b.student.nickname, 'ko'),
    )
  }, [students, responses, now])

  return (
    <div className="hand-panel p-5 space-y-4 bg-white/40">
      <div>
        <p className="hand-tag w-fit">학습 현황</p>
        <h2 className="font-display text-2xl font-bold mt-1">학생별 총 정답률 ({students.length}명)</h2>
      </div>

      <div className="student-accuracy-list">
        {rows.map(({ student, isOnline, correctCount, submittedCount, percent }) => (
          <article key={student.id} className="student-accuracy-row">
            <div className="student-accuracy-main">
              <div className="student-accuracy-name">
                <span
                  className="student-accuracy-dot"
                  style={{ backgroundColor: isOnline ? '#218a4b' : '#999999' }}
                  title={isOnline ? '온라인' : '오프라인'}
                />
                <strong>{student.nickname}</strong>
              </div>
              <div className="student-accuracy-meta">
                <span className="student-position-pill">
                  {formatProgressLabel(student.currentSceneIndex, student.currentBeatIndex)}
                </span>
                {submittedCount === 0 ? (
                  <span className="student-accuracy-empty">미제출</span>
                ) : (
                  <span className="student-accuracy-score">
                    <strong className={percent >= 80 ? 'text-good' : percent >= 50 ? 'text-ink' : 'text-bad'}>
                      {percent}%
                    </strong>
                    <em>
                      {correctCount}/{submittedCount} 풀이
                    </em>
                  </span>
                )}
              </div>
            </div>
            <div className="student-accuracy-actions">
              <button
                type="button"
                className="hand-button student-history-button"
                onClick={() => onSelectStudent(student)}
              >
                이력
              </button>
              <button
                type="button"
                className="btn-danger student-kick-button"
                onClick={() => onKickStudent(student.id, student.nickname)}
              >
                퇴장
              </button>
            </div>
          </article>
        ))}
        {students.length === 0 ? (
          <div className="student-accuracy-empty-state">
            아직 입장한 학생이 없습니다.
          </div>
        ) : null}
      </div>
    </div>
  )
}


function StudentHistoryModal({
  student,
  responses,
  onClose,
}: {
  student: StudentDoc
  responses: ResponseDoc[]
  onClose: () => void
}) {
  const studentResponses = useMemo(() => {
    return responses
      .filter((r) => r.studentId === student.id)
      .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))
  }, [responses, student.id])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return createPortal(
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="student-modal">
        <div className="student-modal-header">
          <h2 id="modal-title">{student.nickname} 학생의 제출 기록</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="닫기"
            onClick={onClose}
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="student-modal-body">
          <div className="mb-4 text-ink-soft font-bold flex justify-between bg-paper p-3 border-2 border-ink rounded-xl">
            <span>현재 진행 위치: {formatProgressLabel(student.currentSceneIndex, student.currentBeatIndex)}</span>
            <span>총 제출 개수: {studentResponses.length}개</span>
          </div>

          <div className="history-timeline">
            {studentResponses.map((res) => {
              const itemTitle = responseItemTitle(res) || '선택 활동'
              const firstResponse: ResponseDoc = {
                ...res,
                choice: res.firstChoice ?? res.choice,
                correct: res.firstCorrect ?? res.correct,
                createdAt: res.firstCreatedAt ?? res.createdAt,
              }
              const firstChoiceText = choiceLabel(firstResponse, { truncateShortAnswer: false })
              const latestChoiceText = choiceLabel(res, { truncateShortAnswer: false })
              const firstCorrectness = responseCorrectnessLabel(firstResponse.correct)
              const latestCorrectness = responseCorrectnessLabel(res.correct)
              const firstTime = res.firstCreatedAt ?? res.createdAt
              const latestTime = res.updatedAt ?? res.createdAt

              return (
                <div key={res.id} className="history-item">
                  <div className="history-item-meta">
                    <span className="hand-tag !bg-blue-soft">{activityLabel(res.activity)}</span>
                    <span>첫 제출 {formatResponseTime(firstTime)} · 최신 {formatResponseTime(latestTime)}</span>
                  </div>
                  <p className="font-bold text-base mt-1 line-clamp-2 leading-snug">{itemTitle}</p>
                  <div className="history-answer-stack">
                    <div className="history-answer-row">
                      <span className="history-answer-label">첫 제출</span>
                      <div className="history-item-answer">
                        <span className="underline decoration-wavy decoration-yellow-soft decoration-3">{firstChoiceText}</span>
                      </div>
                      {firstCorrectness && (
                        <span className={`teacher-answer-pill ${firstCorrectness.tone}`}>
                          {firstCorrectness.label}
                        </span>
                      )}
                    </div>
                    <div className="history-answer-row">
                      <span className="history-answer-label">최신 선택</span>
                      <div className="history-item-answer">
                        <span className="underline decoration-wavy decoration-blue-soft decoration-3">{latestChoiceText}</span>
                      </div>
                      {latestCorrectness && (
                        <span className={`teacher-answer-pill ${latestCorrectness.tone}`}>
                          {latestCorrectness.label}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            {studentResponses.length === 0 ? (
              <p className="text-center text-ink-soft py-8 italic">
                제출한 응답이 아직 없습니다.
              </p>
            ) : null}
          </div>
        </div>

        <div className="student-modal-footer">
          <HandButton onClick={onClose}>닫기</HandButton>
        </div>
      </div>
    </div>,
    document.body
  )
}

function QrCodeSmallButton({ value, title }: { value: string; title: string }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className="hand-button !min-h-[1.8rem] !py-0.5 !px-2.5 text-xs font-sans !bg-yellow-soft"
        onClick={() => setIsOpen(true)}
      >
        QR 코드
      </button>
      {isOpen ? <QrFullscreenModal value={value} title={title} onClose={() => setIsOpen(false)} /> : null}
    </>
  )
}

function QrCodeTextButton({ value, title }: { value: string; title: string }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <HandButton className="class-card-action" variant="quiet" onClick={() => setIsOpen(true)}>
        <QrCode className="size-4" />
        QR
      </HandButton>
      {isOpen ? <QrFullscreenModal value={value} title={title} onClose={() => setIsOpen(false)} /> : null}
    </>
  )
}

function QrFullscreenModal({ value, title, onClose }: { value: string; title: string; onClose: () => void }) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return createPortal(
    <div className="qr-fullscreen" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="qr-fullscreen-backdrop" aria-label="배경 클릭으로 QR 닫기" onClick={onClose} />
      <div className="qr-fullscreen-card">
        <button type="button" className="qr-fullscreen-close" aria-label="QR 닫기" onClick={onClose}>
          <X className="size-6" />
        </button>
        <p className="hand-tag w-fit">학생 입장 QR</p>
        <h2 className="font-display font-black">{title}</h2>
        <div className="qr-fullscreen-code">
          <QRCodeCanvas value={value} size={320} includeMargin />
        </div>
        <p className="qr-fullscreen-url">{value}</p>
      </div>
    </div>,
    document.body
  )
}

function JoinPage() {
  const { classId } = useParams()
  const classDoc = useClassDoc(classId)
  const navigate = useNavigate()
  const [nickname, setNickname] = useState('')
  const [savedJoin, setSavedJoin] = useState<SavedStudentJoin | null>(null)

  useEffect(() => {
    const nextSavedJoin = getSavedStudentJoin(classId)
    setSavedJoin(nextSavedJoin)
    if (nextSavedJoin) {
      setNickname(nextSavedJoin.nickname)
    }
  }, [classId])

  async function handleJoin(event: FormEvent) {
    event.preventDefault()
    if (!classId) {
      return
    }

    if (savedJoin && nickname.trim() === savedJoin.nickname) {
      navigate(`/student/${classId}/${savedJoin.studentId}`)
      return
    }

    const student = await joinClass(classId, nickname)
    saveStudentJoin({ classId, studentId: student.id, nickname: student.nickname })
    navigate(`/student/${classId}/${student.id}`)
  }

  function handleSavedJoin() {
    if (!classId || !savedJoin) {
      return
    }

    navigate(`/student/${classId}/${savedJoin.studentId}`)
  }

  return (
    <main className="min-h-screen bg-paper px-4 py-6 text-ink">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-md items-center">
        <form onSubmit={handleJoin} className="hand-panel w-full space-y-5 p-5">
          <p className="hand-tag w-fit">학생 입장</p>
          <div>
            <h1 className="font-display text-3xl font-black">{classDoc?.name ?? '수업'}에 들어가기</h1>
            <p className="mt-2 text-ink-soft">닉네임은 중복 가능해요. 선생님은 닉네임별 진행률과 응답을 볼 수 있습니다.</p>
          </div>
          {savedJoin ? (
            <div className="rounded-xl border-2 border-ink bg-blue-soft p-3">
              <p className="font-bold text-ink-soft">이 기기에 저장된 닉네임</p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <strong className="text-xl">{savedJoin.nickname}</strong>
                <HandButton type="button" variant="quiet" onClick={handleSavedJoin}>
                  <DoorOpen className="size-5" />
                  다시 입장
                </HandButton>
              </div>
            </div>
          ) : null}
          <TextField label="닉네임" value={nickname} onChange={setNickname} />
          <HandButton type="submit" className="w-full justify-center">
            <DoorOpen className="size-5" />
            수업 참여
          </HandButton>
        </form>
      </div>
    </main>
  )
}

function StudentPage() {
  const { classId, studentId } = useParams()
  const classDoc = useClassDoc(classId)
  const student = useStudent(classId, studentId)
  const studentResponses = useStudentResponses(classId, studentId)
  useEffect(() => {
    if (classId && student) {
      saveStudentJoin({ classId, studentId: student.id, nickname: student.nickname })
    }
  }, [classId, student])

  if (!classId || !studentId) {
    return <Navigate to="/" replace />
  }

  if (!classDoc || !student) {
    return (
      <main className="min-h-screen bg-paper px-4 py-6 text-ink">
        <div className="mx-auto max-w-md">
          <div className="hand-panel p-6">수업 정보를 불러오는 중입니다.</div>
        </div>
      </main>
    )
  }

  if (!classDoc.startedAt) {
    return (
      <main className="min-h-screen bg-paper px-4 py-6 text-ink">
        <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-4xl items-center">
          <section className="student-waiting-panel hand-panel w-full space-y-5 p-5 text-center sm:p-6">
            <p className="hand-tag mx-auto w-fit">입장 완료</p>
            <h1 className="font-display text-3xl font-black">교사와 함께 영상을 먼저 보고, 활동을 시작합시다</h1>
            <p className="text-ink-soft font-bold">
              선생님이 교사 대시보드에서 활동 시작 버튼을 누르면 자동으로 수업 화면이 열립니다.
            </p>
            <StudentWaitingVideoCard />
            <p className="rounded-xl border-2 border-ink bg-blue-soft p-3 font-bold">
              {student.nickname} 님, 잠시만 기다려주세요.
            </p>
          </section>
        </div>
      </main>
    )
  }

  return (
    <ConfettiProvider>
      <main className="min-h-screen bg-paper pb-20 text-ink">
        <div className="student-shell mx-auto flex min-h-screen w-full flex-col px-4 py-5">
          <div className="mb-3 flex items-center justify-end gap-3 text-sm text-ink-soft">
            <span>{student.nickname}</span>
          </div>
          <StudentLessonSession
            key={student.id}
            classId={classId}
            student={student}
            responses={studentResponses}
          />
        </div>
      </main>
    </ConfettiProvider>
  )
}

function StudentPreviewPage() {
  const [position, setPosition] = useState<LessonPosition>({ sceneIndex: 0, beatIndex: 0 })
  const [responses, setResponses] = useState<ResponseDoc[]>([])
  const [isWaitingScreen, setIsWaitingScreen] = useState(true)
  const previewStudent = useMemo<StudentDoc>(() => ({
    id: 'preview-student',
    classId: 'preview-class',
    nickname: '미리보기 학생',
    currentSceneIndex: position.sceneIndex,
    currentBeatIndex: position.beatIndex,
    lastSeenAt: 0,
    createdAt: 0,
  }), [position.beatIndex, position.sceneIndex])

  const handlePreviewSubmit = useCallback<SubmitResponseHandler>((response, previousResponse) => {
    const timestamp = Date.now()
    const existingId = `preview-${response.activity}-${response.itemId}`
    const nextResponse: ResponseDoc = {
      ...response,
      id: existingId,
      createdAt: previousResponse?.createdAt ?? timestamp,
      firstChoice: previousResponse?.firstChoice ?? previousResponse?.choice ?? response.choice,
      firstCorrect: previousResponse?.firstCorrect ?? previousResponse?.correct ?? response.correct,
      firstCreatedAt: previousResponse?.firstCreatedAt ?? previousResponse?.createdAt ?? timestamp,
      updatedAt: timestamp,
    }

    setResponses((current) => {
      const withoutCurrent = current.filter(
        (item) => !(item.activity === response.activity && item.itemId === response.itemId),
      )
      return [...withoutCurrent, nextResponse]
    })
  }, [])

  function movePreviewToLesson(nextPosition: LessonPosition) {
    setIsWaitingScreen(false)
    setPosition(nextPosition)
  }

  return (
    <ConfettiProvider>
      <main className="student-preview-page min-h-screen bg-paper pb-20 text-ink">
        <div className="student-preview-topbar">
          <Link to="/" className="student-preview-home">
            <Home className="size-5" />
            인플레이션 수업
          </Link>
          <span className="student-preview-badge">학생 화면 미리보기</span>
        </div>

        {isWaitingScreen ? (
          <div className="student-shell mx-auto flex min-h-[calc(100vh-5rem)] w-full flex-col px-4 py-5">
            <div className="mb-3 flex items-center justify-end gap-3 text-sm text-ink-soft">
              <span>{previewStudent.nickname}</span>
            </div>
            <section className="student-waiting-panel hand-panel w-full space-y-5 p-5 text-center sm:p-6">
              <p className="hand-tag mx-auto w-fit">입장 완료</p>
              <h1 className="font-display text-3xl font-black">교사와 함께 영상을 먼저 보고, 활동을 시작합시다</h1>
              <p className="text-ink-soft font-bold">
                선생님이 교사 대시보드에서 활동 시작 버튼을 누르면 자동으로 수업 화면이 열립니다.
              </p>
              <StudentWaitingVideoCard />
              <p className="rounded-xl border-2 border-ink bg-blue-soft p-3 font-bold">
                {previewStudent.nickname} 님, 잠시만 기다려주세요.
              </p>
            </section>
            <div className="student-controls">
              <div className="scene-dots" aria-label="Preview progress">
                <button
                  type="button"
                  className="scene-dot is-active"
                  aria-label="대기 화면으로 이동"
                  onClick={() => setIsWaitingScreen(true)}
                />
                {lessonScenes.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    className="scene-dot"
                    aria-label={`${item.number}번 Scene으로 이동`}
                    onClick={() => movePreviewToLesson(getSceneStartPosition(index))}
                  />
                ))}
              </div>
              <div className="student-control-actions">
                <HandButton className="w-full justify-center sm:w-auto" disabled variant="quiet">
                  <ArrowLeft className="size-5" />
                  이전
                </HandButton>
                <HandButton
                  className="w-full justify-center sm:w-auto"
                  onClick={() => movePreviewToLesson({ sceneIndex: 0, beatIndex: 0 })}
                >
                  수업 화면 시작
                  <ArrowRight className="size-5" />
                </HandButton>
              </div>
            </div>
          </div>
        ) : (
          <div className="student-shell mx-auto flex min-h-[calc(100vh-5rem)] w-full flex-col px-4 py-5">
            <div className="mb-3 flex items-center justify-end gap-3 text-sm text-ink-soft">
              <span>{previewStudent.nickname}</span>
            </div>
            <LessonPlayer
              classId="preview-class"
              student={previewStudent}
              responses={responses}
              position={position}
              onPositionChange={setPosition}
              allowFreeNavigation
              onBeforeFirst={() => setIsWaitingScreen(true)}
              onSubmitResponse={handlePreviewSubmit}
            />
          </div>
        )}
      </main>
    </ConfettiProvider>
  )
}

function StudentWaitingVideoCard() {
  return (
    <div className="student-waiting-video grid gap-4 text-left md:grid-cols-[minmax(0,1.08fr)_minmax(16rem,0.92fr)] md:items-stretch">
      <a
        href={waitingVideoUrl}
        target="_blank"
        rel="noreferrer"
        className="group relative block overflow-hidden rounded-xl border-2 border-ink bg-ink shadow-[3px_4px_0px_rgba(31,31,29,0.22)] focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-soft"
        aria-label="대기 영상 보기"
      >
        <img
          src={waitingVideoThumbnailUrl}
          alt="제롬 파월과 금리 논쟁 영상 썸네일"
          className="aspect-video h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
        />
        <span className="absolute inset-0 grid place-items-center bg-black/18">
          <span className="grid size-16 place-items-center rounded-full border-2 border-white bg-black/55 text-white shadow-lg transition-transform duration-200 group-hover:scale-105">
            <PlayCircle className="size-10" />
          </span>
        </span>
      </a>

      <div className="rounded-xl border-2 border-ink bg-yellow-soft/70 p-4 shadow-[3px_4px_0px_rgba(31,31,29,0.16)]">
        <p className="font-display text-2xl font-black leading-none">영상을 보며 생각하기</p>
        <ol className="mt-3 space-y-2 text-lg font-bold leading-snug text-ink-soft">
          {waitingVideoQuestions.map((question, index) => (
            <li key={question} className="flex gap-2">
              <span className="text-ink">{index + 1}.</span>
              <span>{question}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}

function StudentLessonSession({
  classId,
  student,
  responses,
}: {
  classId: string
  student: StudentDoc
  responses: ResponseDoc[]
}) {
  const [localPosition, setLocalPosition] = useState<LessonPosition>(() => getStudentLessonPosition(student))

  const handlePositionChange = useCallback((nextPosition: LessonPosition) => {
    setLocalPosition(nextPosition)
    void markStudentPosition(classId, student.id, nextPosition)
  }, [classId, student.id])

  return (
    <LessonPlayer
      classId={classId}
      student={student}
      responses={responses}
      position={localPosition}
      onPositionChange={handlePositionChange}
      onSubmitResponse={submitResponse}
    />
  )
}

function LessonPlayer({
  classId,
  student,
  responses,
  position,
  onPositionChange,
  allowFreeNavigation = false,
  onBeforeFirst,
  onSubmitResponse = submitResponse,
}: {
  classId: string
  student: StudentDoc
  responses: ResponseDoc[]
  position: LessonPosition
  onPositionChange: (position: LessonPosition) => void
  allowFreeNavigation?: boolean
  onBeforeFirst?: () => void
  onSubmitResponse?: SubmitResponseHandler
}) {
  const scene = lessonScenes[position.sceneIndex]
  const beat = scene.beats[position.beatIndex]
  const isFirst = position.sceneIndex === 0 && position.beatIndex === 0
  const isLast = position.sceneIndex === lessonScenes.length - 1 && position.beatIndex === scene.beats.length - 1
  const hasSimulatorMarker = beat.body.some((line) => line.trim() === SIMULATOR_BODY_MARKER)
  const hasInteractiveComponent = Boolean(beat.simulator || beat.activity)
  const shouldShowVisual = Boolean((beat.visual || beat.image) && !hasInteractiveComponent)
  const shouldShowInlineVisual = Boolean(beat.image && beat.choice)
  const [introSceneIndex, setIntroSceneIndex] = useState<number | null>(() =>
    position.beatIndex === 0 ? position.sceneIndex : null,
  )
  const isSceneIntroVisible = introSceneIndex === position.sceneIndex && position.beatIndex === 0
  const [showAccuracyModal, setShowAccuracyModal] = useState(false)
  const [revealedConceptBlanks, setRevealedConceptBlanks] = useState<Record<string, string[]>>({})
  const [simulatorCompletions, setSimulatorCompletions] = useState<Record<string, boolean>>({})
  const [visualCompletions, setVisualCompletions] = useState<Record<string, boolean>>({})
  const [highestUnlockedPosition, setHighestUnlockedPosition] = useState<LessonPosition>(position)
  const currentRevealedConceptBlanks = revealedConceptBlanks[beat.id] ?? []
  const completion = isBeatWorkComplete(
    beat,
    responses,
    currentRevealedConceptBlanks,
    simulatorCompletions[beat.id] ?? false,
    visualCompletions[beat.id] ?? false,
  )

  const handleSimulatorCompleteChange = useCallback((complete: boolean) => {
    setSimulatorCompletions((previous) => {
      if (previous[beat.id] === complete) {
        return previous
      }

      return {
        ...previous,
        [beat.id]: complete,
      }
    })
  }, [beat.id])

  const handleVisualCompleteChange = useCallback((complete: boolean) => {
    setVisualCompletions((previous) => {
      if (previous[beat.id] === complete) {
        return previous
      }

      return {
        ...previous,
        [beat.id]: complete,
      }
    })
  }, [beat.id])

  function handleConceptBlankReveal(blankId: string) {
    setRevealedConceptBlanks((previous) => {
      const current = previous[beat.id] ?? []
      if (current.includes(blankId)) {
        return previous
      }

      return {
        ...previous,
        [beat.id]: [...current, blankId],
      }
    })
  }

  const isForwardPosition = useCallback((nextPosition: LessonPosition): boolean => {
    return isPositionAfter(nextPosition, position)
  }, [position])

  const isUnlockedPosition = useCallback((nextPosition: LessonPosition): boolean => {
    return isPositionBeforeOrSame(nextPosition, highestUnlockedPosition)
  }, [highestUnlockedPosition])

  const isImmediateNextPosition = useCallback((nextPosition: LessonPosition): boolean => {
    return isSamePosition(nextPosition, getNextPosition(position))
  }, [position])

  const canMoveToPosition = useCallback((nextPosition: LessonPosition): boolean => {
    if (allowFreeNavigation) {
      return true
    }

    if (isUnlockedPosition(nextPosition)) {
      return true
    }

    return isForwardPosition(nextPosition) && isImmediateNextPosition(nextPosition) && completion.complete
  }, [allowFreeNavigation, completion.complete, isForwardPosition, isImmediateNextPosition, isUnlockedPosition])

  const moveStudent = useCallback((nextPosition: LessonPosition) => {
    if (!canMoveToPosition(nextPosition)) {
      return
    }

    if (nextPosition.beatIndex === 0) {
      setIntroSceneIndex(nextPosition.sceneIndex)
    } else {
      setIntroSceneIndex(null)
    }

    setHighestUnlockedPosition((current) => (isPositionAfter(nextPosition, current) ? nextPosition : current))
    onPositionChange(nextPosition)
  }, [canMoveToPosition, onPositionChange])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        showAccuracyModal ||
        !shouldHandleLessonArrowKey(event.target)
      ) {
        return
      }

      if (event.key === 'ArrowLeft') {
        if (isFirst) {
          onBeforeFirst?.()
          return
        }

        event.preventDefault()
        moveStudent(getPreviousPosition(position))
        return
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()

        if (isSceneIntroVisible) {
          setIntroSceneIndex(null)
          return
        }

        if (!allowFreeNavigation && !completion.complete) {
          return
        }

        if (isLast) {
          setShowAccuracyModal(true)
          return
        }

        moveStudent(getNextPosition(position))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    allowFreeNavigation,
    completion.complete,
    isFirst,
    isLast,
    isSceneIntroVisible,
    moveStudent,
    onBeforeFirst,
    position,
    showAccuracyModal,
  ])

  return (
    <div className="scene-wipe-host flex flex-1 flex-col">
      <ChalkSceneWipe sceneId={scene.id} sceneNumber={scene.number} />
      <AnimatePresence mode="wait">
        {isSceneIntroVisible ? (
          <motion.button
            key={`${scene.id}-intro`}
            type="button"
            className="scene-intro-card"
            initial={{ opacity: 0, y: 18, rotate: -0.4 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            exit={{ opacity: 0, y: -12, rotate: 0.4 }}
            transition={{ duration: 0.3 }}
            onClick={() => setIntroSceneIndex(null)}
          >
            <span>SCENE {scene.number}</span>
            <strong>{scene.title}</strong>
            <em>클릭해서 시작</em>
          </motion.button>
        ) : (
          <motion.section
            key={beat.id}
            className="lesson-card"
            initial={{ opacity: 0, y: 14, rotate: -0.2 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            exit={{ opacity: 0, y: -10, rotate: 0.2 }}
            transition={{ duration: 0.28 }}
          >
            <span className="student-beat-corner" aria-label={`Beat ${position.beatIndex + 1} / ${scene.beats.length}`}>
              {position.beatIndex + 1}/{scene.beats.length}
            </span>
            <div className="lesson-scene-header">
              <p className="hand-tag shrink-0">SCENE {scene.number}</p>
              <h1>{scene.title}</h1>
            </div>
            <div className={`lesson-content-grid ${shouldShowVisual ? '' : 'without-visual'} ${shouldShowInlineVisual ? 'inline-visual-flow' : ''}`}>
              <div className="lesson-copy-column space-y-5">
                <div>
                  <div className="lesson-body-text text-ink-soft">
                    {beat.body.map((line, index) =>
                      line.trim() === SIMULATOR_BODY_MARKER ? (
                        beat.simulator ? (
                          <SimulatorPanel
                            key={`${beat.id}-simulator`}
                            simulator={beat.simulator}
                            beatId={beat.id}
                            onCompleteChange={handleSimulatorCompleteChange}
                          />
                        ) : null
                      ) : (
                        <p key={`${beat.id}-${index}`}>{renderScriptLine(line)}</p>
                      ),
                    )}
                  </div>
                </div>
                {beat.simulator && !hasSimulatorMarker ? (
                  <SimulatorPanel
                    simulator={beat.simulator}
                    beatId={beat.id}
                    onCompleteChange={handleSimulatorCompleteChange}
                  />
                ) : null}
                {beat.response ? (
                  <ShortAnswerPanel
                    classId={classId}
                    student={student}
                    responses={responses}
                    sceneId={scene.id}
                    response={beat.response}
                    onSubmitResponse={onSubmitResponse}
                  />
                ) : null}
                {shouldShowInlineVisual ? (
                  <SketchVisual image={beat.image} visual={beat.visual} />
                ) : null}
                {beat.choice ? (
                  <LessonChoicePanel
                    choice={beat.choice}
                    classId={classId}
                    student={student}
                    responses={responses}
                    onSubmitResponse={onSubmitResponse}
                  />
                ) : null}
                {beat.concept ? (
                  <ConceptReveal
                    concept={beat.concept}
                    revealedBlankIds={currentRevealedConceptBlanks}
                    onRevealBlank={handleConceptBlankReveal}
                  />
                ) : null}
                {beat.activity ? (
                  <ActivityPanel
                    activity={beat.activity}
                    classId={classId}
                    student={student}
                    responses={responses}
                    onSubmitResponse={onSubmitResponse}
                  />
                ) : null}
              </div>
              {shouldShowVisual && !shouldShowInlineVisual ? (
                <SketchVisual image={beat.image} visual={beat.visual} onCompleteChange={handleVisualCompleteChange} />
              ) : null}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {!isSceneIntroVisible ? (
        <div className="student-controls">
          <div className="scene-dots" aria-label="Scene progress">
            {lessonScenes.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={`scene-dot ${index === position.sceneIndex ? 'is-active' : ''}`}
                aria-label={`${item.number}번 Scene으로 이동`}
                disabled={!allowFreeNavigation && !canMoveToPosition(getSceneStartPosition(index))}
                onClick={() => moveStudent(getSceneStartPosition(index))}
              />
            ))}
          </div>
          {!allowFreeNavigation && !completion.complete ? (
            <p className="student-progress-lock" role="status">
              {completion.message}
            </p>
          ) : null}
          <div className="student-control-actions">
            <HandButton
              className="w-full justify-center sm:w-auto"
              disabled={isFirst && !onBeforeFirst}
              variant="quiet"
              onClick={() => {
                if (isFirst) {
                  onBeforeFirst?.()
                } else {
                  moveStudent(getPreviousPosition(position))
                }
              }}
            >
              <ArrowLeft className="size-5" />
              이전
            </HandButton>
            <HandButton
              className="w-full justify-center sm:w-auto"
              disabled={!allowFreeNavigation && !completion.complete}
              onClick={() => {
                if (isLast) {
                  setShowAccuracyModal(true)
                } else {
                  moveStudent(getNextPosition(position))
                }
              }}
            >
              {isLast ? '수업 끝' : beat.buttonLabel ?? '다음'}
              {!isLast ? <ArrowRight className="size-5" /> : null}
            </HandButton>
          </div>
        </div>
      ) : null}

      {showAccuracyModal && (
        <StudentAccuracyReportModal
          classId={classId}
          student={student}
          responses={responses}
          onClose={() => setShowAccuracyModal(false)}
        />
      )}
    </div>
  )
}

function ChalkSceneWipe({ sceneId, sceneNumber }: { sceneId: string; sceneNumber: number }) {
  return (
    <motion.div
      key={sceneId}
      className="chalk-scene-wipe"
      aria-hidden="true"
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ duration: 0.78, ease: [0.22, 1, 0.36, 1], delay: 0.12 }}
    >
      <motion.div
        className="chalk-board-fill"
        initial={{ x: '-8%', scaleX: 0.05 }}
        animate={{ x: '102%', scaleX: 1 }}
        transition={{ duration: 0.74, ease: [0.76, 0, 0.24, 1] }}
      />
      <motion.div
        className="chalk-eraser"
        initial={{ x: '-18%', rotate: -4 }}
        animate={{ x: '112%', rotate: 4 }}
        transition={{ duration: 0.74, ease: [0.76, 0, 0.24, 1] }}
      >
        <span />
      </motion.div>
      <div className="chalk-dust dust-one" />
      <div className="chalk-dust dust-two" />
      <p className="chalk-wipe-label">SCENE {sceneNumber}</p>
    </motion.div>
  )
}

function ActivityPanel({
  activity,
  classId,
  student,
  responses,
  onSubmitResponse,
}: {
  activity: ChoiceActivityKind
  classId: string
  student: StudentDoc
  responses: ResponseDoc[]
  onSubmitResponse: SubmitResponseHandler
}) {
  return (
    <div className="space-y-3">
      {activity === 'news' ? (
        <NewsActivity classId={classId} student={student} responses={responses} onSubmitResponse={onSubmitResponse} />
      ) : null}
      {activity === 'people' ? (
        <PeopleActivity classId={classId} student={student} responses={responses} onSubmitResponse={onSubmitResponse} />
      ) : null}
      {activity === 'central-bank' ? (
        <CentralBankActivity
          classId={classId}
          student={student}
          responses={responses}
          onSubmitResponse={onSubmitResponse}
        />
      ) : null}
    </div>
  )
}

function NewsActivity({ classId, student, responses, onSubmitResponse }: ActivityProps) {
  const latest = useLatestResponseMap(responses, 'news')
  const { triggerConfetti } = useConfetti()

  return (
    <div className="space-y-3">
      {newsItems.map((item) => {
        const answer = latest.get(item.id)

        return (
          <div key={item.id} className="activity-card news-question-card">
            <p className="news-question-text font-bold">{item.text}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {newsOptions.map((option) => (
                <ChoiceButton
                  key={option.id}
                  selected={answer?.choice === option.id}
                  tone={answer?.choice === option.id ? (answer.correct ? 'good' : 'bad') : 'neutral'}
                  onClick={(event) => {
                    const isCorrect = option.id === item.answer
                    const alreadyCorrect = answer?.correct === true
                    if (isCorrect && !alreadyCorrect) {
                      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
                      triggerConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2)
                    }
                    void onSubmitResponse({
                      classId,
                      studentId: student.id,
                      studentNickname: student.nickname,
                      sceneId: 'scene-3',
                      activity: 'news',
                      itemId: item.id,
                      choice: option.id,
                      correct: isCorrect,
                    }, answer)
                  }}
                >
                  {option.label}
                </ChoiceButton>
              ))}
            </div>
            {answer ? (
              <p className={`news-feedback mt-3 ${answer.correct ? 'text-good' : 'text-bad'}`}>
                {answer.correct ? '좋아요. 원인을 잘 찾았습니다.' : item.hint}
              </p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

function LessonChoicePanel({
  classId,
  student,
  responses,
  choice,
  onSubmitResponse,
}: ActivityProps & { choice: LessonBeat['choice'] }) {
  const latest = useLatestResponseMap(responses, 'lesson-choice')
  const answer = choice ? latest.get(choice.id) : undefined
  const { triggerConfetti } = useConfetti()

  if (!choice) {
    return null
  }

  return (
    <div className="lesson-choice-card">
      <p className="lesson-choice-title">{choice.title}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {choice.options.map((option) => {
          const selected = answer?.choice === option.id
          const correct = choice.answer ? option.id === choice.answer : null

          return (
            <ChoiceButton
              key={option.id}
              selected={selected}
              tone={selected ? (correct === null ? 'good' : correct ? 'good' : 'bad') : 'neutral'}
              onClick={(event) => {
                const alreadyCorrect = answer?.correct === true
                if (correct === true && !alreadyCorrect) {
                  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
                  triggerConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2)
                }
                void onSubmitResponse({
                  classId,
                  studentId: student.id,
                  studentNickname: student.nickname,
                  sceneId: choice.sceneId,
                  activity: 'lesson-choice',
                  itemId: choice.id,
                  choice: option.id,
                  correct,
                }, answer)
              }}
            >
              {option.label}
            </ChoiceButton>
          )
        })}
      </div>
    </div>
  )
}

function ShortAnswerPanel({
  classId,
  student,
  responses,
  sceneId,
  response,
  onSubmitResponse,
}: ActivityProps & { sceneId: string; response: NonNullable<LessonBeat['response']> }) {
  const latest = useLatestResponseMap(responses, 'short-answer')
  const answer = latest.get(response.id)
  const [value, setValue] = useState(answer?.choice ?? '')

  useEffect(() => {
    setValue(answer?.choice ?? '')
  }, [answer?.choice])

  const trimmed = value.trim()

  return (
    <form
      className="short-answer-panel"
      onSubmit={(event) => {
        event.preventDefault()
        if (!trimmed) {
          return
        }

        void onSubmitResponse({
          classId,
          studentId: student.id,
          studentNickname: student.nickname,
          sceneId,
          activity: 'short-answer',
          itemId: response.id,
          choice: trimmed,
          correct: null,
        }, answer)
      }}
    >
      <label htmlFor={response.id}>{response.question}</label>
      <textarea
        id={response.id}
        value={value}
        placeholder={response.placeholder}
        rows={3}
        onChange={(event) => setValue(event.target.value)}
      />
      <div className="short-answer-actions">
        <span>{answer ? '제출한 답을 다시 고칠 수 있습니다.' : '생각을 한 문장으로 정리해봅시다.'}</span>
        <HandButton type="submit" disabled={!trimmed}>
          제출
        </HandButton>
      </div>
    </form>
  )
}

function ConceptReveal({
  concept,
  revealedBlankIds,
  onRevealBlank,
}: {
  concept: NonNullable<LessonBeat['concept']>
  revealedBlankIds: string[]
  onRevealBlank: (blankId: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)

  if (!isOpen) {
    return (
      <button type="button" className="concept-toggle" onClick={() => setIsOpen(true)}>
        <span>{concept.title ?? '개념 정리'}</span>
        <strong>칠판 열기</strong>
      </button>
    )
  }

  return (
    <div className="concept-board">
      <p className="concept-board-title">{concept.title ?? '개념 정리'}</p>
      <div className="concept-board-lines">
        {concept.lines.map((line, lineIndex) => (
          <p key={line}>
            {renderConceptLine(line, lineIndex, revealedBlankIds, onRevealBlank)}
          </p>
        ))}
      </div>
    </div>
  )
}

type ActivityProps = {
  classId: string
  student: StudentDoc
  responses: ResponseDoc[]
  onSubmitResponse: SubmitResponseHandler
}

type CentralBankDiagnosisChoice = 'inflation' | 'unemployment' | 'both'
type CentralBankPolicyChoice = 'raise' | 'hold' | 'cut'
type CentralBankSideEffectChoice = 'inflation' | 'unemployment' | 'investment-slowdown'
type CentralBankScenario = (typeof centralBankScenarios)[number]

const centralBankDiagnosisOptions: { id: CentralBankDiagnosisChoice; label: string }[] = [
  { id: 'inflation', label: '물가가 더 심각하다' },
  { id: 'unemployment', label: '실업이 더 심각하다' },
  { id: 'both', label: '둘 다 심각하다' },
]

const centralBankSideEffectOptions: { id: CentralBankSideEffectChoice; label: string }[] = [
  { id: 'inflation', label: '물가 상승 압력' },
  { id: 'unemployment', label: '실업 증가 위험' },
  { id: 'investment-slowdown', label: '투자 위축 위험' },
]

function PeopleActivity({ classId, student, responses, onSubmitResponse }: ActivityProps) {
  const [index, setIndex] = useState(0)
  const card = peopleCards[index]
  const latest = useLatestResponseMap(responses, 'people')
  const answer = latest.get(card.id)
  const score = peopleCards.filter((item) => latest.get(item.id)?.correct).length
  const { triggerConfetti } = useConfetti()

  function handleSelect(choice: 'benefit' | 'harm') {
    const isCorrect = choice === card.expected
    const alreadyCorrect = answer?.correct === true
    if (isCorrect && !alreadyCorrect) {
      triggerConfetti(window.innerWidth / 2, window.innerHeight * 0.4)
    }
    void onSubmitResponse({
      classId,
      studentId: student.id,
      studentNickname: student.nickname,
      sceneId: 'scene-4',
      activity: 'people',
      itemId: card.id,
      choice,
      correct: isCorrect,
    }, answer)
  }

  return (
    <InflationPeopleGame
      card={card}
      index={index}
      total={peopleCards.length}
      score={score}
      answer={answer}
      canGoPrevious={index > 0}
      canGoNext={index < peopleCards.length - 1}
      isLast={index === peopleCards.length - 1}
      onSelect={handleSelect}
      onPrevious={() => setIndex(Math.max(0, index - 1))}
      onNext={() => setIndex(Math.min(peopleCards.length - 1, index + 1))}
    />
  )
}

function CentralBankActivity({ classId, student, responses, onSubmitResponse }: ActivityProps) {
  const [scenarioIndex, setScenarioIndex] = useState(0)
  const [diagnosisByScenario, setDiagnosisByScenario] = useState<Record<string, CentralBankDiagnosisChoice>>({})
  const [sideEffectByScenario, setSideEffectByScenario] = useState<Record<string, CentralBankSideEffectChoice>>({})
  const [localPolicyChoiceByScenario, setLocalPolicyChoiceByScenario] = useState<Record<string, CentralBankPolicyChoice | null>>({})
  const { triggerConfetti } = useConfetti()

  const scenario = centralBankScenarios[scenarioIndex]
  const latest = useLatestResponseMap(responses, 'central-bank')
  const answer = latest.get(scenario.id)
  const policyChoice = localPolicyChoiceByScenario[scenario.id] ?? getPolicyChoice(answer?.choice)
  const diagnosisChoice = diagnosisByScenario[scenario.id]
  const sideEffectChoice = sideEffectByScenario[scenario.id]
  const gauge = getScenarioGauge(scenario, policyChoice)
  const recommendedPolicy = scenario.policy.recommended

  // Sync database answer when it changes, but keep local speediness
  useEffect(() => {
    const answerVal = latest.get(scenario.id)
    if (answerVal) {
      const choice = getPolicyChoice(answerVal.choice)
      setLocalPolicyChoiceByScenario((prev) => ({ ...prev, [scenario.id]: choice }))
    }
  }, [scenario.id, latest])

  function setDiagnosis(choice: CentralBankDiagnosisChoice) {
    setDiagnosisByScenario((previous) => ({ ...previous, [scenario.id]: choice }))
  }

  function setSideEffect(choice: CentralBankSideEffectChoice) {
    setSideEffectByScenario((previous) => ({ ...previous, [scenario.id]: choice }))
  }

  return (
    <div className="activity-card central-bank-activity">
      <p className="text-sm text-ink-soft">
        상황 {scenarioIndex + 1} / {centralBankScenarios.length}
      </p>
      <h3 className="mt-1 font-display text-2xl font-bold">{scenario.title}</h3>
      <div className="central-bank-context">
        {scenario.context.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
      <section className="central-bank-step">
        <p className="central-bank-step-title">1. 지금 가장 심각한 문제는?</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {centralBankDiagnosisOptions.map((option) => (
            <ChoiceButton
              key={option.id}
              selected={diagnosisChoice === option.id}
              tone={diagnosisChoice === option.id ? getDiagnosisTone(scenario, option.id) : 'neutral'}
              onClick={(event) => {
                setDiagnosis(option.id)
                const isCorrect = scenario.diagnosis.expected === option.id
                if (isCorrect && diagnosisChoice !== option.id) {
                  triggerConfetti(event.clientX, event.clientY)
                }
              }}
            >
              {option.label}
            </ChoiceButton>
          ))}
        </div>
        {diagnosisChoice ? (
          <p className={`central-bank-feedback ${getDiagnosisTone(scenario, diagnosisChoice)}`}>
            {getDiagnosisFeedback(scenario, diagnosisChoice)}
          </p>
        ) : null}
      </section>

      <div className="central-bank-gauges grid grid-cols-2 gap-3">
        <MiniGauge
          key={`${scenario.id}-prices`}
          label="물가 상승률"
          value={gauge.prices}
        />
        <MiniGauge
          key={`${scenario.id}-jobs`}
          label="실업률"
          value={gauge.jobs}
        />
      </div>

      <section className="central-bank-step">
        <p className="central-bank-step-title">2. 기준금리는 어떻게 할까?</p>
        {diagnosisChoice ? (
          <div className="grid gap-2 sm:grid-cols-3">
            {centralBankOptions.map((option) => {
              const choice = getPolicyChoice(option.id)
              const selected = policyChoice === choice
              const isRecommended = recommendedPolicy === 'none' || recommendedPolicy === choice

              return choice ? (
                <ChoiceButton
                  key={option.id}
                  selected={selected}
                  tone={selected ? (isRecommended ? 'good' : 'bad') : 'neutral'}
                  onClick={(event) => {
                    const isCorrect = recommendedPolicy === 'none' || choice === recommendedPolicy
                    if (isCorrect && policyChoice !== choice) {
                      triggerConfetti(event.clientX, event.clientY)
                    }
                    setLocalPolicyChoiceByScenario((prev) => ({ ...prev, [scenario.id]: choice }))
                    void onSubmitResponse({
                      classId,
                      studentId: student.id,
                      studentNickname: student.nickname,
                      sceneId: 'scene-5',
                      activity: 'central-bank',
                      itemId: scenario.id,
                      choice,
                      correct: recommendedPolicy === 'none' ? null : choice === recommendedPolicy,
                    }, answer)
                  }}
                >
                  {option.label}
                </ChoiceButton>
              ) : null
            })}
          </div>
        ) : (
          <p className="central-bank-hint">먼저 경제 상황을 진단해보세요.</p>
        )}
        {policyChoice ? (
          <p className={`central-bank-feedback ${recommendedPolicy === 'none' || policyChoice === recommendedPolicy ? 'good' : 'bad'}`}>
            {getPolicyFeedback(scenario, policyChoice)}
          </p>
        ) : null}
      </section>

      {policyChoice ? (
        <section className="central-bank-step">
          <p className="central-bank-step-title">3. 이 선택의 가장 큰 부작용은?</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {centralBankSideEffectOptions.map((option) => (
              <ChoiceButton
                key={option.id}
                selected={sideEffectChoice === option.id}
                tone={sideEffectChoice === option.id ? getSideEffectTone(scenario, policyChoice, option.id) : 'neutral'}
                onClick={(event) => {
                  setSideEffect(option.id)
                  const isCorrect = getSideEffectTone(scenario, policyChoice, option.id) === 'good'
                  if (isCorrect && sideEffectChoice !== option.id) {
                    triggerConfetti(event.clientX, event.clientY)
                  }
                }}
              >
                {option.label}
              </ChoiceButton>
            ))}
          </div>
          {sideEffectChoice ? (
            <>
              <p className={`central-bank-feedback ${getSideEffectTone(scenario, policyChoice, sideEffectChoice)}`}>
                {getSideEffectFeedback(scenario, policyChoice, sideEffectChoice)}
              </p>
              <p className="central-bank-final-message">{scenario.finalMessage}</p>
            </>
          ) : null}
        </section>
      ) : null}

      <div className="mt-4 flex justify-between">
        <IconButton label="이전 상황" onClick={() => setScenarioIndex(Math.max(0, scenarioIndex - 1))}>
          <ArrowLeft className="size-4" />
        </IconButton>
        <IconButton
          label="다음 상황"
          onClick={() => setScenarioIndex(Math.min(centralBankScenarios.length - 1, scenarioIndex + 1))}
        >
          <ArrowRight className="size-4" />
        </IconButton>
      </div>
    </div>
  )
}

function useLatestResponseMap(responses: ResponseDoc[], activity: ActivityKind): Map<string, ResponseDoc> {
  return useMemo(() => {
    const latest = new Map<string, ResponseDoc>()
    responses
      .filter((response) => response.activity === activity)
      .forEach((response) => {
        const previous = latest.get(response.itemId)
        if (!previous || response.createdAt > previous.createdAt) {
          latest.set(response.itemId, response)
        }
      })
    return latest
  }, [activity, responses])
}

export function StatsPanel({
  students,
  responses,
  currentActivity,
}: {
  students: StudentDoc[]
  responses: ResponseDoc[]
  currentActivity: ChoiceActivityKind | null
}) {
  const now = useNowTick()
  const activeStudents = students.filter((student) => now - student.lastSeenAt < 1000 * 60 * 20).length
  const statSections: { title: string; activity: ChoiceActivityKind }[] = [
    { title: '수업 중 선택', activity: 'lesson-choice' },
    { title: 'SCENE 3 뉴스 분류', activity: 'news' },
    { title: 'SCENE 4 인물 카드', activity: 'people' },
    { title: 'SCENE 5 중앙은행', activity: 'central-bank' },
  ]
  const orderedSections = currentActivity
    ? [
      ...statSections.filter((section) => section.activity === currentActivity),
      ...statSections.filter((section) => section.activity !== currentActivity),
    ]
    : statSections

  return (
    <div className="hand-panel teacher-stats-panel">
      <div className="grid grid-cols-2 gap-3">
        <Metric icon={<Wifi className="size-5" />} label="활성 접속" value={activeStudents} />
        <Metric icon={<Users className="size-5" />} label="총 학생" value={students.length} />
      </div>
      {orderedSections.map((section, index) => (
        <ActivityStats
          key={section.activity}
          title={index === 0 && section.activity === currentActivity ? `현재 활동 · ${section.title}` : section.title}
          activity={section.activity}
          responses={responses}
        />
      ))}
    </div>
  )
}

function ActivityStats({
  title,
  activity,
  responses,
}: {
  title: string
  activity: ChoiceActivityKind
  responses: ResponseDoc[]
}) {
  const stats = summarizeActivity(responses, activity)

  const firstResponses = useMemo(() => {
    return firstResponsesByStudentAndItem(responses).filter((r) => r.activity === activity)
  }, [responses, activity])

  return (
    <section className="space-y-4">
      {title && <h3 className="font-display text-xl font-bold text-ink-soft">{title}</h3>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {stats.map((item) => {
          const correctChoice = correctChoiceFor(activity, item.itemId)
          const hasCorrectAnswer = correctChoice !== null
          const wrong = Math.max(0, item.total - item.correct)

          return (
            <div key={item.itemId} className="hand-panel p-4 bg-white/60 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <p className="font-extrabold text-ink leading-snug">{item.title}</p>
                <span className="hand-tag !bg-yellow-soft shrink-0">
                  {hasCorrectAnswer && item.accuracy !== null ? `첫 응답 정답률 ${item.accuracy}%` : `첫 응답 ${item.total}명`}
                </span>
              </div>
              {hasCorrectAnswer ? (
                <div className="flex gap-2 text-xs font-bold">
                  <span className="text-good bg-good/10 px-2 py-0.5 rounded-full">첫 응답 정답 {item.correct}명</span>
                  <span className="text-bad bg-bad/10 px-2 py-0.5 rounded-full">첫 응답 오답 {wrong}명</span>
                </div>
              ) : null}
              <div className="space-y-2 mt-2">
                {item.options.map((option) => {
                  const isCorrect = option.id === correctChoice
                  const optionResponses = firstResponses.filter(
                    (r) => r.itemId === item.itemId && r.choice === option.id
                  )
                  const studentNames = optionResponses.map((r) => r.studentNickname)

                  return (
                    <div
                      key={option.id}
                      className={`p-2 rounded-xl border ${
                        isCorrect
                          ? 'border-good bg-good/5'
                          : 'border-ink/10 bg-paper/50'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-bold text-ink-soft mb-1">
                        <span className="flex items-center gap-1.5">
                          {option.label}
                          {isCorrect && (
                            <span className="text-[10px] bg-good text-white px-1.5 py-0.5 rounded-full font-sans">정답</span>
                          )}
                        </span>
                        <span>
                          {option.count}명 ({option.percent}%)
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-ink/10 overflow-hidden mb-2">
                        <div
                          className={`h-full rounded-full ${isCorrect ? 'bg-good' : 'bg-ink-soft'}`}
                          style={{ width: `${option.percent}%` }}
                        />
                      </div>

                      {studentNames.length > 0 ? (
                        <details className="mt-1 text-[11px]">
                          <summary className="cursor-pointer text-ink-soft/60 hover:text-ink font-semibold">
                            최초 응답 학생 보기 ({studentNames.length}명)
                          </summary>
                          <div className="flex flex-wrap gap-1 mt-1 pt-1 border-t border-ink/5">
                            {studentNames.map((name, idx) => (
                              <span
                                key={idx}
                                className="bg-paper text-ink-soft px-1.5 py-0.5 rounded-md border border-ink/10 font-bold"
                              >
                                {name}
                              </span>
                            ))}
                          </div>
                        </details>
                      ) : (
                        <p className="text-[10px] text-ink-soft/45 italic">선택한 학생이 없습니다.</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function activityLabel(activity: ActivityKind): string {
  if (activity === 'news') {
    return '뉴스 분류'
  }
  if (activity === 'people') {
    return '인물 카드'
  }
  if (activity === 'lesson-choice') {
    return '수업 중 선택'
  }
  if (activity === 'short-answer') {
    return '서술형'
  }
  return '중앙은행'
}

function choiceLabel(response: ResponseDoc, options: { truncateShortAnswer?: boolean } = {}): string {
  if (response.activity === 'short-answer') {
    const shouldTruncate = options.truncateShortAnswer ?? true
    return shouldTruncate && response.choice.length > 42 ? `${response.choice.slice(0, 42)}...` : response.choice
  }

  const labels = new Map(
    [...newsOptions, ...peopleOptions, ...centralBankOptions, ...getLessonChoiceOptions()].map(
      (option) => [option.id, option.label],
    ),
  )
  return labels.get(response.choice) ?? response.choice
}

export function isChoiceActivity(activity: ActivityKind | undefined | null): activity is ChoiceActivityKind {
  return Boolean(activity && activity !== 'short-answer')
}





function responseItemTitle(response: ResponseDoc): string | null {
  if (response.activity === 'news') {
    return newsItems.find((item) => item.id === response.itemId)?.text ?? null
  }
  if (response.activity === 'people') {
    return peopleCards.find((item) => item.id === response.itemId)?.title ?? null
  }
  if (response.activity === 'central-bank') {
    return centralBankScenarios.find((item) => item.id === response.itemId)?.title ?? null
  }
  if (response.activity === 'lesson-choice') {
    return lessonChoiceItems.find((item) => item.id === response.itemId)?.title || null
  }

  const shortAnswerBeat = lessonScenes
    .flatMap((scene) => scene.beats)
    .find((beat) => beat.response?.id === response.itemId)
  return shortAnswerBeat?.response?.question ?? null
}

function formatResponseTime(createdAt: number): string {
  return new Intl.DateTimeFormat('ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(createdAt)
}

function responseCorrectnessLabel(correct: ResponseDoc['correct']): { label: string; tone: 'good' | 'bad' } | null {
  if (correct === true) {
    return { label: '정답', tone: 'good' }
  }
  if (correct === false) {
    return { label: '오답', tone: 'bad' }
  }
  return null
}

function correctChoiceFor(activity: ActivityKind, itemId: string): string | null {
  if (activity === 'news') {
    return newsItems.find((item) => item.id === itemId)?.answer ?? null
  }
  if (activity === 'people') {
    return peopleCards.find((item) => item.id === itemId)?.expected ?? null
  }
  if (activity === 'lesson-choice') {
    return lessonChoiceItems.find((item) => item.id === itemId)?.answer ?? null
  }
  if (activity === 'central-bank') {
    const recommended = centralBankScenarios.find((item) => item.id === itemId)?.policy.recommended
    return recommended && recommended !== 'none' ? recommended : null
  }
  return null
}

function useNowTick(): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(interval)
  }, [])

  return now
}



function SketchVisual({
  image,
  visual,
  compact = false,
  onCompleteChange,
}: {
  image?: LessonBeat['image']
  visual?: LessonBeat['visual']
  compact?: boolean
  onCompleteChange?: (complete: boolean) => void
}) {
  const height = compact
    ? 'h-36'
    : visual === 'supply-demand'
      ? 'min-h-[18rem] sm:min-h-[19rem]'
      : image
        ? 'h-[min(54vh,24rem)] sm:h-80'
        : 'h-64 sm:h-80'
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <>
      <div className={`sketch-stage ${height}`} aria-hidden={image || visual === 'supply-demand' ? undefined : true}>
        {image ? (
          <button
            type="button"
            className="w-full h-full p-0 border-0 bg-transparent cursor-zoom-in focus:outline-none"
            onClick={() => setIsExpanded(true)}
            aria-label="이미지 크게 보기"
          >
            <img className="lesson-image hover:opacity-90 transition-opacity" src={image.src} alt={image.alt} draggable={false} />
          </button>
        ) : (
          <>
            {visual === 'rate-conflict' ? <RateConflictSketch /> : null}
            {visual === 'debate' ? <DebateSketch /> : null}
            {visual === 'king' ? <KingSketch /> : null}
            {visual === 'coins' ? <CoinSketch /> : null}
            {visual === 'merchant' ? <MerchantSketch /> : null}
            {visual === 'inflation-flow' ? <FlowSketch /> : null}
            {visual === 'paper-money' ? <MoneySketch /> : null}
            {visual === 'bank-flow' ? <BankFlowSketch /> : null}
            {visual === 'supply-demand' ? (
              <SupplyDemandSketch compact={compact} onCompleteChange={onCompleteChange} />
            ) : null}
            {visual === 'news' ? <NewsSketch /> : null}
            {visual === 'people' ? <PeopleSketch /> : null}
            {visual === 'central-bank' ? <CentralBankSketch /> : null}
            {visual === 'dilemma' ? <DilemmaSketch /> : null}
            {visual === 'price-index' ? <PriceIndexSketch /> : null}
          </>
        )}
      </div>

      {isExpanded && image && (
        <div 
          className="modal-backdrop z-[90] cursor-zoom-out" 
          onClick={() => setIsExpanded(false)}
          role="dialog" 
          aria-modal="true"
        >
          <div 
            className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute -top-12 right-0 bg-white text-ink border-2 border-ink rounded-full w-10 h-10 flex items-center justify-center font-bold shadow-md hover:bg-yellow-soft focus:outline-none"
              onClick={() => setIsExpanded(false)}
              aria-label="닫기"
            >
              <X className="size-5" />
            </button>
            <img 
              className="max-w-full max-h-[75vh] object-contain border-4 border-ink rounded-2xl bg-white shadow-2xl" 
              src={image.src} 
              alt={image.alt} 
            />
            {image.alt && (
              <p className="mt-3 text-white font-bold bg-black/60 px-4 py-1.5 rounded-full text-sm">
                {image.alt}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function renderScriptLine(line: string): ReactNode {
  return renderScriptMarkup(line)
}

function renderScriptMarkup(text: string, keyPrefix = 'script'): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|==[^=]+==)/g)

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={`${part}-${index}`}>
          {renderScriptMarkup(part.slice(2, -2), `${keyPrefix}-${index}-strong`)}
        </strong>
      )
    }

    if (part.startsWith('==') && part.endsWith('==')) {
      return (
        <span className="lesson-highlight-text" key={`${part}-${index}`}>
          {renderScriptMarkup(part.slice(2, -2), `${keyPrefix}-${index}-highlight`)}
        </span>
      )
    }

    return part
  })
}

function renderConceptLine(
  line: string,
  lineIndex: number,
  revealedBlankIds: string[],
  onRevealBlank: (blankId: string) => void,
): ReactNode {
  const parts = line.split(/(__[^_]+__|<u>.*?<\/u>)/g)

  return parts.map((part, index) => {
    const blankText = part.startsWith('__') && part.endsWith('__')
      ? part.slice(2, -2)
      : part.startsWith('<u>') && part.endsWith('</u>')
        ? part.slice(3, -4)
        : null

    if (blankText !== null) {
      const blankId = `${lineIndex}-${index}`
      return (
        <ConceptBlank
          key={`${part}-${index}`}
          answer={blankText}
          isRevealed={revealedBlankIds.includes(blankId)}
          onReveal={() => onRevealBlank(blankId)}
        />
      )
    }

    return part
  })
}

function ConceptBlank({
  answer,
  isRevealed,
  onReveal,
}: {
  answer: string
  isRevealed: boolean
  onReveal: () => void
}) {
  const blankWidth = `${Math.max(7, Math.min(20, Array.from(answer).length + 2))}ch`

  return (
    <button
      type="button"
      className={`concept-blank ${isRevealed ? 'is-revealed' : ''}`}
      style={{ '--blank-width': blankWidth } as CSSProperties}
      aria-label={isRevealed ? `정답: ${answer}` : '빈칸 정답 보기'}
      aria-pressed={isRevealed}
      onClick={onReveal}
    >
      {isRevealed ? answer : null}
    </button>
  )
}



function RateConflictSketch() {
  return (
    <svg viewBox="0 0 300 220" className="sketch-svg wiggle">
      <path d="M150 36v148" className="sketch-line thin" />
      <g transform="translate(42 57) rotate(-5)">
        <rect width="96" height="92" rx="12" fill="#e9f7ff" className="sketch-line-fill" />
        <path d="M25 34h46M25 51h34M25 68h52" className="sketch-line thin" />
        <path d="M82 22l-15 14h15Z" fill="#fff3b0" className="sketch-line-fill" />
        <text x="48" y="119" textAnchor="middle" className="svg-label">낮춰라</text>
      </g>
      <g transform="translate(166 58) rotate(5)">
        <rect width="94" height="92" rx="12" fill="#ffd6df" className="sketch-line-fill" />
        <path d="M24 34h46M24 51h34M24 68h50" className="sketch-line thin" />
        <path d="M19 24l15 14H19Z" fill="#fff3b0" className="sketch-line-fill" />
        <text x="47" y="119" textAnchor="middle" className="svg-label">못 낮춘다</text>
      </g>
      <path d="M123 80c18 17 33 18 51 0M123 130c18-15 33-15 51 0" className="sketch-line" />
      <text x="150" y="201" textAnchor="middle" className="svg-label">금리 논쟁</text>
    </svg>
  )
}

function DebateSketch() {
  return (
    <svg viewBox="0 0 300 220" className="sketch-svg">
      <g transform="translate(34 49)">
        <circle cx="44" cy="36" r="24" fill="#fff" className="sketch-line-fill pop" />
        <path d="M22 106c8-32 22-48 44-48s38 16 45 48Z" fill="#d9f6d3" className="sketch-line-fill" />
        <path d="M35 34h2M56 34h2M35 49c11 8 22 8 32 0" className="sketch-line" />
        <path d="M92 26h56v38H92Z" fill="#e9f7ff" className="sketch-line-fill" />
        <path d="M92 64 82 76l22-12" className="sketch-line" />
        <text x="120" y="48" textAnchor="middle" className="svg-label small">고용!</text>
      </g>
      <g transform="translate(161 49)">
        <circle cx="82" cy="36" r="24" fill="#fff" className="sketch-line-fill pop delay" />
        <path d="M37 106c8-32 22-48 45-48s38 16 45 48Z" fill="#fff3b0" className="sketch-line-fill" />
        <path d="M73 34h2M94 34h2M72 51c11-7 22-7 32 0" className="sketch-line" />
        <path d="M0 26h58v38H0Z" fill="#ffd6df" className="sketch-line-fill" />
        <path d="M58 64 72 76 47 64" className="sketch-line" />
        <text x="29" y="48" textAnchor="middle" className="svg-label small">물가!</text>
      </g>
      <path d="M134 153h32M150 137v32" className="sketch-line" />
      <text x="150" y="199" textAnchor="middle" className="svg-label">낮은 금리의 효과와 부작용</text>
    </svg>
  )
}

function KingSketch() {
  return (
    <svg viewBox="0 0 260 220" className="sketch-svg wiggle">
      <path d="M93 54 112 27l19 30 24-28 15 49H78l15-24Z" fill="#fff3b0" />
      <path d="M93 54 112 27l19 30 24-28 15 49H78l15-24Z" className="sketch-line" />
      <circle cx="124" cy="104" r="43" fill="#fff" className="sketch-line-fill" />
      <path d="M96 146c35 25 69 17 81 45H75c7-23 13-36 21-45Z" fill="#ffd6df" className="sketch-line-fill" />
      <path d="M109 102h2M143 101h2M112 123c16 10 31 8 42-1" className="sketch-line" />
      <path d="M179 71c21 12 31 29 35 52M70 73c-22 13-30 30-31 53" className="sketch-line thin" />
      <text x="130" y="204" textAnchor="middle" className="svg-label">세금은 싫고 돈은 필요하고...</text>
    </svg>
  )
}

function CoinSketch() {
  return (
    <svg viewBox="0 0 280 220" className="sketch-svg">
      <circle cx="82" cy="93" r="48" fill="#e9f7ff" className="sketch-line-fill pop" />
      <path d="M82 45a48 48 0 1 1-7 96A45 45 0 1 0 82 45Z" fill="#f7d65b" />
      <circle cx="198" cy="93" r="48" fill="#f6f6f6" className="sketch-line-fill pop delay" />
      <path d="M198 45a48 48 0 0 1 48 48 48 48 0 0 1-48 48Z" fill="#d7e8ef" />
      <text x="82" y="164" textAnchor="middle" className="svg-label">은 92.5%</text>
      <text x="198" y="164" textAnchor="middle" className="svg-label">은 25%</text>
      <path d="M132 94h27" className="sketch-line" />
    </svg>
  )
}

function MerchantSketch() {
  return (
    <svg viewBox="0 0 280 220" className="sketch-svg">
      <path d="M42 151h92l-10 42H51Z" fill="#fff3b0" className="sketch-line-fill" />
      <text x="88" y="178" textAnchor="middle" className="svg-label">고기 1개?</text>
      <circle cx="201" cy="82" r="35" fill="#fff" className="sketch-line-fill wiggle" />
      <path d="M167 133c31-20 64-18 77 49h-99c5-22 11-38 22-49Z" fill="#d9f6d3" className="sketch-line-fill" />
      <path d="M188 77h2M216 77h2M186 103c14-10 29-10 41 0" className="sketch-line" />
      <path d="M78 80c38-21 69-23 93-8" className="sketch-line thin" />
      <text x="139" y="56" textAnchor="middle" className="svg-label">은화 3개는 받아야지</text>
    </svg>
  )
}

function FlowSketch() {
  return (
    <svg viewBox="0 0 300 220" className="sketch-svg">
      {['화폐가치 하락', '물가 상승', '인플레이션'].map((text, index) => (
        <g key={text} transform={`translate(${25 + index * 92} 77) rotate(${index === 1 ? -2 : 2})`}>
          <rect width="70" height="64" rx="12" fill={index === 1 ? '#ffe1e8' : '#e9f7ff'} className="sketch-line-fill" />
          <text x="35" y="30" textAnchor="middle" className="svg-label small">{text}</text>
        </g>
      ))}
      <path d="M98 110c16-8 28-7 41 0M190 110c16-8 28-7 41 0" className="sketch-line" />
    </svg>
  )
}

function MoneySketch() {
  return (
    <svg viewBox="0 0 280 220" className="sketch-svg">
      {[0, 1, 2, 3, 4].map((item) => (
        <g key={item} transform={`translate(${52 + item * 34} ${58 + (item % 2) * 18}) rotate(${item % 2 ? -8 : 7})`}>
          <rect width="56" height="34" rx="5" fill="#d9f6d3" className="sketch-line-fill pop" />
          <circle cx="28" cy="17" r="9" className="sketch-line" />
        </g>
      ))}
      <text x="140" y="170" textAnchor="middle" className="svg-label">돈이 흔해지면 가치가 흔들립니다</text>
    </svg>
  )
}

function BankFlowSketch() {
  return (
    <svg viewBox="0 0 300 220" className="sketch-svg">
      <path d="M54 88h84l-42-33Z" fill="#e9f7ff" className="sketch-line-fill" />
      <path d="M65 88v65M96 88v65M127 88v65M52 154h90" className="sketch-line" />
      <text x="96" y="178" textAnchor="middle" className="svg-label">중앙은행</text>
      <path d="M169 75v88M154 132h30" className="sketch-line" />
      <circle cx="169" cy="132" r="10" fill="#fff3b0" className="sketch-line-fill" />
      <path d="M190 118c29-9 44-3 62 18" className="sketch-line thin" />
      <rect x="224" y="91" width="47" height="48" fill="#ffd6df" className="sketch-line-fill" />
      <path d="M231 91v-23h28v23" className="sketch-line" />
      <text x="247" y="162" textAnchor="middle" className="svg-label">기업</text>
    </svg>
  )
}

function SupplyDemandSketch({
  compact = false,
  onCompleteChange,
}: {
  compact?: boolean
  onCompleteChange?: (complete: boolean) => void
}) {
  const [mode, setMode] = useState<'normal' | 'demand-up' | 'supply-down'>('normal')
  const [hasMovedDemand, setHasMovedDemand] = useState(false)
  const [hasMovedSupply, setHasMovedSupply] = useState(false)

  const normalEquilibrium = { x: 150, y: 100 }
  const demandUpEquilibrium = { x: 167.5, y: 89 }
  const supplyDownEquilibrium = { x: 132.5, y: 89 }

  const currentEquilibrium =
    mode === 'demand-up'
      ? demandUpEquilibrium
      : mode === 'supply-down'
        ? supplyDownEquilibrium
        : normalEquilibrium

  useEffect(() => {
    onCompleteChange?.(hasMovedDemand && hasMovedSupply)
  }, [hasMovedDemand, hasMovedSupply, onCompleteChange])

  return (
    <div className="flex flex-col items-center justify-between w-full h-full p-2 pb-3">
      {!compact ? (
        <p className="mb-1 text-center text-sm sm:text-base font-black text-ink">
          버튼을 눌러서 수요, 공급 곡선을 움직여 보세요.
        </p>
      ) : null}
      <div className="flex-1 w-full flex items-center justify-center min-h-0 relative">
        <svg viewBox="0 0 300 200" className="sketch-svg w-full h-full">
          {/* Axes */}
          <path d="M 50 20 L 50 160 M 50 160 L 270 160" className="sketch-line" />

          {/* Axis Labels */}
          <text x="25" y="22" className="svg-label font-bold">물가</text>
          <text x="235" y="178" className="svg-label font-bold">생산량</text>

          {/* D (Base Demand) */}
          <path
            d="M 70 50 L 230 150"
            className="sketch-line demand"
            style={{
              strokeWidth: mode === 'demand-up' ? 2 : 4,
              strokeDasharray: mode === 'demand-up' ? '4 4' : 'none',
              opacity: mode === 'demand-up' ? 0.4 : 1,
              transition: 'all 0.3s ease',
            }}
          />
          <text x="235" y="152" className="svg-label font-bold text-good" style={{ fill: '#218a4b' }}>D</text>

          {/* D' (Shifted Demand) */}
          {mode === 'demand-up' && (
            <>
              <path
                d="M 105 50 L 265 150"
                className="sketch-line demand"
                style={{
                  strokeWidth: 4,
                  stroke: '#218a4b',
                  transition: 'all 0.3s ease',
                }}
              />
              <text x="270" y="152" className="svg-label font-bold text-good" style={{ fill: '#218a4b' }}>D'</text>
            </>
          )}

          {/* S (Base Supply) */}
          <path
            d="M 70 150 L 230 50"
            className="sketch-line supply"
            style={{
              strokeWidth: mode === 'supply-down' ? 2 : 4,
              strokeDasharray: mode === 'supply-down' ? '4 4' : 'none',
              opacity: mode === 'supply-down' ? 0.4 : 1,
              transition: 'all 0.3s ease',
            }}
          />
          <text x="235" y="52" className="svg-label font-bold text-bad" style={{ fill: '#d13d4c' }}>S</text>

          {/* S' (Shifted Supply) */}
          {mode === 'supply-down' && (
            <>
              <path
                d="M 35 150 L 195 50"
                className="sketch-line supply"
                style={{
                  strokeWidth: 4,
                  stroke: '#d13d4c',
                  transition: 'all 0.3s ease',
                }}
              />
              <text x="200" y="52" className="svg-label font-bold text-bad" style={{ fill: '#d13d4c' }}>S'</text>
            </>
          )}

          {/* Equilibrium Guides (Dotted lines to axes) */}
          <line
            x1={currentEquilibrium.x}
            y1={currentEquilibrium.y}
            x2="50"
            y2={currentEquilibrium.y}
            style={{ stroke: '#1f1f1d', strokeWidth: 1.5, strokeDasharray: '3 3', opacity: 0.7 }}
          />
          <line
            x1={currentEquilibrium.x}
            y1={currentEquilibrium.y}
            x2={currentEquilibrium.x}
            y2="160"
            style={{ stroke: '#1f1f1d', strokeWidth: 1.5, strokeDasharray: '3 3', opacity: 0.7 }}
          />

          {/* Equilibrium Points */}
          {/* Base E0 */}
          {mode === 'normal' ? (
            <circle cx="150" cy="100" r="5" fill="#1f1f1d" />
          ) : (
            <circle cx="150" cy="100" r="4" fill="#a3a3a3" opacity="0.6" />
          )}

          {/* New E */}
          {mode !== 'normal' && (
            <circle cx={currentEquilibrium.x} cy={currentEquilibrium.y} r="6" fill="#ffb24c" stroke="#1f1f1d" strokeWidth="2" />
          )}

          {/* Price upward arrow on Y-axis */}
          {mode !== 'normal' && (
            <g>
              <line x1="38" y1="100" x2="38" y2="89" style={{ stroke: '#ffb24c', strokeWidth: 3 }} />
              <path d="M 34 94 L 38 88 L 42 94" style={{ fill: 'none', stroke: '#ffb24c', strokeWidth: 2, strokeLinecap: 'round' }} />
              <text x="18" y="93" className="svg-label small" style={{ fill: '#ffb24c', fontSize: '10px', fontWeight: 'bold' }}>상승</text>
            </g>
          )}
        </svg>
      </div>

      {!compact && (
        <div className="flex gap-1.5 w-full mt-1.5 justify-center flex-wrap">
          <button
            type="button"
            className={`px-2 py-0.5 sm:px-2.5 sm:py-1 text-[11px] sm:text-xs font-bold border-2 border-ink rounded-lg shadow-sm transition-all duration-200 ${mode === 'demand-up'
                ? 'bg-good text-white border-good transform scale-105 shadow'
                : 'bg-white text-ink hover:bg-neutral-100 hover:-translate-y-0.5'
            }`}
            style={{ borderRadius: '12px 14px 10px 13px' }}
            onClick={() => {
              setHasMovedDemand(true)
              setMode(mode === 'demand-up' ? 'normal' : 'demand-up')
            }}
          >
            📈 경제 전체의 수요 증가
          </button>
          <button
            type="button"
            className={`px-2 py-0.5 sm:px-2.5 sm:py-1 text-[11px] sm:text-xs font-bold border-2 border-ink rounded-lg shadow-sm transition-all duration-200 ${mode === 'supply-down'
                ? 'bg-bad text-white border-bad transform scale-105 shadow'
                : 'bg-white text-ink hover:bg-neutral-100 hover:-translate-y-0.5'
            }`}
            style={{ borderRadius: '10px 13px 12px 14px' }}
            onClick={() => {
              setHasMovedSupply(true)
              setMode(mode === 'supply-down' ? 'normal' : 'supply-down')
            }}
          >
            📉 비용 증가로 인한 공급 감소
          </button>
        </div>
      )}
    </div>
  )
}

function NewsSketch() {
  return (
    <svg viewBox="0 0 280 220" className="sketch-svg">
      {[0, 1, 2].map((item) => (
        <g key={item} transform={`translate(${44 + item * 62} ${62 + item * 12}) rotate(${item * 4 - 4})`}>
          <rect width="82" height="74" rx="8" fill={item === 1 ? '#fff3b0' : '#fff'} className="sketch-line-fill" />
          <path d="M13 19h54M13 35h44M13 51h50" className="sketch-line thin" />
        </g>
      ))}
    </svg>
  )
}

function PeopleSketch() {
  return (
    <svg viewBox="0 0 280 220" className="sketch-svg">
      {[0, 1, 2].map((item) => (
        <g key={item} transform={`translate(${52 + item * 58} ${52 + (item % 2) * 24}) rotate(${item * 6 - 6})`}>
          <rect width="76" height="106" rx="10" fill={item === 1 ? '#e9f7ff' : '#fff'} className="sketch-line-fill" />
          <circle cx="38" cy="38" r="18" className="sketch-line" fill="#fff" />
          <path d="M25 75h28M21 89h35" className="sketch-line thin" />
        </g>
      ))}
    </svg>
  )
}

function CentralBankSketch() {
  return (
    <svg viewBox="0 0 300 220" className="sketch-svg">
      <path d="M94 82h112l-56-39Z" fill="#e9f7ff" className="sketch-line-fill" />
      <path d="M110 82v74M150 82v74M190 82v74M88 158h124" className="sketch-line" />
      <path d="M52 160a45 45 0 0 1 80 0M168 160a45 45 0 0 1 80 0" className="sketch-line thin" />
      <path d="M92 144l17-19M208 144l-18-28" className="sketch-line" />
      <text x="150" y="188" textAnchor="middle" className="svg-label">기준금리 레버</text>
    </svg>
  )
}

function DilemmaSketch() {
  return (
    <svg viewBox="0 0 280 220" className="sketch-svg">
      <path d="M140 58v103M93 88h94M87 88l-34 48h68L87 88ZM193 88l-34 68h68l-34-68Z" className="sketch-line" />
      <text x="86" y="157" textAnchor="middle" className="svg-label">물가 안정</text>
      <text x="194" y="178" textAnchor="middle" className="svg-label">고용 안정</text>
    </svg>
  )
}

function PriceIndexSketch() {
  return (
    <svg viewBox="0 0 300 220" className="sketch-svg">
      <path d="M40 160h220M40 120h220M40 80h220" className="sketch-line thin opacity-20" />
      <path d="M40 40v120M40 160h225" className="sketch-line" />
      
      <path d="M40 120c30 10 50 -30 80 -10c30 20 60 -60 90 -40c30 20 50 -10 80 -10" fill="none" stroke="#999" strokeDasharray="3 3" className="sketch-line thin" />
      <path d="M40 140c30 -20 60 10 90 -30c30 -40 60 -10 90 -10c30 0 50 -20 80 -50" fill="none" stroke="#bbb" strokeDasharray="3 3" className="sketch-line thin" />
      
      <path d="M40 130c30 -5 60 -10 90 -20c30 -50 60 -35 90 -25c30 10 50 -15 80 -30" fill="none" stroke="#1f1f1d" strokeWidth="3" className="sketch-line" />
      
      <text x="270" y="70" textAnchor="end" className="svg-label text-[10px]">라면/버스비 등</text>
      <text x="270" y="45" textAnchor="end" className="svg-label font-bold text-ink">물가지수 (종합)</text>
    </svg>
  )
}

function MiniGauge({
  label,
  value,
}: {
  label: string
  value: number
  invertDelta?: boolean
}) {
  const rotation = -55 + value * 1.1
  const [displayValue, setDisplayValue] = useState(value)
  const prevValueRef = useRef<number>(value)

  // 카운트업 애니메이션 및 값 전이
  useEffect(() => {
    const start = prevValueRef.current
    const end = value
    if (start === end) return

    const duration = 800
    const startTime = performance.now()
    let frameId: number

    function step(now: number) {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayValue(Math.round(start + (end - start) * eased))
      if (progress < 1) {
        frameId = requestAnimationFrame(step)
      } else {
        prevValueRef.current = end
      }
    }
    frameId = requestAnimationFrame(step)

    return () => {
      cancelAnimationFrame(frameId)
      prevValueRef.current = end
    }
  }, [value])

  const delta = value - prevValueRef.current
  const isUp = delta > 0.5
  const isDown = delta < -0.5

  // 바늘 색상: 높으면 빨강, 낮으면 초록, 중간이면 기본
  const needleColor =
    value > 65 ? '#d13d4c' : value < 40 ? '#218a4b' : '#1f1f1d'

  return (
    <div className="mini-gauge-card">
      {/* 게이지 다이얼 */}
      <div className="mini-gauge-dial">
        <svg viewBox="0 0 120 76" className="mini-gauge-svg" aria-hidden="true">
          {/* 배경 호 — 위험 구간(빨강) */}
          <path
            d="M20 64a40 40 0 0 1 80 0"
            fill="none" stroke="#f3d9db" strokeWidth="9" strokeLinecap="round"
          />
          {/* 중간 구간(노랑) */}
          <path
            d="M20 64a40 40 0 0 1 40 -40"
            fill="none" stroke="#fff3b0" strokeWidth="9" strokeLinecap="round"
          />
          {/* 안전 구간(초록) */}
          <path
            d="M20 64a40 40 0 0 1 26 -30"
            fill="none" stroke="#d9f6d3" strokeWidth="9" strokeLinecap="round"
          />
          {/* 테두리 호 */}
          <path
            d="M20 64a40 40 0 0 1 80 0"
            fill="none" stroke="#1f1f1d" strokeWidth="3.5" strokeLinecap="round"
          />
          {/* 바늘 — framer-motion으로 스윙 */}
          <motion.path
            d="M60 63 60 30"
            stroke={needleColor}
            strokeWidth="4.5"
            strokeLinecap="round"
            initial={{ rotate: -55 + prevValueRef.current * 1.1 }}
            animate={{ rotate: rotation }}
            transition={{ type: 'spring', stiffness: 55, damping: 12 }}
            style={{ transformOrigin: '60px 63px' }}
          />
          <circle cx="60" cy="63" r="5.5" fill={needleColor} />
        </svg>

        {/* 수치 표시 */}
        <div className="mini-gauge-value">
          <span className="mini-gauge-number" style={{ color: needleColor }}>
            {displayValue}
          </span>
          <AnimatePresence>
            {isUp && (
              <motion.span
                key="up"
                className="mini-gauge-delta up"
                initial={{ opacity: 0, y: 6, scale: 0.7 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              >
                ▲
              </motion.span>
            )}
            {isDown && (
              <motion.span
                key="down"
                className="mini-gauge-delta down"
                initial={{ opacity: 0, y: -6, scale: 0.7 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              >
                ▼
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      <p className="mini-gauge-label">{label}</p>
    </div>
  )
}

function getPolicyChoice(choice: string | undefined): CentralBankPolicyChoice | null {
  if (choice === 'raise' || choice === 'hold' || choice === 'cut') {
    return choice
  }
  return null
}

function getScenarioGauge(scenario: CentralBankScenario, choice: CentralBankPolicyChoice | null) {
  return choice ? scenario.policyGauges[choice] : scenario.gauge
}

function getDiagnosisTone(
  scenario: CentralBankScenario,
  choice: CentralBankDiagnosisChoice,
): 'good' | 'bad' {
  return scenario.diagnosis.expected === choice ? 'good' : 'bad'
}

function getDiagnosisFeedback(scenario: CentralBankScenario, choice: CentralBankDiagnosisChoice): string {
  if (scenario.diagnosis.expected === choice) {
    return scenario.diagnosis.feedback
  }
  return '지표를 다시 한 번 비교해 보세요.'
}

function getPolicyFeedback(scenario: CentralBankScenario, choice: CentralBankPolicyChoice): string {
  if ('feedbackByChoice' in scenario.policy) {
    return scenario.policy.feedbackByChoice[choice]
  }

  if (scenario.policy.recommended === choice) {
    return scenario.policy.feedback
  }

  return '지표를 다시 한 번 비교해 보세요.'
}

function getSideEffectExpected(
  scenario: CentralBankScenario,
  choice: CentralBankPolicyChoice,
): CentralBankSideEffectChoice {
  if ('sideEffectByPolicy' in scenario) {
    return scenario.sideEffectByPolicy[choice]
  }
  return scenario.sideEffect.expected
}

function getSideEffectTone(
  scenario: CentralBankScenario,
  policyChoice: CentralBankPolicyChoice,
  sideEffectChoice: CentralBankSideEffectChoice,
): 'good' | 'bad' {
  const expected = getSideEffectExpected(scenario, policyChoice)
  if (expected === sideEffectChoice) {
    return 'good'
  }
  if (
    'sideEffect' in scenario &&
    'alternativeExpected' in scenario.sideEffect &&
    scenario.sideEffect.alternativeExpected === sideEffectChoice
  ) {
    return 'good'
  }
  return 'bad'
}

function getSideEffectFeedback(
  scenario: CentralBankScenario,
  policyChoice: CentralBankPolicyChoice,
  sideEffectChoice: CentralBankSideEffectChoice,
): string {
  if ('sideEffect' in scenario && getSideEffectTone(scenario, policyChoice, sideEffectChoice) === 'good') {
    return scenario.sideEffect.feedback
  }

  return '지표를 다시 한 번 비교해 보세요.'
}

function ChoiceButton({
  children,
  selected,
  tone,
  onClick,
}: {
  children: string
  selected: boolean
  tone: 'neutral' | 'good' | 'bad'
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void
}) {
  return (
    <button type="button" className={`choice-button ${selected ? 'is-selected' : ''} ${tone}`} onClick={onClick}>
      {children}
    </button>
  )
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="metric-card rounded-hand border-2 border-ink bg-yellow-soft p-3">
      <div className="flex items-center gap-2 text-sm text-ink-soft">{icon}{label}</div>
      <p className="mt-2 font-display text-3xl font-black">{value}</p>
    </div>
  )
}

function PageFrame({ children }: { children: ReactNode }) {
  return <main className="admin-page min-h-screen bg-paper px-4 py-5 text-ink sm:px-6">{children}</main>
}

function TopBar({ title }: { title: string }) {
  return (
    <nav className="mx-auto mb-5 flex max-w-6xl items-center justify-between gap-3">
      <Link to="/" className="inline-flex items-center gap-2 font-bold">
        <Home className="size-5" />
        인플레이션 수업
      </Link>
      <span className="truncate text-right text-sm text-ink-soft">{title}</span>
    </nav>
  )
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold">{label}</span>
      <input className="hand-input w-full" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  )
}

function HandButton({
  children,
  className = '',
  disabled = false,
  type = 'button',
  variant = 'primary',
  onClick,
}: {
  children: ReactNode
  className?: string
  disabled?: boolean
  type?: 'button' | 'submit'
  variant?: 'primary' | 'quiet'
  onClick?: () => void
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`hand-button ${variant === 'quiet' ? 'quiet' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function IconButton({
  children,
  label,
  onClick,
}: {
  children: ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button type="button" className="icon-button" aria-label={label} title={label} onClick={onClick}>
      {children}
      <span className="sr-only">{label}</span>
    </button>
  )
}

function getCorrectableItemTitle(activity: string, itemId: string): string {
  if (activity === 'news') {
    const text = newsItems.find((item) => item.id === itemId)?.text
    return text ? `인플레이션 원인: ${text}` : '인플레이션 뉴스 원인 분류'
  }
  if (activity === 'people') {
    const title = peopleCards.find((item) => item.id === itemId)?.title
    return title ? `인물 영향: ${title}` : '인물 스와이프 영향 분류'
  }
  if (activity === 'central-bank') {
    const title = centralBankScenarios.find((item) => item.id === itemId)?.title
    return title ? `중앙은행 금리결정: ${title}` : '중앙은행 금리 결정'
  }
  if (activity === 'lesson-choice') {
    const title = lessonChoiceItems.find((item) => item.id === itemId)?.title
    return title || '상인의 은화 개수 선택'
  }
  return itemId
}

function StudentAccuracyReportModal({
  classId,
  student,
  responses,
  onClose,
}: {
  classId: string
  student: StudentDoc
  responses: ResponseDoc[]
  onClose: () => void
}) {
  const { correctCount, submittedCount, percent, missingItems } = getStudentAccuracy(student.id, responses)
  const navigate = useNavigate()
  const needsRestart = percent < 40
  const [isResetting, setIsResetting] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  const handleEraseAndRestart = useCallback(async () => {
    setIsResetting(true)
    setResetError(null)

    try {
      await deleteStudent(classId, student.id)
      clearSavedStudentJoin(classId)
      window.alert('이전 풀이를 정리했어요. 처음 입장 화면으로 돌아갑니다.')
      navigate(`/join/${classId}`, { replace: true })
    } catch {
      setResetError('다시 시작을 준비하는 중 문제가 생겼습니다. 잠시 후 다시 시도해주세요.')
      setIsResetting(false)
    }
  }, [classId, navigate, student.id])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !needsRestart) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [needsRestart, onClose])

  return createPortal(
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="student-modal max-w-lg">
        <div className={`student-modal-header ${needsRestart ? '!bg-bad-soft' : '!bg-yellow-soft'}`}>
          <h2 id="modal-title" className="font-display font-black text-2xl">나의 학습 결과 리포트</h2>
          {!needsRestart ? (
            <button
              type="button"
              className="icon-button"
              aria-label="닫기"
              onClick={onClose}
            >
              <X className="size-5" />
            </button>
          ) : null}
        </div>

        <div className="student-modal-body space-y-5 text-ink">
          {needsRestart ? (
            <div className="restart-notice">
              <p className="restart-notice-title">
                조금 더 공부해볼까요? 다시 도전해봅시다.
              </p>
              <p className="restart-notice-body">
                정답률이 40% 미만이라 처음부터 다시 학습할 수 있도록 이전 풀이를 정리하고 입장 화면으로 돌아갑니다.
              </p>
            </div>
          ) : null}

          {/* Summary Card */}
          <div className="bg-paper border-2 border-ink rounded-xl p-4 text-center space-y-2">
            <p className="text-sm text-ink-soft font-bold">{student.nickname} 학생의 성적표</p>
            <div className="flex justify-center items-baseline gap-1">
              <span className="text-4xl font-black font-display text-ink">{percent}%</span>
              <span className="text-sm text-ink-soft">의 정답률</span>
            </div>
            <p className="text-xs text-ink-soft">
              총 {correctableItems.length}개 문항 중 <strong>{submittedCount}</strong>개 제출, <strong>{correctCount}</strong>개 정답
            </p>
            {missingItems.length > 0 ? (
              <div className="student-missing-items">
                <span>미제출</span>
                <ul>
                  {missingItems.map((item) => (
                    <li key={`${item.activity}-${item.itemId}`}>{getCorrectableItemTitle(item.activity, item.itemId)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {/* Progress Gauge */}
            <div className="w-full bg-ink/10 h-3 rounded-full overflow-hidden mt-2">
              <div 
                className="bg-good h-full transition-all duration-500" 
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>

          {/* Breakdown Roster */}
          <div className="space-y-3">
            <h3 className="font-bold text-base text-ink text-left">문항별 상세 결과</h3>
            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
              {correctableItems.map((item) => {
                const first = firstResponsesByStudentAndItem(responses).find(
                  (r) => r.activity === item.activity && r.itemId === item.itemId && r.studentId === student.id,
                ) ?? null
                const itemTitle = getCorrectableItemTitle(item.activity, item.itemId)
                
                let statusText = '미제출'
                let statusTone = 'bg-ink/10 text-ink-soft/60'
                if (first) {
                  if (first.correct === true) {
                    statusText = '정답'
                    statusTone = 'bg-good-soft text-good'
                  } else if (first.correct === false) {
                    statusText = '오답'
                    statusTone = 'bg-bad-soft text-bad'
                  } else {
                    statusText = '제출 완료'
                    statusTone = 'bg-blue-soft text-ink'
                  }
                }

                return (
                  <div key={item.itemId} className="flex justify-between items-center gap-4 bg-white p-3 border border-ink/10 rounded-lg text-sm">
                    <span className="font-bold text-ink truncate flex-1 text-left" title={itemTitle}>
                      {itemTitle}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold shrink-0 ${statusTone}`}>
                      {statusText}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="student-modal-footer">
          {resetError ? <p className="text-sm font-bold text-bad">{resetError}</p> : null}
          {needsRestart ? (
            <HandButton
              className="restart-action-button"
              disabled={isResetting}
              onClick={handleEraseAndRestart}
            >
              {isResetting ? '처음 화면 준비 중...' : '처음부터 다시 학습하기'}
            </HandButton>
          ) : (
            <HandButton className="!bg-yellow-soft !min-h-[2.4rem] !py-1 !px-4 text-sm font-sans" onClick={onClose}>
              닫기
            </HandButton>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

export default App
