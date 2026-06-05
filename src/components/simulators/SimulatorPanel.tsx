import type { LessonSimulator } from '../../types'
import { CurrencyValueSimulator } from './CurrencyValueSimulator'
import { InterestRateSimulator } from './InterestRateSimulator'
import { PriceBasketSimulator } from './PriceBasketSimulator'
import { Base100Simulator } from './Base100Simulator'
import { BasketPurposeToggle } from './BasketPurposeToggle'

export function SimulatorPanel({
  simulator,
  beatId,
  onCompleteChange,
}: {
  simulator: LessonSimulator
  beatId?: string
  onCompleteChange?: (complete: boolean) => void
}) {
  if (simulator.type === 'interest-rate') {
    return <InterestRateSimulator onCompleteChange={onCompleteChange} />
  }

  if (simulator.type === 'currency-value') {
    return <CurrencyValueSimulator onCompleteChange={onCompleteChange} />
  }

  if (simulator.type === 'price-basket') {
    return <PriceBasketSimulator onCompleteChange={onCompleteChange} />
  }

  if (simulator.type === 'price-index-base') {
    return <Base100Simulator onCompleteChange={onCompleteChange} />
  }

  if (simulator.type === 'basket-cpi-ppi') {
    return <BasketPurposeToggle hideTransmission={beatId === 's0-b6'} onCompleteChange={onCompleteChange} />
  }

  return null
}
