import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEventHandler, PointerEventHandler } from 'react'
import { useConfetti } from '../DoodleConfetti'

const MIN_RATE = 0
const MAX_RATE = 100
const CENTER_RATE = 50
const MAX_OFFSET = 54
const VIEWBOX_WIDTH = 680
const VIEWBOX_HEIGHT = 300
const BASE_Y = 118
const WORD_CHOICES = ['통화량', '화폐가치', '물가'] as const

type RateState = {
  rateLabel: string
  moneyLabel: string
  valueLabel: string
  priceLabel: string
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function describeRate(rate: number): RateState {
  if (rate <= 25) {
    return {
      rateLabel: '낮음',
      moneyLabel: '많아짐',
      valueLabel: '약해짐',
      priceLabel: '오름',
    }
  }

  if (rate >= 75) {
    return {
      rateLabel: '높음',
      moneyLabel: '줄어듦',
      valueLabel: '강해짐',
      priceLabel: '내림',
    }
  }

  return {
    rateLabel: '보통',
    moneyLabel: '보통',
    valueLabel: '보통',
    priceLabel: '보통',
  }
}

function rateToOffset(rate: number): number {
  return ((CENTER_RATE - rate) / CENTER_RATE) * MAX_OFFSET
}

function yToRate(y: number): number {
  const offset = clamp(y - BASE_Y, -MAX_OFFSET, MAX_OFFSET)
  return Math.round(clamp(CENTER_RATE - (offset / MAX_OFFSET) * CENTER_RATE, MIN_RATE, MAX_RATE))
}

function shuffledWords(): string[] {
  return [...WORD_CHOICES].sort(() => Math.random() - 0.5)
}

export function InterestRateSimulator({ onCompleteChange }: { onCompleteChange?: (complete: boolean) => void } = {}) {
  const [rate, setRate] = useState(50)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const { triggerConfetti } = useConfetti()
  const wordChoices = useMemo(() => shuffledWords(), [])

  const CORRECT_MAPPING: Record<number, string> = {
    1: '통화량',
    2: '화폐가치',
    3: '물가',
  }

  const [assignments, setAssignments] = useState<Record<number, string | null>>({
    1: null,
    2: null,
    3: null,
  })
  const [selectedWord, setSelectedWord] = useState<string | null>(null)
  const [hasTestedRateLever, setHasTestedRateLever] = useState(false)

  const isCorrect =
    assignments[1] === CORRECT_MAPPING[1] &&
    assignments[2] === CORRECT_MAPPING[2] &&
    assignments[3] === CORRECT_MAPPING[3]
  const isComplete = isCorrect && hasTestedRateLever

  useEffect(() => {
    onCompleteChange?.(isComplete)
  }, [isComplete, onCompleteChange])

  const state = useMemo(() => describeRate(rate), [rate])
  const rateOffset = rateToOffset(rate)
  const moneyOffset = -rateOffset
  const valueOffset = rateOffset
  const priceOffset = -rateOffset
  const points = {
    rate: { x: 72, y: BASE_Y + rateOffset },
    money: { x: 240, y: BASE_Y + moneyOffset },
    value: { x: 408, y: BASE_Y + valueOffset },
    price: { x: 576, y: BASE_Y + priceOffset },
  }

  function setRateFromPointer(clientY: number) {
    const svg = svgRef.current
    if (!svg) {
      return
    }

    const rect = svg.getBoundingClientRect()
    const viewboxY = ((clientY - rect.top) / rect.height) * VIEWBOX_HEIGHT
    setRate(yToRate(viewboxY))
  }

  function handleAssign(slotId: number, clientX: number, clientY: number) {
    if (isCorrect) return

    const currentWord = assignments[slotId]

    if (selectedWord) {
      // If this word was assigned to another slot, clear that slot
      const nextAssignments = { ...assignments }
      Object.keys(nextAssignments).forEach((key) => {
        if (nextAssignments[Number(key)] === selectedWord) {
          nextAssignments[Number(key)] = null
        }
      })
      nextAssignments[slotId] = selectedWord
      setAssignments(nextAssignments)
      setSelectedWord(null)

      // Check if it's correct now
      const isCorrectNow =
        nextAssignments[1] === CORRECT_MAPPING[1] &&
        nextAssignments[2] === CORRECT_MAPPING[2] &&
        nextAssignments[3] === CORRECT_MAPPING[3]

      if (isCorrectNow) {
        triggerConfetti(clientX, clientY)
      } else {
        const allFilled =
          nextAssignments[1] !== null &&
          nextAssignments[2] !== null &&
          nextAssignments[3] !== null
        if (allFilled) {
          setTimeout(() => {
            alert('다시 생각해보세요')
          }, 100)
        }
      }
    } else if (currentWord) {
      // Unassign
      setAssignments((prev) => ({ ...prev, [slotId]: null }))
    }
  }

  return (
    <section className="interest-rate-simulator" aria-label="금리 레버 시뮬레이터">
      <div className="rate-simulator-heading">
        {isCorrect ? (
          <>
            <span>금리를 위아래로 끌어보세요</span>
            <strong>금리 {state.rateLabel}</strong>
          </>
        ) : (
          <>
            <span>알맞은 단어를 빈칸에 채워 시소의 균형을 맞추세요</span>
            <strong style={{ opacity: 0.5 }}>금리 잠김 🔒</strong>
          </>
        )}
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        className="rate-seesaw"
        role="img"
        aria-label={`현재 금리 ${state.rateLabel}, 통화량 ${state.moneyLabel}, 화폐가치 ${state.valueLabel}, 물가 ${state.priceLabel}`}
        onPointerMove={(event) => {
          if (!isCorrect) return
          if (event.buttons === 1) {
            setRateFromPointer(event.clientY)
          }
        }}
        onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}
      >
        <line x1={points.rate.x} y1={points.rate.y} x2={points.money.x} y2={points.money.y} className="rate-seesaw-bar" />
        <line x1={points.money.x} y1={points.money.y} x2={points.value.x} y2={points.value.y} className="rate-seesaw-bar" />
        <line x1={points.value.x} y1={points.value.y} x2={points.price.x} y2={points.price.y} className="rate-seesaw-bar" />
        <SeesawSupport x={156} y={BASE_Y + 62} />
        <SeesawSupport x={324} y={BASE_Y + 62} />
        <SeesawSupport x={492} y={BASE_Y + 62} />
        <MovementArrow x={34} y={points.rate.y} direction={isCorrect ? (rateOffset < -8 ? 'up' : rateOffset > 8 ? 'down' : 'steady') : 'steady'} />
        <MovementArrow x={202} y={points.money.y} direction={isCorrect ? (moneyOffset < -8 ? 'up' : moneyOffset > 8 ? 'down' : 'steady') : 'steady'} />
        <MovementArrow x={370} y={points.value.y} direction={isCorrect ? (valueOffset < -8 ? 'up' : valueOffset > 8 ? 'down' : 'steady') : 'steady'} />
        <MovementArrow x={538} y={points.price.y} direction={isCorrect ? (priceOffset < -8 ? 'up' : priceOffset > 8 ? 'down' : 'steady') : 'steady'} />
        <DraggableNode
          x={points.rate.x}
          y={points.rate.y}
          label="금리"
          value={state.rateLabel}
          onPointerDown={(event) => {
            setHasTestedRateLever(true)
            event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId)
            setRateFromPointer(event.clientY)
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp') {
              event.preventDefault()
              setHasTestedRateLever(true)
              setRate((current) => clamp(current + 5, MIN_RATE, MAX_RATE))
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setHasTestedRateLever(true)
              setRate((current) => clamp(current - 5, MIN_RATE, MAX_RATE))
            }
          }}
          sliderValue={rate}
          isLocked={!isCorrect}
        />

        {/* Slot 1: 통화량 */}
        <g
          className={`rate-node slot-node ${assignments[1] ? 'is-assigned' : 'is-empty'} ${selectedWord ? 'is-highlightable' : ''}`}
          transform={`translate(${points.money.x} ${points.money.y})`}
          onClick={(event) => {
            handleAssign(1, event.clientX, event.clientY)
          }}
          style={{ cursor: isCorrect ? 'default' : 'pointer' }}
        >
          <circle
            r="18"
            style={{
              fill: assignments[1] ? '#4089dd' : '#fffefa',
              stroke: '#1f1f1d',
              strokeWidth: 4,
              strokeDasharray: assignments[1] ? 'none' : '5 5',
            }}
          />
          {!assignments[1] && (
            <text y="6" className="slot-empty-symbol">?</text>
          )}
          <text y="62" className={assignments[1] ? 'slot-assigned-text' : 'slot-empty-text'}>
            {assignments[1] ?? '빈칸 ①'}
          </text>
          {assignments[1] && isCorrect && (
            <text y="91" className="rate-node-value">{state.moneyLabel}</text>
          )}
        </g>

        {/* Slot 2: 화폐가치 */}
        <g
          className={`rate-node slot-node ${assignments[2] ? 'is-assigned' : 'is-empty'} ${selectedWord ? 'is-highlightable' : ''}`}
          transform={`translate(${points.value.x} ${points.value.y})`}
          onClick={(event) => {
            handleAssign(2, event.clientX, event.clientY)
          }}
          style={{ cursor: isCorrect ? 'default' : 'pointer' }}
        >
          <circle
            r="18"
            style={{
              fill: assignments[2] ? '#4089dd' : '#fffefa',
              stroke: '#1f1f1d',
              strokeWidth: 4,
              strokeDasharray: assignments[2] ? 'none' : '5 5',
            }}
          />
          {!assignments[2] && (
            <text y="6" className="slot-empty-symbol">?</text>
          )}
          <text y="62" className={assignments[2] ? 'slot-assigned-text' : 'slot-empty-text'}>
            {assignments[2] ?? '빈칸 ②'}
          </text>
          {assignments[2] && isCorrect && (
            <text y="91" className="rate-node-value">{state.valueLabel}</text>
          )}
        </g>

        {/* Slot 3: 물가 */}
        <g
          className={`rate-node slot-node ${assignments[3] ? 'is-assigned' : 'is-empty'} ${selectedWord ? 'is-highlightable' : ''}`}
          transform={`translate(${points.price.x} ${points.price.y})`}
          onClick={(event) => {
            handleAssign(3, event.clientX, event.clientY)
          }}
          style={{ cursor: isCorrect ? 'default' : 'pointer' }}
        >
          <circle
            r="18"
            style={{
              fill: assignments[3] ? '#4089dd' : '#fffefa',
              stroke: '#1f1f1d',
              strokeWidth: 4,
              strokeDasharray: assignments[3] ? 'none' : '5 5',
            }}
          />
          {!assignments[3] && (
            <text y="6" className="slot-empty-symbol">?</text>
          )}
          <text y="62" className={assignments[3] ? 'slot-assigned-text' : 'slot-empty-text'}>
            {assignments[3] ?? '빈칸 ③'}
          </text>
          {assignments[3] && isCorrect && (
            <text y="91" className="rate-node-value">{state.priceLabel}</text>
          )}
        </g>
      </svg>

      {/* Word matching pool */}
      <div className="rate-matching-pool">
        {!isCorrect ? (
          <>
            <p className="matching-instruction font-bold text-center">
              아래 단어를 선택하고 알맞은 시소의 빈칸( ? )을 클릭해 보세요.
            </p>
            <div className="flex justify-center gap-3 mt-3 flex-wrap">
              {wordChoices.map((word) => {
                const isAssigned = Object.values(assignments).includes(word)
                const isSelected = selectedWord === word

                return (
                  <button
                    key={word}
                    type="button"
                    className={`word-card ${isSelected ? 'is-selected' : ''} ${isAssigned ? 'is-assigned' : ''}`}
                    disabled={isAssigned}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedWord(null)
                      } else {
                        setSelectedWord(word)
                      }
                    }}
                  >
                    {word}
                    {isAssigned && <span className="ml-1 text-xs">✔️</span>}
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          <div className={`rate-success-card ${isComplete ? 'animate-bounce' : ''}`}>
            <span className="rate-success-icon" aria-hidden="true">🎉</span>
            <span className="rate-success-copy">
              <strong>정답입니다!</strong>
              <span>
                {hasTestedRateLever
                  ? '금리와 통화량, 화폐가치, 물가가 함께 움직이는 흐름을 확인했어요!'
                  : '이제 금리 레버를 한 번 움직여 서로 연동되는 변화를 확인해 보세요!'}
              </span>
            </span>
          </div>
        )}
      </div>
    </section>
  )
}

