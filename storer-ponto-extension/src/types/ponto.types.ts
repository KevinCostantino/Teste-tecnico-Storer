export type TipoBatida = 'ENTRADA' | 'INTERVALO' | 'RETORNO' | 'SAIDA'

export interface Batida {
  id: string
  timestamp: string
  tipo: TipoBatida
  geolocation?: {
    latitude: number
    longitude: number
  }
  sincronizado: boolean
}

export interface RegistrarBatidaRequest {
  timestamp: string
  geolocation?: {
    latitude: number
    longitude: number
  }
}

export interface RegistrarBatidaResponse {
  id: string
  timestamp: string
  tipo: TipoBatida
}

export interface RegistrarBatidaQueuedResponse {
  queued: true
  timestamp: string
}

export type RegistrarBatidaResult = RegistrarBatidaResponse | RegistrarBatidaQueuedResponse

export interface SaldoMes {
  mesAno: string
  saldoMinutos: number
  horasTrabalhadas: number
  horasPrevistas: number
}
