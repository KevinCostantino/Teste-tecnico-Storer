import { useEffect, useState } from 'react'
import type { ExtensionConfig } from '../../types/config.types'
import { StorageService } from '../../services/StorageService'
import { TimePickerInput } from './TimePickerInput'

const DEFAULT_CONFIG: ExtensionConfig = {
  apiBaseUrl: 'https://ponto-api-dev.storer.com.br',
  lembretes: ['08:00', '12:00', '13:30', '18:00'],
  geolocalizacaoHabilitada: false,
  notificacoesHabilitadas: true,
  incluirFimDeSemanaNosLembretes: false,
}

const emptyConfig: ExtensionConfig = {
  apiBaseUrl: '',
  lembretes: ['08:00'],
  geolocalizacaoHabilitada: false,
  notificacoesHabilitadas: true,
  incluirFimDeSemanaNosLembretes: false,
}

const isValidApiBaseUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export const OptionsPage = (): JSX.Element => {
  const [config, setConfig] = useState<ExtensionConfig>(emptyConfig)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testingNotification, setTestingNotification] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    void StorageService.getConfig().then((result) => setConfig(result))
  }, [])

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCurrentTime(new Date())
    }, 30_000)

    return () => window.clearInterval(intervalId)
  }, [])

  const save = async (): Promise<void> => {
    setError(null)

    if (!isValidApiBaseUrl(config.apiBaseUrl)) {
      setSaved(false)
      setError('Informe uma URL valida para a API (http:// ou https://).')
      return
    }

    const normalized = {
      ...config,
      lembretes: config.lembretes.slice(0, 4),
    }

    if (normalized.lembretes.length === 0) {
      normalized.lembretes = ['08:00']
    }

    await StorageService.saveConfig(normalized)
    setConfig(normalized)

    try {
      await chrome.runtime.sendMessage({ type: 'REMINDER_RESCHEDULE' })
    } catch {
      // O listener de storage.onChanged no background ainda cobre este fluxo.
    }

    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const addReminder = (): void => {
    if (config.lembretes.length >= 4) {
      return
    }

    setConfig({ ...config, lembretes: [...config.lembretes, '18:00'] })
  }

  const removeReminder = (index: number): void => {
    if (config.lembretes.length <= 1) {
      return
    }

    const clone = config.lembretes.filter((_, currentIndex) => currentIndex !== index)
    setConfig({ ...config, lembretes: clone })
  }

  const testNotification = async (): Promise<void> => {
    setError(null)
    setTestingNotification(true)

    try {
      const response = await chrome.runtime.sendMessage({ type: 'REMINDER_TEST' })
      if (!response?.ok) {
        throw new Error(response?.error ?? 'Falha ao enviar notificacao de teste.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar notificacao de teste.')
    } finally {
      setTestingNotification(false)
    }
  }

  return (
    <main
      style={{
        maxWidth: 720,
        margin: '24px auto',
        fontFamily: 'Segoe UI, sans-serif',
        background: '#0b0b0d',
        color: '#f7f9fc',
        border: '1px solid #1d2129',
        borderRadius: 14,
        padding: 18,
      }}
    >
      <h1 style={{ marginTop: 0, marginBottom: 6 }}>Configuracoes da Extensao</h1>
      <p style={{ marginTop: 4, marginBottom: 16, color: '#75a8ff' }}>
        Horario atual: {currentTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </p>

      <label htmlFor="apiBaseUrl">URL da API</label>
      <input
        id="apiBaseUrl"
        value={config.apiBaseUrl}
        onChange={(event) => setConfig({ ...config, apiBaseUrl: event.target.value })}
        style={{
          width: '100%',
          marginBottom: 16,
          marginTop: 6,
          background: '#12151b',
          color: '#f7f9fc',
          border: '1px solid #2b3443',
          borderRadius: 8,
          padding: '10px 12px',
          boxSizing: 'border-box',
        }}
      />

      <h2>Lembretes</h2>
      {config.lembretes.map((time, index) => (
        <div
          key={`${time}-${index}`}
          style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}
        >
          <TimePickerInput
            value={time}
            onChange={(value) => {
              const clone = [...config.lembretes]
              clone[index] = value
              setConfig({ ...config, lembretes: clone })
            }}
          />
          <button
            disabled={config.lembretes.length <= 1}
            onClick={() => removeReminder(index)}
            type="button"
            style={{
              borderRadius: 8,
              border: '1px solid #2b3443',
              background: '#12151b',
              color: '#f7f9fc',
              padding: '8px 10px',
              cursor: 'pointer',
            }}
          >
            Remover
          </button>
        </div>
      ))}

      <button
        disabled={config.lembretes.length >= 4}
        onClick={addReminder}
        type="button"
        style={{
          borderRadius: 8,
          border: '1px solid #2b3443',
          background: '#12151b',
          color: '#f7f9fc',
          padding: '8px 12px',
          cursor: 'pointer',
        }}
      >
        Adicionar lembrete
      </button>

      <div style={{ marginTop: 12 }}>
        <label>
          <input
            type="checkbox"
            checked={config.geolocalizacaoHabilitada}
            onChange={(event) =>
              setConfig({ ...config, geolocalizacaoHabilitada: event.target.checked })
            }
          />
          Enviar geolocalizacao nas batidas
        </label>
      </div>

      <div style={{ marginTop: 12 }}>
        <label>
          <input
            type="checkbox"
            checked={config.notificacoesHabilitadas}
            onChange={(event) =>
              setConfig({ ...config, notificacoesHabilitadas: event.target.checked })
            }
          />
          Habilitar notificacoes de lembrete
        </label>
      </div>

      <div style={{ marginTop: 12 }}>
        <label>
          <input
            type="checkbox"
            checked={config.incluirFimDeSemanaNosLembretes}
            onChange={(event) =>
              setConfig({ ...config, incluirFimDeSemanaNosLembretes: event.target.checked })
            }
          />
          Incluir lembretes no fim de semana
        </label>
      </div>

      <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          onClick={() => void save()}
          style={{
            borderRadius: 8,
            border: '1px solid #1b5fc6',
            background: '#0c55c7',
            color: '#ffffff',
            padding: '10px 14px',
            cursor: 'pointer',
            fontWeight: 700,
          }}
        >
          Salvar configuracoes
        </button>
        <button
          type="button"
          onClick={() => void testNotification()}
          disabled={testingNotification}
          style={{
            borderRadius: 8,
            border: '1px solid #2b3443',
            background: '#12151b',
            color: '#f7f9fc',
            padding: '10px 14px',
            cursor: 'pointer',
          }}
        >
          {testingNotification ? 'Enviando teste...' : 'Testar notificacao agora'}
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Restaurar todas as configuracoes para os valores padrao?')) {
              setConfig(DEFAULT_CONFIG)
              setSaved(false)
              setError(null)
            }
          }}
          style={{
            background: 'transparent',
            border: '1px solid #2b3443',
            borderRadius: 8,
            padding: '10px 14px',
            cursor: 'pointer',
            color: '#75a8ff',
          }}
        >
          Restaurar padroes
        </button>
      </div>

      {saved ? (
        <p style={{ color: '#72f2a4', marginTop: 8 }}>✓ Configuracoes salvas com sucesso.</p>
      ) : null}
      {error ? <p style={{ color: '#ff8c8c' }}>{error}</p> : null}
    </main>
  )
}
