import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { MainScreen } from '../../src/popup/components/MainScreen'

const mockGetTokens = vi.fn()
const mockLogout = vi.fn(async () => undefined)
const mockRegistrarBatida = vi.fn()
const mockGetBatidasDia = vi.fn()
const mockGetSaldo = vi.fn()
const mockGetConfig = vi.fn()

vi.mock('../../src/services/AuthService', () => ({
  AuthService: {
    getTokens: () => mockGetTokens(),
    logout: () => mockLogout(),
  },
}))

vi.mock('../../src/services/PontoService', () => ({
  PontoService: {
    registrarBatida: () => mockRegistrarBatida(),
    getBatidasDia: () => mockGetBatidasDia(),
    getSaldo: () => mockGetSaldo(),
  },
}))

vi.mock('../../src/services/StorageService', () => ({
  StorageService: {
    getConfig: () => mockGetConfig(),
  },
}))

describe('MainScreen', () => {
  beforeEach(() => {
    mockGetTokens.mockResolvedValue({ userDisplayName: 'Dev Storer' })
    mockGetBatidasDia.mockResolvedValue([])
    mockGetSaldo.mockResolvedValue(null)
    mockGetConfig.mockResolvedValue({
      apiBaseUrl: 'https://ponto-api-dev.storer.com.br',
      lembretes: ['08:00'],
      geolocalizacaoHabilitada: false,
      notificacoesHabilitadas: true,
      incluirFimDeSemanaNosLembretes: false,
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    mockGetTokens.mockReset()
    mockLogout.mockReset()
    mockRegistrarBatida.mockReset()
    mockGetBatidasDia.mockReset()
    mockGetSaldo.mockReset()
    mockGetConfig.mockReset()
  })

  it('registra ponto com sucesso e mostra toast', async () => {
    const user = userEvent.setup()

    mockRegistrarBatida.mockResolvedValue({
      id: 'b1',
      timestamp: '2026-04-11T08:02:00.000Z',
      tipo: 'ENTRADA',
    })

    render(<MainScreen />)

    await screen.findByText('Nenhuma batida registrada hoje.')

    await user.click(screen.getByRole('button', { name: 'Bater Ponto' }))

    await waitFor(() => {
      expect(screen.getByText(/Ponto registrado!/)).toBeInTheDocument()
    })
  })

  it('mostra erro e permite tentar novamente', async () => {
    const user = userEvent.setup()

    mockRegistrarBatida
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({
        id: 'b2',
        timestamp: '2026-04-11T13:00:00.000Z',
        tipo: 'RETORNO',
      })

    render(<MainScreen />)

    await screen.findByText('Nenhuma batida registrada hoje.')

    await user.click(screen.getByRole('button', { name: 'Bater Ponto' }))

    await waitFor(() => {
      expect(screen.getByText('Falha ao registrar. Verifique sua conexao.')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Tentar novamente' }))

    await waitFor(() => {
      expect(screen.queryByText('Falha ao registrar. Verifique sua conexao.')).not.toBeInTheDocument()
    })

    expect(mockRegistrarBatida).toHaveBeenCalledTimes(2)
  })

  it('permite atualizar batidas manualmente', async () => {
    const user = userEvent.setup()

    render(<MainScreen />)

    await waitFor(() => {
      expect(screen.getByText('Nenhuma batida registrada hoje.')).toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Atualizar' }))

    await waitFor(() => {
      expect(mockGetBatidasDia).toHaveBeenCalledTimes(2)
    })
  })
})
