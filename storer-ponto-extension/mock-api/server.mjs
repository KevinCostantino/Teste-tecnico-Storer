/**
 * Mock API — ponto-web-api
 * Substitui o backend real para fins de demonstração e desenvolvimento.
 *
 * Endpoints:
 *   POST /v1/ponto/batidas       → registra batida (sequência: ENTRADA, INTERVALO, RETORNO, SAIDA)
 *   GET  /v1/ponto/batidas?data= → lista batidas do dia
 *   GET  /v1/ponto/saldo?mes=    → retorna saldo mensal mock
 *
 * Uso:
 *   node mock-api/server.mjs
 */

import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'

const PORT = 3001
const TIPOS = ['ENTRADA', 'INTERVALO', 'RETORNO', 'SAIDA']

/** @type {Array<{id: string, timestamp: string, tipo: string, sincronizado: boolean}>} */
const batidas = []

const setCors = (res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

const json = (res, status, data) => {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

const readBody = (req) =>
  new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => resolve(body))
  })

const server = createServer(async (req, res) => {
  setCors(res)

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  const url = new URL(req.url, `http://localhost:${PORT}`)

  // POST /v1/ponto/batidas
  if (req.method === 'POST' && url.pathname === '/v1/ponto/batidas') {
    const body = await readBody(req)
    const data = JSON.parse(body || '{}')
    const hoje = new Date().toISOString().split('T')[0]
    const batidasHoje = batidas.filter((b) => b.timestamp.startsWith(hoje))
    const tipo = TIPOS[Math.min(batidasHoje.length, 3)]
    const batida = {
      id: randomUUID(),
      timestamp: data.timestamp || new Date().toISOString(),
      tipo,
      sincronizado: true,
    }
    batidas.push(batida)
    console.log(`[POST] Batida registrada: ${tipo} às ${batida.timestamp}`)
    json(res, 201, batida)
    return
  }

  // GET /v1/ponto/batidas?data=YYYY-MM-DD
  if (req.method === 'GET' && url.pathname === '/v1/ponto/batidas') {
    const data = url.searchParams.get('data') || new Date().toISOString().split('T')[0]
    const result = batidas.filter((b) => b.timestamp.startsWith(data))
    console.log(`[GET] Batidas do dia ${data}: ${result.length} registros`)
    json(res, 200, result)
    return
  }

  // GET /v1/ponto/saldo?mes=YYYY-MM
  if (req.method === 'GET' && url.pathname === '/v1/ponto/saldo') {
    const mes = url.searchParams.get('mes') || new Date().toISOString().slice(0, 7)
    const batidasMes = batidas.filter((b) => b.timestamp.startsWith(mes))
    const horasTrabalhadas = Math.round((batidasMes.length / 2) * 8)
    json(res, 200, {
      mesAno: mes,
      saldoMinutos: (horasTrabalhadas - 160) * 60,
      horasTrabalhadas,
      horasPrevistas: 160,
    })
    return
  }

  res.writeHead(404)
  res.end()
})

server.listen(PORT, () => {
  console.log(`\nMock API rodando em http://localhost:${PORT}`)
  console.log('Endpoints disponíveis:')
  console.log('  POST http://localhost:' + PORT + '/v1/ponto/batidas')
  console.log('  GET  http://localhost:' + PORT + '/v1/ponto/batidas?data=YYYY-MM-DD')
  console.log('  GET  http://localhost:' + PORT + '/v1/ponto/saldo?mes=YYYY-MM\n')
})
