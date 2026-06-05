import { useEffect, useState } from 'react'

type Item = {
  id: string
  name: string
  emoji: string
  price: number
  step: number
  min: number
  max: number
}

export function PriceBasketSimulator({ onCompleteChange }: { onCompleteChange?: (complete: boolean) => void } = {}) {
  const [items, setItems] = useState<Item[]>([
    { id: 'ramen', name: '라면', emoji: '🍜', price: 1000, step: 100, min: 500, max: 3000 },
    { id: 'apple', name: '사과', emoji: '🍎', price: 2000, step: 200, min: 1000, max: 5000 },
    { id: 'bus', name: '버스 기본요금', emoji: '🚌', price: 1200, step: 100, min: 600, max: 2400 },
  ])
  const [hasUsedAnyControl, setHasUsedAnyControl] = useState(false)

  const initialAverage = 1400

  const handlePriceChange = (id: string, delta: number) => {
    setHasUsedAnyControl(true)
    setItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id === id) {
          const nextPrice = Math.max(item.min, Math.min(item.max, item.price + delta))
          return { ...item, price: nextPrice }
        }
        return item
      })
    )
  }

  const currentAverage = Math.round(
    items.reduce((sum, item) => sum + item.price, 0) / items.length
  )

  const pctChange = Math.round(((currentAverage - initialAverage) / initialAverage) * 100)

  useEffect(() => {
    onCompleteChange?.(hasUsedAnyControl)
  }, [hasUsedAnyControl, onCompleteChange])

  return (
    <div className="hand-panel p-4 bg-white/60 space-y-5 text-ink border-2 border-ink rounded-xl shadow-sm max-w-md mx-auto">
      <div className="text-center space-y-1">
        <h4 className="font-display font-black text-lg">🛒 평균 장바구니 물가 계산기</h4>
        <p className="text-xs text-ink-soft">상품들의 가격을 바꿔가며 평균 물가 수준의 변화를 관찰해보세요.</p>
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-3 gap-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="border-2 border-ink bg-paper rounded-lg p-2.5 flex flex-col items-center justify-between gap-2 shadow-[2px_2px_0px_rgba(0,0,0,1)]"
          >
            <span className="text-2xl" role="img" aria-label={item.name}>
              {item.emoji}
            </span>
            <div className="text-center">
              <p className="font-bold text-xs">{item.name}</p>
              <p className="font-mono text-xs font-bold text-ink-soft mt-0.5">
                {item.price.toLocaleString()}원
              </p>
            </div>
            {/* Control Buttons */}
            <div className="flex gap-1.5 w-full">
              <button
                type="button"
                className="flex-1 flex items-center justify-center border border-ink bg-white rounded hover:bg-yellow-soft font-bold text-xs h-7 focus:outline-none"
                onClick={() => handlePriceChange(item.id, -item.step)}
                disabled={item.price <= item.min}
              >
                -
              </button>
              <button
                type="button"
                className="flex-1 flex items-center justify-center border border-ink bg-white rounded hover:bg-yellow-soft font-bold text-xs h-7 focus:outline-none"
                onClick={() => handlePriceChange(item.id, item.step)}
                disabled={item.price >= item.max}
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Average Output */}
      <div className="border-t-2 border-dashed border-ink/20 pt-4 flex flex-col items-center gap-3">
        <div className="w-full flex justify-between text-xs font-bold text-ink-soft px-1">
          <span>최초 평균: 1,400원</span>
          <span>현재 평균: {currentAverage.toLocaleString()}원</span>
        </div>

        {/* Visual gauge */}
        <div className="w-full bg-ink/10 h-4 rounded-full overflow-hidden border border-ink relative">
          <div
            className={`h-full transition-all duration-300 ${
              pctChange > 0 ? 'bg-bad' : pctChange < 0 ? 'bg-good' : 'bg-blue-soft'
            }`}
            style={{ width: `${Math.max(10, Math.min(100, (currentAverage / 3000) * 100))}%` }}
          />
        </div>

        {/* Change text indicator */}
        <div className="text-center font-bold">
          {pctChange > 0 ? (
            <span className="text-bad text-sm">
              📈 기준 대비 물가 평균 <strong>+{pctChange}%</strong> 상승! (인플레이션)
            </span>
          ) : pctChange < 0 ? (
            <span className="text-good text-sm">
              📉 기준 대비 물가 평균 <strong>{pctChange}%</strong> 하락! (디플레이션)
            </span>
          ) : (
            <span className="text-ink-soft text-sm">⚖️ 물가 수준이 변하지 않고 안정적입니다.</span>
          )}
        </div>
      </div>
    </div>
  )
}
