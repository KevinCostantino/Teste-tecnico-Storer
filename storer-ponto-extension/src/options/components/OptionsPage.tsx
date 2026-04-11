import { useEffect, useState } from 'react'
import type { ExtensionConfig } from '../../types/config.types'
import { StorageService } from '../../services/StorageService'
import { DEFAULT_API_BASE_URL } from '../../constants/api.constants'
import { TimePickerInput } from './TimePickerInput'

const DEFAULT_CONFIG: ExtensionConfig = {
  apiBaseUrl: DEFAULT_API_BASE_URL,
  lembretes: ['08:00', '12:00', '13:30', '18:00'],
  geolocalizacaoHabilitada: false,
  notificacoesHabilitadas: true,
}

const emptyConfig: ExtensionConfig = {
  apiBaseUrl: '',
  lembretes: ['08:00'],
  geolocalizacaoHabilitada: false,
  notificacoesHabilitadas: true,
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

  useEffect(() => {
    void StorageService.getConfig().then((result) => setConfig(result))
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

  return (
    <main style={{ maxWidth: 720, margin: '24px auto', fontFamily: 'Segoe UI, sans-serif' }}>
      <h1>Configuracoes da Extensao</h1>

      <label htmlFor="apiBaseUrl">URL da API</label>
      <input
        id="apiBaseUrl"
        value={config.apiBaseUrl}
        onChange={(event) => setConfig({ ...config, apiBaseUrl: event.target.value })}
        style={{ width: '100%', marginBottom: 16 }}
      />

      <h2>Lembretes</h2>
      {config.lembretes.map((time, index) => (
        <div key={`${time}-${index}`} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
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
          >
            Remover
          </button>
        </div>
      ))}

      <button disabled={config.lembretes.length >= 4} onClick={addReminder} type="button">
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

      <div style={{ marginTop: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={() => void save()}>Salvar configuracoes</button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Restaurar todas as configuracoes para os valores padrao?')) {
              setConfig(DEFAULT_CONFIG)
              setSaved(false)
              setError(null)
            }
          }}
          style={{ background: 'transparent', border: '1px solid #c0d3e8', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', color: '#38506b' }}
        >
          Restaurar padroes
        </button>
      </div>

      {saved ? (
        <p style={{ color: '#16653c', marginTop: 8 }}>✓ Configuracoes salvas com sucesso.</p>
      ) : null}
      {error ? <p style={{ color: '#8d2a22' }}>{error}</p> : null}
    </main>
  )
}
