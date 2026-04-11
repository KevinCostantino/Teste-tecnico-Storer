import {
  TOKEN_REFRESH_ALARM_NAME,
  TOKEN_REFRESH_ALARM_PERIOD_MINUTES,
  TOKEN_REFRESH_BUFFER_MS,
} from '../constants/auth.constants'
import { AuthService } from '../services/AuthService'

export class TokenRefreshService {
  static start(): void {
    chrome.alarms.create(TOKEN_REFRESH_ALARM_NAME, {
      periodInMinutes: TOKEN_REFRESH_ALARM_PERIOD_MINUTES,
    })

    chrome.alarms.onAlarm.addListener((alarm: chrome.alarms.Alarm) => {
      if (alarm.name === TOKEN_REFRESH_ALARM_NAME) {
        void this.checkAndRefresh()
      }
    })
  }

  static async checkAndRefresh(): Promise<void> {
    const tokens = await AuthService.getTokens()

    if (!tokens) {
      return
    }

    const expiresIn = tokens.expiresAt - Date.now()
    if (expiresIn <= TOKEN_REFRESH_BUFFER_MS) {
      try {
        await AuthService.refreshTokens()
      } catch {
        await AuthService.clearTokens()
        await chrome.runtime.sendMessage({ type: 'AUTH_EXPIRED' })
      }
    }
  }
}
