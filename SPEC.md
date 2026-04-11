# SPEC — Storer Ponto Extension
*Claude Code Specification File*

## Visão Geral do Projeto

Extensão de navegador (Chrome/Edge, Manifest V3) para registro de ponto eletrônico dos colaboradores da Storer Sistemas. Integra com `ponto-web-api` (Azure Container Apps) e usa Zitadel como Identity Provider via OIDC/PKCE.

**Repositório:** `storer-ponto-extension` (Azure DevOps — Storer Sistemas)  
**Stack:** TypeScript · React 18 · Vite · Vitest · Chrome Extension Manifest V3  
**API Backend:** `ponto-web-api` (REST, JWT auth)  
**IdP:** Zitadel (OIDC Authorization Code + PKCE)

---

## Estrutura de Diretórios

```
storer-ponto-extension/
├── src/
│   ├── popup/                   # Popup principal da extensão
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── LoginScreen.tsx
│   │   │   ├── MainScreen.tsx
│   │   │   ├── BaterPontoButton.tsx
│   │   │   ├── BatidasList.tsx
│   │   │   ├── BatidaItem.tsx
│   │   │   ├── SaldoWidget.tsx
│   │   │   ├── UserMenu.tsx
│   │   │   └── ToastNotification.tsx
│   │   └── hooks/
│   │       ├── useAuth.ts
│   │       ├── useBatidas.ts
│   │       └── useSaldo.ts
│   ├── options/                 # Página de configurações
│   │   ├── index.html
│   │   ├── main.tsx
│   │   └── components/
│   │       ├── OptionsPage.tsx
│   │       └── TimePickerInput.tsx
│   ├── background/              # Service Worker
│   │   ├── index.ts             # Entry point do SW
│   │   ├── TokenRefreshService.ts
│   │   ├── ReminderService.ts
│   │   └── OfflineQueueService.ts
│   ├── services/                # Serviços compartilhados
│   │   ├── AuthService.ts       # PKCE, token exchange, storage
│   │   ├── PontoService.ts      # Chamadas à ponto-web-api
│   │   ├── StorageService.ts    # Wrapper chrome.storage
│   │   └── HttpClient.ts        # Fetch wrapper com retry + auth
│   ├── types/
│   │   ├── auth.types.ts
│   │   ├── ponto.types.ts
│   │   └── config.types.ts
│   └── constants/
│       ├── api.constants.ts
│       └── auth.constants.ts
├── public/
│   ├── manifest.json
│   └── icons/
│       ├── icon-16.png
│       ├── icon-32.png
│       ├── icon-48.png
│       └── icon-128.png
├── tests/
│   ├── services/
│   │   ├── AuthService.test.ts
│   │   ├── PontoService.test.ts
│   │   └── HttpClient.test.ts
│   ├── components/
│   │   ├── BaterPontoButton.test.tsx
│   │   └── BatidasList.test.tsx
│   └── background/
│       └── TokenRefreshService.test.ts
├── vite.config.ts
├── vitest.config.ts
├── tsconfig.json
├── .eslintrc.cjs
├── .prettierrc
├── azure-pipelines.yml
└── package.json
```

---

## Manifest V3

```json
// public/manifest.json
{
  "manifest_version": 3,
  "name": "Storer Ponto",
  "version": "1.0.0",
  "description": "Registro de ponto eletrônico — Storer Sistemas",
  "permissions": [
    "storage",
    "notifications",
    "alarms",
    "identity",
    "geolocation"
  ],
  "host_permissions": [
    "https://ponto-api.storer.com.br/*",
    "https://*.zitadel.cloud/*"
  ],
  "background": {
    "service_worker": "background/index.js",
    "type": "module"
  },
  "action": {
    "default_popup": "popup/index.html",
    "default_icon": {
      "16": "icons/icon-16.png",
      "32": "icons/icon-32.png"
    }
  },
  "options_page": "options/index.html",
  "icons": {
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

---

## Types Principais

```typescript
// src/types/auth.types.ts
export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresAt: number; // Unix timestamp em ms
  userId: string;
  userEmail: string;
  userDisplayName: string;
  userAvatarUrl?: string;
}

export interface PKCEState {
  codeVerifier: string;
  codeChallenge: string;
  state: string;
  redirectUri: string;
}

// src/types/ponto.types.ts
export type TipoBatida = 'ENTRADA' | 'INTERVALO' | 'RETORNO' | 'SAIDA';

export interface Batida {
  id: string;
  timestamp: string; // ISO 8601 UTC
  tipo: TipoBatida;
  geolocation?: {
    latitude: number;
    longitude: number;
  };
  sincronizado: boolean;
}

export interface RegistrarBatidaRequest {
  timestamp: string;
  geolocation?: {
    latitude: number;
    longitude: number;
  };
}

export interface RegistrarBatidaResponse {
  id: string;
  timestamp: string;
  tipo: TipoBatida;
}

