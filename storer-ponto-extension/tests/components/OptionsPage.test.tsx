import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { OptionsPage } from '../../src/options/components/OptionsPage'

const mockGetConfig = vi.fn()
const mockSaveConfig = vi.fn(async () => undefined)

vi.mock('../../src/services/StorageService', () => ({
  StorageService: {
    getConfig: () => mockGetConfig(),
    saveConfig: (config: unknown) => mockSaveConfig(config),
  },
}))

describe('OptionsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mockGetConfig.mockReset()
    mockSaveConfig.mockReset()

    mockGetConfig.mockResolvedValue({
      apiBaseUrl: 'https://ponto-api-dev.storer.com.br',
      lembretes: ['08:00', '12:00'],
      geolocalizacaoHabilitada: false,
      notificacoesHabilitadas: true,
      incluirFimDeSemanaNosLembretes: false,
    })
  })

  it('carrega configuracoes e salva com URL valida', async () => {
    const user = userEvent.setup()

    render(<OptionsPage />)

    await screen.findByDisplayValue('https://ponto-api-dev.storer.com.br')

    const input = screen.getByLabelText('URL da API')
    await user.clear(input)
    await user.type(input, 'https://ponto-api.storer.com.br')

    await user.click(screen.getByRole('button', { name: 'Salvar configuracoes' }))

    await waitFor(() => {
      expect(mockSaveConfig).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByText('✓ Configuracoes salvas com sucesso.')).toBeInTheDocument()
  })

  it('nao salva quando URL da API eh invalida', async () => {
    const user = userEvent.setup()

    render(<OptionsPage />)

    const input = await screen.findByLabelText('URL da API')
    await user.clear(input)
    await user.type(input, 'url-invalida')

    await user.click(screen.getByRole('button', { name: 'Salvar configuracoes' }))

    expect(mockSaveConfig).not.toHaveBeenCalled()
    expect(screen.getByText('Informe uma URL valida para a API (http:// ou https://).')).toBeInTheDocument()
  })

  it('restaura configuracoes para os padroes ao confirmar', async () => {
    const user = userEvent.setup()
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<OptionsPage />)

    await screen.findByDisplayValue('https://ponto-api-dev.storer.com.br')

    await user.click(screen.getByRole('button', { name: 'Restaurar padroes' }))

    await waitFor(() => {
      expect(screen.getByDisplayValue('https://ponto-api-dev.storer.com.br')).toBeInTheDocument()
    })
  })

  it('permite adicionar lembretes ate o limite de 4 e remover mantendo minimo 1', async () => {
    const user = userEvent.setup()

    render(<OptionsPage />)

    await screen.findByDisplayValue('08:00')

    await user.click(screen.getByRole('button', { name: 'Adicionar lembrete' }))
    await user.click(screen.getByRole('button', { name: 'Adicionar lembrete' }))

    const allTimeInputsAfterAdd = screen.getAllByDisplayValue(/\d{2}:\d{2}/)
    expect(allTimeInputsAfterAdd.length).toBe(4)

    const addButton = screen.getByRole('button', { name: 'Adicionar lembrete' })
    expect(addButton).toBeDisabled()

    await user.click(screen.getAllByRole('button', { name: 'Remover' })[0])
    await user.click(screen.getAllByRole('button', { name: 'Remover' })[0])
    await user.click(screen.getAllByRole('button', { name: 'Remover' })[0])

    const allTimeInputsAfterRemove = screen.getAllByDisplayValue(/\d{2}:\d{2}/)
    expect(allTimeInputsAfterRemove.length).toBe(1)

    expect(screen.getByRole('button', { name: 'Remover' })).toBeDisabled()
  })
})

