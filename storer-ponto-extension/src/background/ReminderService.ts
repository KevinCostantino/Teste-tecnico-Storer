import { StorageService } from '../services/StorageService'
import { PontoService } from '../services/PontoService'

const REMINDER_ALARM_PREFIX = 'REMINDER_'

/** Dias uteis: 1=segunda ... 5=sexta */
function isWeekday(): boolean {
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

export class ReminderService {
  static start(): void {
    // Registrar os alarms com base nas configuracoes atuais
    void this.scheduleAlarms()

    chrome.alarms.onAlarm.addListener((alarm: chrome.alarms.Alarm) => {
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

      // Calcular millisegundos ate o proximo disparo desse horario
      const now = new Date()
      const target = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm, 0, 0)
      if (target.getTime() <= now.getTime()) {
        // Ja passou hoje, agendar para amanha
        target.setDate(target.getDate() + 1)
      }

      const delayMinutes = (target.getTime() - now.getTime()) / 60_000

      chrome.alarms.create(alarmNameForTime(time), {
        delayInMinutes: delayMinutes,
        periodInMinutes: 24 * 60, // repete diariamente
      })
    }
  }

  private static async handleReminderAlarm(alarmName: string): Promise<void> {
    if (!isWeekday()) {
      return
    }

    const config = await StorageService.getConfig()
    if (!config.notificacoesHabilitadas) {
      return
    }

    // Determinar o horario deste alarm
    const timePart = alarmName.slice(REMINDER_ALARM_PREFIX.length).replace('-', ':')
    const alarmMinutes = timeToMinutes(timePart)

    // Verificar se existe batida proxima (15 min de margem)
    let batidas: { timestamp: string }[] = []
    try {
      batidas = await PontoService.getBatidasDia()
    } catch {
      return // Se nao conseguir verificar, nao notifica (evita falso positivo)
    }

    const hasNearbyBatida = batidas.some((b) => {
      const t = new Date(b.timestamp)
      const bMinutes = t.getHours() * 60 + t.getMinutes()
      return Math.abs(bMinutes - alarmMinutes) <= 15
    })

    if (!hasNearbyBatida) {
      const hour = timePart
      await chrome.notifications.create(`reminder-${alarmName}-${Date.now()}`, {
        type: 'basic',
        iconUrl: 'icons/icon-48.png',
        title: 'Lembrete de ponto',
        message: `Voce ainda nao registrou seu ponto proximo das ${hour}. Clique para abrir a extensao.`,
      })
    }
  }
}

