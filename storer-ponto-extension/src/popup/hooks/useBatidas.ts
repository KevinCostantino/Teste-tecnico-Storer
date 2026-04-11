import { useEffect, useState } from 'react'
import { PontoService } from '../../services/PontoService'
import type { Batida } from '../../types/ponto.types'

export const useBatidas = (): { batidas: Batida[]; loading: boolean } => {
  const [batidas, setBatidas] = useState<Batida[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void PontoService.getBatidasDia()
      .then((result) => setBatidas(result))
      .finally(() => setLoading(false))
  }, [])

  return { batidas, loading }
}
