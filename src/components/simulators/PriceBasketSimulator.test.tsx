import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PriceBasketSimulator } from './PriceBasketSimulator'

describe('PriceBasketSimulator', () => {
  it('reports completion after any price control is used', async () => {
    const onCompleteChange = vi.fn()
    render(<PriceBasketSimulator onCompleteChange={onCompleteChange} />)

    const increaseButtons = screen.getAllByRole('button', { name: '+' })

    await waitFor(() => {
      expect(onCompleteChange).toHaveBeenLastCalledWith(false)
    })

    fireEvent.click(increaseButtons[0])

    await waitFor(() => {
      expect(onCompleteChange).toHaveBeenLastCalledWith(true)
    })
  })
})