export interface SaldoMes {
  mesAno: string; // "2026-04"
  saldoMinutos: number; // positivo ou negativo
  horasTrabalhadas: number;
  horasPrevistas: number;
}

// src/types/config.types.ts
export interface ExtensionConfig {
  apiBaseUrl: string;
  lembretes: string[]; // ["08:00", "12:00", "13:30", "18:00"]
  geolocalizacaoHabilitada: boolean;
  notificacoesHabilitadas: boolean;
}
```

---

## Contratos de API — ponto-web-api

```typescript
// Todas as chamadas usam Authorization: Bearer {accessToken}

// POST /v1/ponto/batidas
// Body: RegistrarBatidaRequest
// Response: RegistrarBatidaResponse

// GET /v1/ponto/batidas?data=2026-04-10
// Response: Batida[]

// GET /v1/ponto/saldo?mes=2026-04
// Response: SaldoMes
```

---

## Implementações Chave

### AuthService.ts

```typescript
// src/services/AuthService.ts
// Responsabilidades:
// - generatePKCE(): gerar code_verifier e code_challenge (SHA-256, base64url)
// - startLoginFlow(): abrir aba Zitadel com params OIDC
// - handleCallback(url): extrair code do callback, trocar por tokens
// - getTokens(): recuperar do chrome.storage
// - saveTokens(tokenSet): persistir com criptografia
// - clearTokens(): logout completo
// - isAuthenticated(): verificar se há tokens válidos
// - revokeTokens(): chamar revocation endpoint do Zitadel

// OIDC Endpoints do Zitadel (via OIDC Discovery):
// Authorization: https://{ZITADEL_DOMAIN}/oauth/v2/authorize
// Token: https://{ZITADEL_DOMAIN}/oauth/v2/token
// Revocation: https://{ZITADEL_DOMAIN}/oauth/v2/revoke
// JWKS: https://{ZITADEL_DOMAIN}/oauth/v2/keys
// Discovery: https://{ZITADEL_DOMAIN}/.well-known/openid-configuration

// Parâmetros do Authorization Request:
// client_id: process.env.VITE_ZITADEL_CLIENT_ID
// redirect_uri: chrome.identity.getRedirectURL('callback')
// response_type: 'code'
// scope: 'openid profile email offline_access'
// code_challenge_method: 'S256'
// code_challenge: pkce.codeChallenge
// state: pkce.state
```

### HttpClient.ts

```typescript
// src/services/HttpClient.ts
// Responsabilidades:
// - request<T>(method, path, body?): fetch wrapper
// - Interceptar 401 → chamar TokenRefreshService → retry
// - Retry automático (3x, backoff exponencial: 1s, 2s, 4s)
// - Adicionar Authorization header automaticamente
// - Timeout configurável (default 10s)
// - Fila de requisições durante token refresh

