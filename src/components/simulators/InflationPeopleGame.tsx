import { AnimatePresence, motion, useMotionValue, useTransform } from 'framer-motion'
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react'
import { useEffect } from 'react'
import { resolvePeopleSwipeChoice, type PeopleChoice } from './InflationPeopleGame.logic'

type InflationPeopleCard = {
  id: string
  title: string
  line: string
  expected: PeopleChoice
  explanation: string
  hint: string
}

type InflationPeopleAnswer = {
  choice: string
  correct: boolean | null
}

type InflationPeopleGameProps = {
  card: InflationPeopleCard
  index: number
  total: number
  score: number
  answer?: InflationPeopleAnswer
  canGoPrevious: boolean
  canGoNext: boolean
  isLast: boolean
  onSelect: (choice: PeopleChoice) => void
  onPrevious: () => void
  onNext: () => void
}

export function InflationPeopleGame({
  card,
  index,
  total,
  score,
  answer,
  canGoPrevious,
  canGoNext,
  isLast,
  onSelect,
  onPrevious,
  onNext,
}: InflationPeopleGameProps) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-180, 0, 180], [-8, 0, 8])
  const harmOpacity = useTransform(x, [-160, 0], [1, 0.18])
  const benefitOpacity = useTransform(x, [0, 160], [0.18, 1])
  const hasCorrectAnswer = answer?.correct === true
  const hasWrongAnswer = answer?.correct === false

  useEffect(() => {
    x.set(0)
  }, [card.id, x])

  function select(choice: PeopleChoice) {
    x.set(0)
    onSelect(choice)
  }

  return (
    <section className="inflation-people-game activity-card" aria-label="인플레이션 인물 스와이프 게임">
      <div className="people-game-top">
        <div>
          <p className="people-game-kicker">
            인물 {index + 1} / {total}
          </p>
          <h3>{card.title}</h3>
        </div>
        <div className="people-score" aria-label={`현재 점수 ${score}점`}>
          <CheckCircle2 className="size-5" />
          {score}
        </div>
      </div>

      <div className="people-swipe-stage">
        <motion.div className="people-drop-zone is-harm" style={{ opacity: harmOpacity }} aria-hidden="true">
          불리
        </motion.div>
        <motion.div className="people-drop-zone is-benefit" style={{ opacity: benefitOpacity }} aria-hidden="true">
          유리
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={card.id}
            className={`people-character-card ${hasCorrectAnswer ? 'is-correct' : ''} ${hasWrongAnswer ? 'is-wrong' : ''}`}
            style={{ x, rotate }}
            initial={{ y: 10, opacity: 0, scale: 0.985 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -8, opacity: 0, scale: 0.985 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1], opacity: { duration: 0.18 } }}
            drag={hasCorrectAnswer ? false : 'x'}
            dragConstraints={{ left: -175, right: 175 }}
            dragElastic={0.18}
            onDragEnd={(_, info) => {
              const choice = resolvePeopleSwipeChoice(info.offset.x, info.velocity.x)
              if (choice) {
                select(choice)
                return
              }

              x.set(0)
            }}
          >
            <div className="people-speech">{card.line}</div>
            <HandDrawnPerson />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="people-choice-row" aria-label="판정 선택">
        <button type="button" className="people-choice-button is-harm" disabled={hasCorrectAnswer} onClick={() => select('harm')}>
          <ArrowLeft className="size-5" />
          불리
        </button>
        <button
          type="button"
          className="people-choice-button is-benefit"
          disabled={hasCorrectAnswer}
          onClick={() => select('benefit')}
        >
          유리
          <ArrowRight className="size-5" />
        </button>
      </div>

      <div className={`people-feedback ${hasCorrectAnswer ? 'is-correct' : hasWrongAnswer ? 'is-wrong' : 'is-idle'}`}>
        {hasCorrectAnswer ? (
          <div className="people-correct-burst" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        ) : null}
        <strong>
          {hasCorrectAnswer ? <CheckCircle2 className="size-7" /> : null}
          {hasCorrectAnswer ? '정답이에요!' : hasWrongAnswer ? '다시 생각해보세요.' : '인물의 입장을 판정해 보세요.'}
        </strong>
        <p>
          {hasCorrectAnswer
            ? card.explanation
            : hasWrongAnswer
              ? card.hint
              : '좌우로 밀거나 아래 버튼을 눌러 유리한지 불리한지 골라보세요.'}
        </p>
      </div>

      <div className="people-game-footer">
        <button type="button" className="icon-button" disabled={!canGoPrevious} aria-label="이전 인물" onClick={onPrevious}>
          <ArrowLeft className="size-4" />
        </button>
        <button type="button" className="hand-button people-next-button" disabled={!canGoNext || !hasCorrectAnswer} onClick={onNext}>
          {isLast ? '완료' : '다음 인물'}
          {!isLast ? <ArrowRight className="size-5" /> : <CheckCircle2 className="size-5" />}
        </button>
        <button
          type="button"
          className="icon-button"
          disabled={!canGoNext || !hasCorrectAnswer}
          aria-label="다음 인물 바로가기"
          onClick={onNext}
        >
          <ArrowRight className="size-4" />
        </button>
      </div>

      {index === total - 1 && hasCorrectAnswer ? (
        <p className="people-complete">완료! {total}명의 입장을 모두 판정했습니다.</p>
      ) : null}
    </section>
  )
}

function HandDrawnPerson() {
  return (
    <svg viewBox="0 0 180 210" className="people-character-svg" aria-hidden="true">
      <ellipse cx="90" cy="194" rx="48" ry="8" fill="#d9f6d3" opacity="0.75" />
      <circle cx="90" cy="44" r="30" fill="#fff7d8" className="people-sketch-fill" />
      <path d="M66 35c9-21 43-23 58 0 2 3 1 8-4 9-15 3-33 2-52-1-5-1-7-5-2-8Z" fill="#6f4b2a" className="people-sketch-fill" />
      <path d="M78 50c4 5 14 5 18 0M76 41h1M104 41h1" className="people-sketch-line thin" />
      <path d="M63 88c8-20 67-20 75 0l-5 58H68Z" fill="#dff4ff" className="people-sketch-fill" />
      <path d="M68 98c-17 12-25 26-28 45M132 98c16 12 23 26 26 45" className="people-sketch-line people-arm" />
      <path d="M78 146c-6 17-10 31-18 48M112 146c6 17 11 31 19 48" className="people-sketch-line people-leg" />
      <path d="M55 194h26M121 194h26" className="people-sketch-line thin" />
    </svg>
  )
}
