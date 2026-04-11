import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { BaterPontoButton } from '../../src/popup/components/BaterPontoButton'

describe('BaterPontoButton', () => {
  it('deve disparar clique quando habilitado', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn(async () => undefined)

    render(<BaterPontoButton loading={false} onClick={onClick} />)

    await user.click(screen.getByRole('button', { name: 'Bater Ponto' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('deve ficar desabilitado em estado de loading', () => {
    const onClick = vi.fn(async () => undefined)

    render(<BaterPontoButton loading={true} onClick={onClick} />)

    expect(screen.getByRole('button', { name: 'Registrando...' })).toBeDisabled()
  })
})
