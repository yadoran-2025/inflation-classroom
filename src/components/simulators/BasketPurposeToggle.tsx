import { useEffect, useState } from 'react'

export function BasketPurposeToggle({
  hideTransmission = false,
  onCompleteChange,
}: {
  hideTransmission?: boolean
  onCompleteChange?: (complete: boolean) => void
}) {
  const [activeTab, setActiveTab] = useState<'cpi' | 'ppi'>('cpi')
  const [ppiRaised, setPpiRaised] = useState(false)
  const [hasOpenedPpi, setHasOpenedPpi] = useState(false)
  const [hasToggledTransmission, setHasToggledTransmission] = useState(false)

  const cpiItems = [
    { name: '라면', emoji: '🍜', category: '식료품', basePrice: 1000, currentPrice: ppiRaised ? 1200 : 1000 },
    { name: '시내버스 요금', emoji: '🚌', category: '교통 서비스', basePrice: 1200, currentPrice: ppiRaised ? 1350 : 1200 },
    { name: '카페 아메리카노', emoji: '☕', category: '외식비', basePrice: 2000, currentPrice: ppiRaised ? 2400 : 2000 },
    { name: '청바지', emoji: '👖', category: '의류', basePrice: 30000, currentPrice: ppiRaised ? 33000 : 30000 },
  ]

  const ppiItems = [
    { name: '수입 원유', emoji: '🛢️', category: '에너지 원자재', basePrice: 80, currentPrice: ppiRaised ? 120 : 80, unit: '달러' },
    { name: '제조업 원목', emoji: '🪵', category: '건축 원목재', basePrice: 150, currentPrice: ppiRaised ? 210 : 150, unit: '달러' },
    { name: '산업용 전력', emoji: '⚡', category: '생산용 에너지', basePrice: 120, currentPrice: ppiRaised ? 150 : 120, unit: '원/kWh' },
    { name: '금속 코일', emoji: '🔩', category: '금속 중간 원재료', basePrice: 500, currentPrice: ppiRaised ? 650 : 500, unit: '달러/톤' },
  ]

  useEffect(() => {
    onCompleteChange?.(hasOpenedPpi && (hideTransmission || hasToggledTransmission))
  }, [hasOpenedPpi, hasToggledTransmission, hideTransmission, onCompleteChange])

  return (
    <div className="hand-panel p-4 bg-white/60 space-y-4 text-ink border-2 border-ink rounded-xl shadow-sm max-w-md mx-auto">
      <div className="text-center space-y-1">
        <h4 className="font-display font-black text-lg">📊 가계의 CPI vs 기업의 PPI</h4>
        <p className="text-xs text-ink-soft">누가 소비하는가에 따라 달라지는 물가지수의 구성 품목을 확인해보세요.</p>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-2 gap-2 p-1 bg-ink/5 rounded-lg border border-ink/10">
        <button
          type="button"
          className={`py-1.5 text-xs font-bold rounded-md transition-all ${
            activeTab === 'cpi'
              ? 'bg-white border border-ink shadow-[1px_1px_0px_rgba(0,0,0,1)] text-ink'
              : 'text-ink-soft hover:text-ink'
          }`}
          onClick={() => setActiveTab('cpi')}
        >
          소비자 물가 장바구니 (CPI)
        </button>
        <button
          type="button"
          className={`py-1.5 text-xs font-bold rounded-md transition-all ${
            activeTab === 'ppi'
              ? 'bg-white border border-ink shadow-[1px_1px_0px_rgba(0,0,0,1)] text-ink'
              : 'text-ink-soft hover:text-ink'
          }`}
          onClick={() => {
            setHasOpenedPpi(true)
            setActiveTab('ppi')
          }}
        >
          생산자 물가 장바구니 (PPI)
        </button>
      </div>

      {/* Item Display Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {(activeTab === 'cpi' ? cpiItems : ppiItems).map((item) => (
          <div
            key={item.name}
            className="border border-ink/20 bg-paper rounded-lg p-2.5 flex items-center gap-2.5 text-left transition-colors"
          >
            <span className="text-2xl shrink-0" role="img" aria-label={item.name}>
              {item.emoji}
            </span>
            <div className="min-w-0">
              <p className="font-bold text-xs truncate text-ink">{item.name}</p>
              <span className="text-[10px] text-ink-soft bg-white border border-ink/10 px-1.5 py-0.2 rounded font-medium">
                {item.category}
              </span>
              <p className="basket-price-label font-mono font-bold text-ink mt-1">
                {'unit' in item 
                  ? `${item.currentPrice.toLocaleString()}${item.unit}` 
                  : `${item.currentPrice.toLocaleString()}원`}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Interactive Supply Chain Flow */}
      {!hideTransmission && (
        <div className="border-t-2 border-dashed border-ink/20 pt-3 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-ink-soft">원자재 가격(PPI) 변동 테스트:</span>
            <button
              type="button"
              className={`hand-button !min-h-[1.8rem] !py-0.5 !px-2.5 text-xs font-sans ${
                ppiRaised ? '!bg-bad text-white' : '!bg-yellow-soft text-ink'
              }`}
              onClick={() => {
                setHasToggledTransmission(true)
                setPpiRaised(!ppiRaised)
              }}
            >
              {ppiRaised ? '원자재 가격 복구하기' : '원자재 가격(PPI) 폭등시키기'}
            </button>
          </div>

          {/* Dynamic Transmission Flow Animation */}
          <div className="bg-paper border border-ink/10 rounded-lg p-3 space-y-3 relative overflow-hidden">
            <div className="flex justify-between items-center text-center text-[10px] font-bold">
              {/* Step 1 */}
              <div className={`flex-1 p-1 rounded transition-colors ${ppiRaised ? 'bg-bad-soft text-bad font-black' : 'text-ink-soft'}`}>
                <p className="text-lg">🛢️ → 🏭</p>
                <p className="mt-1">1단계: 수입 유가/에너지 상승 (PPI 폭등)</p>
              </div>
              
              {/* Arrow */}
              <span className={`px-1 text-xs transition-colors ${ppiRaised ? 'text-bad' : 'text-ink/20'}`}>▶</span>

              {/* Step 2 */}
              <div className={`flex-1 p-1 rounded transition-colors ${ppiRaised ? 'bg-yellow-soft text-ink font-black' : 'text-ink-soft'}`}>
                <p className="text-lg">🚚 → 🍜</p>
                <p className="mt-1">2단계: 물류비/제품 제조 단가 인상</p>
              </div>

              {/* Arrow */}
              <span className={`px-1 text-xs transition-colors ${ppiRaised ? 'text-bad' : 'text-ink/20'}`}>▶</span>

              {/* Step 3 */}
              <div className={`flex-1 p-1 rounded transition-colors ${ppiRaised ? 'bg-good-soft text-good font-black' : 'text-ink-soft'}`}>
                <p className="text-lg">🛒 → 💸</p>
                <p className="mt-1">3단계: 가계 소비재 물가 상승 (CPI 인동)</p>
              </div>
            </div>

            {ppiRaised && (
              <p className="text-[10px] text-center text-bad font-bold bg-white/80 p-1 border border-bad/20 rounded animate-pulse">
                💡 경고: 생산자 물가지수(PPI)가 상승하면 기업의 제조 부담이 가계로 전가되어 결국 소비자 물가지수(CPI)도 뒤따라 상승합니다!
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
