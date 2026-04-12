# Storer Ponto Extension

Extensao Chrome/Edge (Manifest V3) para registro de ponto da Storer Sistemas.

Stack: TypeScript, React 18, Vite, Vitest.

## Requisitos

- Node.js 20+
- NPM 10+
- Google Chrome (ou Edge Chromium)

## Setup

```bash
npm install
```

## Configuracao de ambiente

Arquivo local: `.env.local`

Exemplo para desenvolvimento com API mock local:

```bash
VITE_ZITADEL_DOMAIN=auth-dev.storer.com.br
VITE_ZITADEL_CLIENT_ID=storer-ponto-extension-dev@StorerProject
VITE_API_BASE_URL=http://localhost:3001
VITE_ENV=development
VITE_MOCK_AUTH=true
```

Campos:

- `VITE_ZITADEL_DOMAIN`: dominio do IdP Zitadel
- `VITE_ZITADEL_CLIENT_ID`: client id da aplicacao no Zitadel
- `VITE_API_BASE_URL`: base URL da API de ponto
- `VITE_MOCK_AUTH`: `true` para login mock, `false` para login real via OIDC

## Modos de execucao

### 1) Modo demo (sem dependencia de Zitadel)

Ideal para validacao funcional do fluxo de ponto.

1. Garanta `VITE_MOCK_AUTH=true`.
2. 
```bash
cd storer-ponto-extension/
```
3. Suba a API mock:

```bash
npm run mock-api
```

4. Em outro terminal, gere a build: 
```bash
cd storer-ponto-extension/
npm run build
```

5. Carregue a extensao em `chrome://extensions`:

1. Ative Developer mode.
2. Clique em Load unpacked.
3. Selecione a pasta `dist/`.

### 2) Modo real (login com Zitadel)

1. Configure no `.env.local`:
   - `VITE_MOCK_AUTH=false`
   - `VITE_ZITADEL_DOMAIN=<tenant.zitadel.cloud ou dominio valido>`
   - `VITE_ZITADEL_CLIENT_ID=<client_id_do_app>`
   
2. No app do Zitadel, cadastre a Redirect URI da extensao:

```text
https://<EXTENSION_ID>.chromiumapp.org/callback
```

3. 
```bash
cd storer-ponto-extension/
```

4. Rode `npm run build` e recarregue a extensao no Chrome.

## Scripts

- `npm run dev`: servidor de desenvolvimento Vite (UI web)
- `npm run build`: build de producao da extensao
- `npm run preview`: preview do build web
- `npm run lint`: lint
- `npm run lint:fix`: lint com autofix
- `npm run typecheck`: checagem de tipos TS
- `npm run test`: testes unitarios
- `npm run test:watch`: testes em watch mode
- `npm run test:coverage`: cobertura de testes
- `npm run mock-api`: sobe API mock local (`http://localhost:3001`)

## Estrutura principal

```text
src/
  popup/        UI principal da extensao
  options/      pagina de configuracoes
  background/   service worker (refresh token, reminders, fila offline)
  services/     auth, storage, http client, ponto service
  types/        contratos TypeScript
  constants/    constantes de API e OIDC
tests/          testes com Vitest
mock-api/       servidor mock local
```

## Troubleshooting

- Erro `OIDC nao configurado`: confira `VITE_ZITADEL_DOMAIN` e `VITE_ZITADEL_CLIENT_ID`.
- Erro `Authorization page could not be loaded`: validar dominio do Zitadel, DNS e Redirect URI.
- Cloudflare `Error 1000`: problema de DNS do dominio custom; use tenant `*.zitadel.cloud` ou corrija DNS.

## Seguranca

- Access token armazenado em `chrome.storage.session`.
- Refresh token armazenado em `chrome.storage.local` com criptografia AES-GCM.
- Nunca versionar segredos reais em arquivos `.env` commitados.
