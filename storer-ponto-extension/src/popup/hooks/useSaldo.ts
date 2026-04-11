import { useEffect, useState } from 'react'
import { PontoService } from '../../services/PontoService'
import type { SaldoMes } from '../../types/ponto.types'

export const useSaldo = (): { saldo: SaldoMes | null; loading: boolean } => {
  const [saldo, setSaldo] = useState<SaldoMes | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const now = new Date()
    const mes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    void PontoService.getSaldo(mes)
      .then((result) => setSaldo(result))
      .finally(() => setLoading(false))
  }, [])

  return { saldo, loading }
}
