import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { BatidasList } from '../../src/popup/components/BatidasList'

describe('BatidasList', () => {
  it('exibe skeleton loading quando carregando', () => {
    render(<BatidasList batidas={[]} loading={true} onRefresh={async () => undefined} />)
    expect(screen.getByRole('region', { name: 'Carregando batidas' })).toBeInTheDocument()
  })

  it('deve mostrar mensagem de vazio e permitir refresh', async () => {
    const user = userEvent.setup()
    const onRefresh = vi.fn(async () => undefined)

    render(<BatidasList batidas={[]} loading={false} onRefresh={onRefresh} />)

    expect(screen.getByText('Nenhuma batida registrada hoje.')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Atualizar' }))
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('deve renderizar lista de batidas quando houver itens', () => {
    render(
      <BatidasList
        batidas={[
          {
            id: '1',
            timestamp: '2026-04-11T08:00:00.000Z',
            tipo: 'ENTRADA',
            sincronizado: true,
          },
        ]}
        loading={false}
        onRefresh={async () => undefined}
      />, 
    )

    expect(screen.getByText('ENTRADA')).toBeInTheDocument()
  })
})
