import { HttpClient, HttpRequestError } from '../services/HttpClient'
import { StorageService } from '../services/StorageService'
import type { RegistrarBatidaRequest } from '../types/ponto.types'

interface OfflineBatidaEntry {
  id: string
  payload: RegistrarBatidaRequest
  createdAt: number
}

const OFFLINE_QUEUE_KEY = 'offlineQueue'
const LAST_SYNC_KEY = 'lastSyncAt'
const OFFLINE_QUEUE_ALARM = 'OFFLINE_QUEUE_SYNC'
const OFFLINE_QUEUE_COUNT_CHANGED = 'OFFLINE_QUEUE_COUNT_CHANGED'

export class OfflineQueueService {
  static start(): void {
    chrome.alarms.create(OFFLINE_QUEUE_ALARM, { periodInMinutes: 1 })

    chrome.alarms.onAlarm.addListener((alarm: chrome.alarms.Alarm) => {
      if (alarm.name === OFFLINE_QUEUE_ALARM) {
        void this.processQueue()
      }
    })

    chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
      const msg = (message as { payload?: RegistrarBatidaRequest; type?: string } | undefined)

      if (msg?.type === 'GET_OFFLINE_QUEUE_COUNT') {
        void (async () => {
          const queue = await this.getQueue()
          const lastSyncAt = await this.getLastSyncAt()
          sendResponse({ count: queue.length, lastSyncAt })
        })()

        return true
      }

      if (msg?.type === 'FORCE_SYNC') {
        void (async () => {
          await this.processQueue()
          const queue = await this.getQueue()
          const lastSyncAt = await this.getLastSyncAt()
          sendResponse({ count: queue.length, lastSyncAt })
        })()

        return true
      }

      if (msg?.type !== 'QUEUE_BATIDA' || !msg.payload) {
        return false
      }

      void (async () => {
        await this.enqueue(msg.payload)
        await this.processQueue()
        sendResponse({ ok: true })
      })()

      return true
    })
  }

  static async enqueue(payload: RegistrarBatidaRequest): Promise<void> {
    const queue = await this.getQueue()
    queue.push({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      payload,
      createdAt: Date.now(),
    })

    await this.saveQueue(queue)
    await this.notifyQueueCountChanged(queue.length)
  }

  static async processQueue(): Promise<void> {
    if (!navigator.onLine) {
      return
    }

    const queue = await this.getQueue()
    if (!queue.length) {
      return
    }

    const config = await StorageService.getConfig()
    const client = new HttpClient({ baseUrl: config.apiBaseUrl })
    const remaining: OfflineBatidaEntry[] = []
    let syncedCount = 0

    for (const item of queue) {
      try {
        await client.request('POST', '/v1/ponto/batidas', item.payload)
        syncedCount += 1
      } catch (error) {
        if (error instanceof HttpRequestError && (error.type === 'network' || error.type === 'timeout')) {
          remaining.push(item)
          continue
        }

        // Em erros de regra de negocio ou payload invalido, descarta item para evitar loop infinito.
      }
    }

    await this.saveQueue(remaining)
    await this.notifyQueueCountChanged(remaining.length)

    if (syncedCount > 0) {
      await chrome.storage.local.set({ [LAST_SYNC_KEY]: Date.now() })
    }

    if (syncedCount > 0 && config.notificacoesHabilitadas) {
      await chrome.notifications.create(`offline-sync-${Date.now()}`, {
        type: 'basic',
        iconUrl: 'icons/icon-48.png',
        title: 'Sincronizacao concluida',
        message:
          syncedCount === 1
            ? '1 batida offline foi sincronizada com sucesso.'
            : `${syncedCount} batidas offline foram sincronizadas com sucesso.`,
      })
    }
  }

  private static async notifyQueueCountChanged(count: number): Promise<void> {
    try {
      await chrome.runtime.sendMessage({
        type: OFFLINE_QUEUE_COUNT_CHANGED,
        count,
      })
    } catch {
      // Pode nao haver listener ativo; ignorar.
    }
  }

  private static async getQueue(): Promise<OfflineBatidaEntry[]> {
    const result = await chrome.storage.local.get(OFFLINE_QUEUE_KEY)
    const queue = result[OFFLINE_QUEUE_KEY] as OfflineBatidaEntry[] | undefined
    return queue ?? []
  }

  private static async saveQueue(queue: OfflineBatidaEntry[]): Promise<void> {
    await chrome.storage.local.set({ [OFFLINE_QUEUE_KEY]: queue })
  }

  private static async getLastSyncAt(): Promise<number | null> {
    const result = await chrome.storage.local.get(LAST_SYNC_KEY)
    return (result[LAST_SYNC_KEY] as number | undefined) ?? null
  }
}