function SeesawSupport({ x, y }: { x: number; y: number }) {
  return <path d={`M${x - 30} ${y} L${x} ${y - 62} L${x + 30} ${y} Z`} className="rate-seesaw-support" />
}

function MovementArrow({ x, y, direction }: { x: number; y: number; direction: 'up' | 'down' | 'steady' }) {
  if (direction === 'steady') {
    return <line x1={x} y1={y - 22} x2={x} y2={y + 22} className="rate-motion-arrow is-steady" />
  }

  const isUp = direction === 'up'
  const startY = isUp ? y + 38 : y - 38
  const endY = isUp ? y - 38 : y + 38

  return (
    <g className="rate-motion-arrow">
      <line x1={x} y1={startY} x2={x} y2={endY} />
      <path d={isUp ? `M${x - 10} ${endY + 12} L${x} ${endY} L${x + 10} ${endY + 12}` : `M${x - 10} ${endY - 12} L${x} ${endY} L${x + 10} ${endY - 12}`} />
    </g>
  )
}

function DraggableNode({
  x,
  y,
  label,
  value,
  sliderValue,
  onPointerDown,
  onKeyDown,
  isLocked,
}: {
  x: number
  y: number
  label: string
  value: string
  sliderValue: number
  onPointerDown: PointerEventHandler<SVGGElement>
  onKeyDown: KeyboardEventHandler<SVGGElement>
  isLocked?: boolean
}) {
  return (
    <g
      className={`rate-node is-draggable ${isLocked ? 'is-locked opacity-75' : ''}`}
      tabIndex={isLocked ? -1 : 0}
      role="slider"
      aria-label="기준금리"
      aria-valuemin={MIN_RATE}
      aria-valuemax={MAX_RATE}
      aria-valuenow={sliderValue}
      aria-valuetext={`${label} ${value}`}
      onPointerDown={isLocked ? undefined : onPointerDown}
      onKeyDown={isLocked ? undefined : onKeyDown}
      transform={`translate(${x} ${y})`}
      style={{ cursor: isLocked ? 'not-allowed' : 'grab' }}
    >
      {isLocked ? (
        <circle r="18" style={{ fill: '#e2e8f0', stroke: '#1f1f1d', strokeWidth: 4, strokeDasharray: '3 3' }} />
      ) : (
        <circle r="18" />
      )}
      <text y="62">{label} {isLocked ? '🔒' : ''}</text>
      {!isLocked && <text y="91" className="rate-node-value">{value}</text>}
    </g>
  )
}
