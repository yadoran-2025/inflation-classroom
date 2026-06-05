import { useEffect, useState } from 'react'

export function Base100Simulator({ onCompleteChange }: { onCompleteChange?: (complete: boolean) => void } = {}) {
  const basePrice = 10000
  const [currentPrice, setCurrentPrice] = useState(12000)
  const [hasAdjustedPrice, setHasAdjustedPrice] = useState(false)

  const priceIndex = Math.round((currentPrice / basePrice) * 100)
  const pctChange = priceIndex - 100

  useEffect(() => {
    onCompleteChange?.(hasAdjustedPrice)
  }, [hasAdjustedPrice, onCompleteChange])

  return (
    <div className="base100-simulator hand-panel p-4 bg-white/60 space-y-5 text-ink border-2 border-ink rounded-xl shadow-sm mx-auto">
      <div className="text-center space-y-1">
        <h4 className="font-display font-black text-lg">⚖️ 물가지수 (기준 100) 시뮬레이터</h4>
        <p className="text-xs text-ink-soft">비교 시점의 장바구니 가격을 조절하며 물가지수의 변화를 알아보세요.</p>
      </div>

      {/* Basket Comparison */}
      <div className="base100-comparison grid grid-cols-2 gap-4">
        {/* Base Year */}
        <div className="border-2 border-ink bg-paper rounded-lg p-3 flex flex-col items-center gap-2 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
          <span className="text-xs font-bold text-ink-soft bg-white border border-ink/20 px-2 py-0.5 rounded-full">
            기준 시점 (과거)
          </span>
          <p className="text-4xl">🧺</p>
          <div className="text-center">
            <p className="font-bold text-sm">장바구니 전체 가격</p>
            <p className="font-mono text-base font-black text-ink mt-0.5">10,000원</p>
          </div>
          <div className="w-full text-center border-t border-ink/10 pt-2">
            <span className="text-xs text-ink-soft">물가지수 기준값</span>
            <p className="font-mono text-xl font-black text-ink">100</p>
          </div>
        </div>

        {/* Current Year */}
        <div className="border-2 border-ink bg-white rounded-lg p-3 flex flex-col items-center gap-2 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
          <span className="text-xs font-bold text-good bg-good-soft border border-good/20 px-2 py-0.5 rounded-full">
            비교 시점 (현재)
          </span>
          <p className="text-4xl">🛒</p>
          <div className="text-center">
            <p className="font-bold text-sm">장바구니 전체 가격</p>
            <p className="font-mono text-base font-black text-ink mt-0.5">
              {currentPrice.toLocaleString()}원
            </p>
          </div>
          <div className="w-full text-center border-t border-ink/10 pt-2">
            <span className="text-xs text-ink-soft">현재 물가지수</span>
            <p className="font-mono text-xl font-black text-bad">
              {priceIndex}
            </p>
          </div>
        </div>
      </div>

      {/* Slider Control */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs font-bold">
          <span>비교 가격 조절</span>
          <span className="font-mono text-ink-soft">{currentPrice.toLocaleString()}원</span>
        </div>
        <input
          type="range"
          min={5000}
          max={20000}
          step={500}
          value={currentPrice}
          onChange={(e) => {
            setHasAdjustedPrice(true)
            setCurrentPrice(Number(e.target.value))
          }}
          className="w-full accent-ink h-2 bg-ink/10 rounded-lg appearance-none cursor-pointer"
        />
      </div>

      {/* Formula & Status Display */}
      <div className="border-t-2 border-dashed border-ink/20 pt-4 text-center space-y-2">
        <div className="price-index-formula bg-paper border border-ink/10 rounded-lg p-2 font-mono text-ink-soft">
          계산식: (현재 {currentPrice.toLocaleString()}원 / 기준 10,000원) × 100 = <strong>{priceIndex}</strong>
        </div>

        <div className="font-bold">
          {pctChange > 0 ? (
            <span className="text-bad text-sm">
              📈 기준 시점(100)보다 물가가 약 <strong>{pctChange}%</strong> 올랐습니다!
            </span>
          ) : pctChange < 0 ? (
            <span className="text-good text-sm">
              📉 기준 시점(100)보다 물가가 약 <strong>{Math.abs(pctChange)}%</strong> 내렸습니다!
            </span>
          ) : (
            <span className="text-ink-soft text-sm">
              ⚖️ 기준 시점과 가격이 동일합니다. (변동 없음)
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