// Uso:
// const client = new HttpClient({ baseUrl: config.apiBaseUrl })
// const batidas = await client.request<Batida[]>('GET', '/v1/ponto/batidas?data=2026-04-10')
```

### PontoService.ts

```typescript
// src/services/PontoService.ts
// Métodos:
// - registrarBatida(geolocation?): POST /v1/ponto/batidas
//   - Se offline: salvar em OfflineQueueService
//   - Se online: POST direto
// - getBatidasDia(data?: string): GET /v1/ponto/batidas
// - getSaldo(mesAno: string): GET /v1/ponto/saldo
```

### TokenRefreshService.ts (Service Worker)

```typescript
// src/background/TokenRefreshService.ts
// Responsabilidades:
// - Registrar chrome.alarms para verificação de expiração
// - Executar refresh via POST ao token endpoint do Zitadel com grant_type=refresh_token
// - Atualizar tokens no storage
// - Se refresh_token expirado: limpar tokens e emitir mensagem para popup (re-login)
// - Notificar popup via chrome.runtime.sendMessage({ type: 'AUTH_EXPIRED' })
```

### ReminderService.ts (Service Worker)

```typescript
// src/background/ReminderService.ts
// Responsabilidades:
// - Carregar horários de lembrete das configurações
// - Criar chrome.alarms para cada horário
// - No alarm handler:
//   1. Verificar se é dia útil
//   2. Buscar batidas do dia via PontoService
//   3. Se ausente batida esperada → chrome.notifications.create
//   4. Clicar na notificação → chrome.action.openPopup() ou tab
```

### OfflineQueueService.ts (Service Worker)

```typescript
// src/background/OfflineQueueService.ts
// Responsabilidades:
// - saveToQueue(batida: Batida): salvar em chrome.storage.local['offlineQueue']
// - processQueue(): flush das batidas pendentes via PontoService
// - Listener: chrome.runtime.onConnect → detectar reconexão → processQueue()
// - Listener: self.addEventListener('fetch') não disponível em MV3 — usar
//   navigator.onLine check no background service worker
```

---

## Variáveis de Ambiente

```bash
# .env (não comitar — usar Azure DevOps Variable Groups)
VITE_ZITADEL_DOMAIN=auth.storer.com.br
VITE_ZITADEL_CLIENT_ID=storer-ponto-extension@StorerProject
VITE_API_BASE_URL=https://ponto-api.storer.com.br
VITE_ENV=production
```

```bash
# .env.development
VITE_ZITADEL_DOMAIN=auth-dev.storer.com.br
VITE_ZITADEL_CLIENT_ID=storer-ponto-extension-dev@StorerProject
VITE_API_BASE_URL=https://ponto-api-dev.storer.com.br
VITE_ENV=development
```

---

## Vite Build Config

```typescript
// vite.config.ts
// Build multiplo: popup, background, options
// Cada entry point tem seu próprio bundle
// Output: dist/popup/, dist/background/, dist/options/
// Source maps em desenvolvimento, disabled em produção
// No eval (CSP constraint de MV3)
```

---

## Padrões de Código

### Nomenclatura
- **Componentes React:** PascalCase (`BaterPontoButton.tsx`)
- **Serviços:** PascalCase com sufixo Service (`AuthService.ts`)
- **Hooks:** camelCase com prefixo use (`useAuth.ts`)
- **Types/Interfaces:** PascalCase com sufixo de domínio (`Batida`, `TokenSet`)
- **Constantes:** UPPER_SNAKE_CASE (`API_TIMEOUT_MS`)
- **Variáveis/Funções:** camelCase

### Regras de Implementação
1. **Nunca** armazenar senha ou client_secret na extensão
2. **Sempre** usar `chrome.storage.session` para access_token (limpa ao fechar browser)
3. **Sempre** tipar explicitamente retornos de função (sem `any`)
4. **Sempre** tratar erros de API com mensagem amigável ao usuário
5. **Nunca** fazer chamadas de API no render — usar hooks/services
6. Todo estado global via React Context (sem Redux por ora)
7. Componentes devem ter no máximo 150 linhas
8. Cada serviço deve ter interface TypeScript correspondente

### Testes
- **Framework:** Vitest + @testing-library/react
- **Mock do Chrome API:** usar `vitest-chrome` ou mock manual
- **Cobertura mínima:** 80% (branches + lines)
- **Estrutura:** Arrange → Act → Assert com comentários

---

## Pipeline CI/CD

```yaml
# azure-pipelines.yml (estrutura)
trigger:
  branches:
    include: [main, develop]

pool:
  vmImage: 'ubuntu-latest'

stages:
  - stage: Validate
    jobs:
      - job: LintAndTest
        steps:
          - task: NodeTool@0 (version: '20.x')
          - script: npm ci
          - script: npm run lint
          - script: npm run test:coverage
          - task: PublishCodeCoverageResults

  - stage: Build
    condition: succeeded()
    jobs:
      - job: BuildExtension
        steps:
          - script: npm run build
          - script: cd dist && zip -r ../storer-ponto-extension.zip .
          - task: PublishBuildArtifacts (storer-ponto-extension.zip)
```

---

## Comandos de Desenvolvimento

```bash
# Setup inicial
npm install

# Desenvolvimento com hot reload
npm run dev

# Build de produção
npm run build

# Carregar extensão no Chrome:
# 1. chrome://extensions → Developer mode ON
# 2. Load unpacked → selecionar dist/

# Testes
npm run test
npm run test:coverage
npm run test:watch

# Lint
npm run lint
npm run lint:fix
```

---

## Checklist de Segurança (pré-deploy)

- [ ] `client_secret` não presente em nenhum arquivo da extensão
- [ ] CSP do manifest não permite `unsafe-eval` nem `unsafe-inline`
- [ ] Refresh token criptografado (AES-GCM) em `chrome.storage.local`
- [ ] Access token somente em `chrome.storage.session`
- [ ] `host_permissions` mínimas (apenas domínios da API e do Zitadel)
- [ ] Geolocalização requer consentimento explícito
- [ ] LGPD: dados de localização não persistidos sem consentimento
- [ ] Sem `console.log` com dados sensíveis em produção
- [ ] Source maps desabilitados em produção

---

## Contexto de Integração Storer

| Componente | Detalhe |
|------------|---------|
| **ponto-web-api** | Azure Container App; JWT auth via Zitadel; endpoints REST documentados |
| **Zitadel** | IdP principal da Storer; configurar app "Native" para a extensão |
| **Claim `org_id`** | Presente no JWT; usado pela ponto-web-api para tenant isolation |
| **Claim `roles`** | `["colaborador"]` para acesso básico; verificado pela API |
| **CORS** | ponto-web-api deve liberar origin `chrome-extension://{EXTENSION_ID}` |

---

*Spec mantido em: `storer-ponto-extension/SPEC.md`*  
*Storer Sistemas — Diego H. Franco (CTO) — Campo Grande/MS*
