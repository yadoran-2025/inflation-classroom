import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEventHandler, PointerEventHandler } from 'react'

const MIN_VALUE = 0
const MAX_VALUE = 100
const CENTER_VALUE = 50
const MAX_OFFSET = 42
const VIEWBOX_WIDTH = 320
const VIEWBOX_HEIGHT = 230
const BASE_Y = 88

type CurrencyValueState = {
  valueLabel: string
  priceLabel: string
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function describeCurrencyValue(value: number): CurrencyValueState {
  if (value <= 25) {
    return {
      valueLabel: '약해짐',
      priceLabel: '오름',
    }
  }

  if (value >= 75) {
    return {
      valueLabel: '강해짐',
      priceLabel: '내림',
    }
  }

  return {
    valueLabel: '보통',
    priceLabel: '보통',
  }
}

function valueToOffset(value: number): number {
  return ((CENTER_VALUE - value) / CENTER_VALUE) * MAX_OFFSET
}

function yToValue(y: number): number {
  const offset = clamp(y - BASE_Y, -MAX_OFFSET, MAX_OFFSET)
  return Math.round(clamp(CENTER_VALUE - (offset / MAX_OFFSET) * CENTER_VALUE, MIN_VALUE, MAX_VALUE))
}

export function CurrencyValueSimulator({ onCompleteChange }: { onCompleteChange?: (complete: boolean) => void } = {}) {
  const [value, setValue] = useState(50)
  const [hasInteracted, setHasInteracted] = useState(false)
  const svgRef = useRef<SVGSVGElement | null>(null)
  const state = useMemo(() => describeCurrencyValue(value), [value])
  const valueOffset = valueToOffset(value)
  const priceOffset = -valueOffset
  const points = {
    value: { x: 80, y: BASE_Y + valueOffset },
    price: { x: 240, y: BASE_Y + priceOffset },
  }

  function setValueFromPointer(clientY: number) {
    const svg = svgRef.current
    if (!svg) {
      return
    }

    const rect = svg.getBoundingClientRect()
    const viewboxY = ((clientY - rect.top) / rect.height) * VIEWBOX_HEIGHT
    setValue(yToValue(viewboxY))
  }

  useEffect(() => {
    onCompleteChange?.(hasInteracted)
  }, [hasInteracted, onCompleteChange])

  return (
    <section className="interest-rate-simulator" aria-label="화폐가치와 물가 시뮬레이터">
      <div className="rate-simulator-heading">
        <span>화폐가치를 위아래로 끌어보세요</span>
        <strong>화폐가치 {state.valueLabel}</strong>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        className="rate-seesaw"
        role="img"
        aria-label={`현재 화폐가치 ${state.valueLabel}, 물가 ${state.priceLabel}`}
        onPointerMove={(event) => {
          if (event.buttons === 1) {
            setValueFromPointer(event.clientY)
          }
        }}
        onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}
      >
        <line x1={points.value.x} y1={points.value.y} x2={points.price.x} y2={points.price.y} className="rate-seesaw-bar" />
        <SeesawSupport x={160} y={BASE_Y + 54} />
        <MovementArrow x={44} y={points.value.y} direction={valueOffset < -8 ? 'up' : valueOffset > 8 ? 'down' : 'steady'} />
        <MovementArrow x={204} y={points.price.y} direction={priceOffset < -8 ? 'up' : priceOffset > 8 ? 'down' : 'steady'} />
        <DraggableNode
          x={points.value.x}
          y={points.value.y}
          label="화폐가치"
          value={state.valueLabel}
          onPointerDown={(event) => {
            setHasInteracted(true)
            event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId)
            setValueFromPointer(event.clientY)
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowUp') {
              event.preventDefault()
              setHasInteracted(true)
              setValue((current) => clamp(current + 5, MIN_VALUE, MAX_VALUE))
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setHasInteracted(true)
              setValue((current) => clamp(current - 5, MIN_VALUE, MAX_VALUE))
            }
          }}
          sliderValue={value}
        />
        <DisplayNode x={points.price.x} y={points.price.y} label="물가" value={state.priceLabel} />
      </svg>
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
}: {
  x: number
  y: number
  label: string
  value: string
  sliderValue: number
  onPointerDown: PointerEventHandler<SVGGElement>
  onKeyDown: KeyboardEventHandler<SVGGElement>
}) {
  return (
    <g
      className="rate-node is-draggable"
      tabIndex={0}
      role="slider"
      aria-label="화폐가치"
      aria-valuemin={MIN_VALUE}
      aria-valuemax={MAX_VALUE}
      aria-valuenow={sliderValue}
      aria-valuetext={`${label} ${value}`}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      transform={`translate(${x} ${y})`}
    >
      <circle r="18" />
      <text y="62">{label}</text>
      <text y="91" className="rate-node-value">{value}</text>
    </g>
  )
}

function DisplayNode({ x, y, label, value }: { x: number; y: number; label: string; value: string }) {
  return (
    <g className="rate-node" transform={`translate(${x} ${y})`}>
      <circle r="18" />
      <text y="62">{label}</text>
      <text y="91" className="rate-node-value">{value}</text>
    </g>
  )
}
