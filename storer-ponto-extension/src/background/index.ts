import { OfflineQueueService } from './OfflineQueueService'
import { ReminderService } from './ReminderService'
import { TokenRefreshService } from './TokenRefreshService'

const bootstrap = (): void => {
  TokenRefreshService.start()
  OfflineQueueService.start()
  ReminderService.start()
}

bootstrap()
