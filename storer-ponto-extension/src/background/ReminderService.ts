import { StorageService } from '../services/StorageService'
import { PontoService } from '../services/PontoService'
import type { ExtensionConfig } from '../types/config.types'

const REMINDER_ALARM_PREFIX = 'REMINDER_'
const REMINDER_TICK_ALARM = 'REMINDER_TICK'
const FORCE_WEEKEND_REMINDERS = import.meta.env.VITE_ALLOW_WEEKEND_REMINDERS === 'true'

/** Dias uteis: 1=segunda ... 5=sexta */
function shouldRunToday(config: ExtensionConfig): boolean {
  if (FORCE_WEEKEND_REMINDERS || config.incluirFimDeSemanaNosLembretes) {
    return true
  }

  const day = new Date().getDay()
  return day >= 1 && day <= 5
}

function alarmNameForTime(time: string): string {
  return `${REMINDER_ALARM_PREFIX}${time.replace(':', '-')}`
}

function timeToMinutes(time: string): number {
  const [hh, mm] = time.split(':').map(Number)
  return (hh ?? 0) * 60 + (mm ?? 0)
}

function currentTimeHHmm(): string {
  const now = new Date()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export class ReminderService {
  private static lastReminderKey: string | null = null

  static start(): void {
    // Registrar os alarms com base nas configuracoes atuais
    void this.scheduleAlarms()

    chrome.alarms.onAlarm.addListener((alarm: chrome.alarms.Alarm) => {
      if (alarm.name === REMINDER_TICK_ALARM) {
        void this.handleReminderTick()
        return
      }

      if (alarm.name.startsWith(REMINDER_ALARM_PREFIX)) {
        void this.handleReminderAlarm(alarm.name)
      }
    })

    // Atualizar alarms sempre que as configuracoes mudarem
    if (chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'sync' && changes['extensionConfig']) {
          void this.scheduleAlarms()
        }
      })
    }

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === 'REMINDER_RESCHEDULE') {
        void this.scheduleAlarms()
          .then(() => sendResponse({ ok: true }))
          .catch((error: unknown) =>
            sendResponse({
              ok: false,
              error:
                error instanceof Error ? error.message : 'Falha ao reagendar lembretes.',
            }),
          )

        return true
      }

      if (message?.type === 'REMINDER_TEST') {
        void this.sendTestNotification()
          .then(() => sendResponse({ ok: true }))
          .catch((error: unknown) =>
            sendResponse({
              ok: false,
              error: error instanceof Error ? error.message : 'Falha ao enviar notificacao de teste.',
            }),
          )

        return true
      }

      return false
    })

    chrome.notifications.onClicked.addListener(() => {
      void this.openExtensionUi()
    })
  }

  static async scheduleAlarms(): Promise<void> {
    // Remover alarms antigos
    const all = await chrome.alarms.getAll()
    for (const alarm of all) {
      if (alarm.name.startsWith(REMINDER_ALARM_PREFIX)) {
        await chrome.alarms.clear(alarm.name)
      }
    }

    const config = await StorageService.getConfig()
    if (!config.notificacoesHabilitadas) {
      return
    }

    for (const time of config.lembretes) {
      const [hh, mm] = time.split(':').map(Number)
      if (hh === undefined || mm === undefined) continue

      // Agendar o proximo disparo no horario absoluto configurado.
      const now = new Date()
      const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 59, 0)
      if (target.getTime() <= now.getTime()) {
        // Ja passou hoje, agendar para amanha
        target.setDate(target.getDate() + 1)
      }

      chrome.alarms.create(alarmNameForTime(time), {
        when: target.getTime(),
        periodInMinutes: 24 * 60, // repete diariamente
      })
    }

    // Fallback robusto: verifica lembretes no minuto corrente continuamente.
    chrome.alarms.create(REMINDER_TICK_ALARM, {
      delayInMinutes: 1,
      periodInMinutes: 1,
    })
  }

  private static async handleReminderTick(): Promise<void> {
    const config = await StorageService.getConfig()
    if (!shouldRunToday(config)) {
      return
    }

    if (!config.notificacoesHabilitadas) {
      return
    }

    const nowHHmm = currentTimeHHmm()
    if (!config.lembretes.includes(nowHHmm)) {
      return
    }

    await this.handleReminderAlarm(alarmNameForTime(nowHHmm))
  }

  private static async handleReminderAlarm(alarmName: string): Promise<void> {
    const config = await StorageService.getConfig()
    if (!shouldRunToday(config)) {
      return
    }

    if (!config.notificacoesHabilitadas) {
      return
    }

    // Determinar o horario deste alarm
    const timePart = alarmName.slice(REMINDER_ALARM_PREFIX.length).replace('-', ':')
    const dayKey = new Date().toISOString().slice(0, 10)
    const reminderKey = `${dayKey}-${timePart}`
    if (this.lastReminderKey === reminderKey) {
      return
    }

    const alarmMinutes = timeToMinutes(timePart)

    // Verificar se existe batida proxima (15 min de margem)
    let batidasCheckFailed = false
    let batidas: { timestamp: string }[] = []
    try {
      batidas = await PontoService.getBatidasDia()
    } catch {
      batidasCheckFailed = true
    }

    const hasNearbyBatida = batidas.some((b) => {
      const t = new Date(b.timestamp)
      const bMinutes = t.getHours() * 60 + t.getMinutes()
      return Math.abs(bMinutes - alarmMinutes) <= 15
    })

    if (!hasNearbyBatida) {
      const hour = timePart
      const message = batidasCheckFailed
        ? `Horario de lembrete ${hour}. Nao foi possivel validar batidas agora.`
        : `Voce ainda nao registrou seu ponto proximo das ${hour}. Clique para abrir a extensao.`

      await chrome.notifications.create(`reminder-${alarmName}-${Date.now()}`, {
        type: 'basic',
        iconUrl: chrome.runtime.getURL('icon-48.png'),
        title: 'Lembrete de ponto',
        message,
      })

      this.lastReminderKey = reminderKey
    }
  }

  private static async sendTestNotification(): Promise<void> {
    await chrome.notifications.create(`reminder-test-${Date.now()}`, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icon-48.png'),
      title: 'Teste de notificacao',
      message: 'Se voce esta vendo este alerta, as notificacoes da extensao estao funcionando.',
    })
  }

  private static async openExtensionUi(): Promise<void> {
    try {
      await chrome.action.openPopup()
      return
    } catch {
      // Fallback for browsers/policies that block programmatic popup open.
    }

    try {
      await chrome.tabs.create({ url: chrome.runtime.getURL('src/popup/index.html') })
    } catch {
      // No-op: clicking the extension icon is still available to the user.
    }
  }
}

