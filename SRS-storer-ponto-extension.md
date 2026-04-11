# SRS — Storer Ponto Extension
**Especificação de Requisitos de Software**
Versão 1.0 | Abril/2026 | Storer Sistemas

---

## 1. Introdução

### 1.1 Propósito
Este documento descreve os requisitos funcionais e não funcionais da **Storer Ponto Extension**, uma extensão de navegador (Chrome/Edge) que permite ao colaborador registrar ponto eletrônico diretamente pelo navegador, integrando-se ao ecossistema Storer (ponto-web-api + Zitadel IAM).

### 1.2 Escopo
A extensão substitui o acesso via portal web para o registro de batidas de ponto, oferecendo uma interface de popup rápida e acessível durante o dia de trabalho. Ela **não** substitui o sistema de gestão de ponto (ponto-web-api), apenas provê um cliente alternativo para operações de registro e consulta.

### 1.3 Definições e Siglas

| Termo | Definição |
|-------|-----------|
| **Batida** | Registro de ponto eletrônico (entrada, saída, intervalo) |
| **Espelho** | Histórico de batidas do dia/período |
| **Saldo** | Saldo de horas (positivo/negativo) do mês |
| **OIDC** | OpenID Connect — protocolo de autenticação |
| **PKCE** | Proof Key for Code Exchange — extensão OAuth2 segura para SPAs/extensões |
| **ponto-web-api** | API backend de ponto eletrônico hospedada no Azure Container Apps |
| **Zitadel** | Identity Provider (IdP) da Storer |
| **BFF** | Backend for Frontend — camada de agregação de APIs |

### 1.4 Referências
- RFC 6749 — OAuth 2.0 Authorization Framework
- RFC 7636 — PKCE for OAuth Public Clients
- Chrome Extension Manifest V3 — Google Developer Docs
- Storer IAM Architecture — Documento interno
- LGPD (Lei 13.709/2018)

### 1.5 Visão Geral do Documento
Seções 2-4 descrevem visão geral do produto, requisitos funcionais e não funcionais. Seção 5 descreve as regras de negócio. Seção 6 apresenta os casos de uso.

---

## 2. Descrição Geral

### 2.1 Perspectiva do Produto
A extensão é um **cliente web** que opera como popup no navegador. Ela se comunica exclusivamente com a `ponto-web-api` via HTTPS e usa o Zitadel como provedor de identidade. O token JWT obtido via OIDC é armazenado de forma segura no `chrome.storage.session`.

```
[Colaborador] → [Extensão Popup] → [ponto-web-api] → [BD Ponto]
                        ↑
                   [Zitadel OIDC]
```

### 2.2 Funções do Produto
- Autenticação SSO via Zitadel (OIDC/PKCE)
- Registro de batida (bater ponto) com 1 clique
- Visualização das batidas do dia
- Consulta de saldo de horas do mês
- Notificação lembrete de ponto não registrado

### 2.3 Usuários

| Perfil | Descrição |
|--------|-----------|
| **Colaborador** | Usuário final que registra ponto; acesso básico |
| **Gestor** | Pode visualizar registros da equipe (fase futura) |

### 2.4 Restrições
- Manifest V3 (Chrome Extensions API)
- Compatível com Chrome ≥ 114 e Edge ≥ 114
- Não armazena credenciais (login/senha) localmente
- Conformidade com LGPD: dados de geolocalização apenas com consentimento explícito
- Token de sessão expira ao fechar o navegador (`chrome.storage.session`)

### 2.5 Premissas
- A `ponto-web-api` expõe endpoints REST documentados com suporte a CORS para a extensão
- O Zitadel está configurado com uma aplicação do tipo **Native/SPA** para a extensão
- O colaborador possui conta ativa no Zitadel com perfil de ponto configurado

---

## 3. Requisitos Funcionais

### RF-01 — Autenticação via Zitadel OIDC

**Prioridade:** Alta | **Sprint:** 1

| Campo | Descrição |
|-------|-----------|
| **Descrição** | O sistema deve autenticar o usuário via fluxo OIDC Authorization Code + PKCE usando o Zitadel como IdP |
| **Entrada** | Clique em "Entrar" na tela inicial da extensão |
| **Processo** | 1. Gerar code_verifier e code_challenge (S256); 2. Abrir aba de login do Zitadel; 3. Após callback, trocar code por tokens; 4. Armazenar access_token e id_token em chrome.storage.session |
| **Saída** | Usuário autenticado; popup exibe nome e foto do usuário |
| **Exceções** | Timeout de 5 min na janela de login → exibir mensagem de erro |

---

### RF-02 — Logout / Revogação de Sessão

**Prioridade:** Alta | **Sprint:** 1

| Campo | Descrição |
|-------|-----------|
| **Descrição** | O usuário deve poder encerrar a sessão a qualquer momento |
| **Processo** | 1. Chamar endpoint de revogação do Zitadel; 2. Limpar chrome.storage.session; 3. Retornar para tela de login |

---

### RF-03 — Registro de Batida (Bater Ponto)

**Prioridade:** Alta | **Sprint:** 1

| Campo | Descrição |
|-------|-----------|
| **Descrição** | O colaborador deve poder registrar uma batida de ponto com 1 clique |
| **Entrada** | Clique no botão "Bater Ponto" |
| **Processo** | 1. Capturar timestamp client-side (UTC); 2. Opcionalmente capturar geolocalização (com consentimento); 3. POST /v1/ponto/batidas com { timestamp, tipo, geolocation? }; 4. Exibir confirmação visual |
| **Saída** | Toast de confirmação com horário registrado; lista de batidas do dia atualizada |
| **Exceções** | Erro de rede → retry automático (3x, backoff exponencial); falha persistente → mensagem de erro com opção de tentar novamente |

---

### RF-04 — Visualização de Batidas do Dia

**Prioridade:** Alta | **Sprint:** 1

| Campo | Descrição |
|-------|-----------|
| **Descrição** | O popup deve exibir todas as batidas registradas no dia corrente |
| **Processo** | GET /v1/ponto/batidas?data={hoje} |
| **Saída** | Lista cronológica de batidas com horário e tipo (Entrada / Intervalo / Retorno / Saída) |

---

### RF-05 — Consulta de Saldo de Horas

**Prioridade:** Média | **Sprint:** 2

| Campo | Descrição |
|-------|-----------|
| **Descrição** | O popup deve exibir o saldo de horas do mês atual |
| **Processo** | GET /v1/ponto/saldo?mes={anoMes} |
| **Saída** | Saldo exibido em horas e minutos (positivo em verde, negativo em vermelho) |

---

### RF-06 — Notificação de Lembrete de Ponto

**Prioridade:** Média | **Sprint:** 2

| Campo | Descrição |
|-------|-----------|
| **Descrição** | O sistema deve enviar notificação push ao colaborador nos horários configurados se o ponto não foi registrado |
| **Configuração** | Usuário define horários de lembrete nas configurações da extensão |
| **Processo** | Service Worker verifica batidas do dia via API; se batida esperada ausente, emite chrome.notifications.create |

---

### RF-07 — Configurações da Extensão

**Prioridade:** Média | **Sprint:** 2

| Campo | Descrição |
|-------|-----------|
| **Descrição** | Página de configurações (options page) para personalização |
| **Campos** | - URL base da API (pré-preenchida com valor default); - Horários de lembrete (1 a 4 horários); - Habilitar/desabilitar geolocalização |

---

### RF-08 — Renovação Automática de Token (Token Refresh)

**Prioridade:** Alta | **Sprint:** 1

| Campo | Descrição |
|-------|-----------|
| **Descrição** | O sistema deve renovar o access_token automaticamente usando o refresh_token antes da expiração |
| **Processo** | Background service worker monitora expiração; executa refresh 60s antes do vencimento |

---

## 4. Requisitos Não Funcionais

### RNF-01 — Desempenho

| ID | Requisito |
|----|-----------|
| RNF-01.1 | O popup deve abrir e renderizar em < 300ms |
| RNF-01.2 | O registro de batida deve retornar confirmação em < 2s (p95) |
| RNF-01.3 | As chamadas à API devem ter timeout configurável (default: 10s) |

### RNF-02 — Segurança

| ID | Requisito |
|----|-----------|
| RNF-02.1 | Nenhuma credencial (senha, secret) deve ser armazenada localmente |
| RNF-02.2 | Access token deve ser armazenado apenas em `chrome.storage.session` (não persiste ao fechar browser) |
| RNF-02.3 | Refresh token deve ser armazenado em `chrome.storage.local` com criptografia AES-GCM (chave derivada de device fingerprint) |
| RNF-02.4 | Todas as comunicações via HTTPS/TLS 1.2+ |
| RNF-02.5 | Content Security Policy restritiva no manifest (sem eval, sem inline scripts) |
| RNF-02.6 | Conformidade com LGPD para dados de geolocalização |

### RNF-03 — Confiabilidade

| ID | Requisito |
|----|-----------|
| RNF-03.1 | Retry automático de batida com backoff exponencial (max 3 tentativas) |
| RNF-03.2 | Queue local de batidas pendentes (offline-first): se offline, registra localmente e sincroniza quando conectar |
| RNF-03.3 | A extensão não deve travar o navegador em caso de falha da API |

### RNF-04 — Usabilidade

| ID | Requisito |
|----|-----------|
| RNF-04.1 | Popup com dimensões máximas de 380x560px |
| RNF-04.2 | Suporte a modo escuro (respeitar prefers-color-scheme) |
| RNF-04.3 | Botão "Bater Ponto" deve ser atingível com 1 clique após autenticação |
| RNF-04.4 | Feedback visual imediato (loading state) em toda ação de rede |

### RNF-05 — Manutenibilidade

| ID | Requisito |
|----|-----------|
| RNF-05.1 | Cobertura de testes unitários ≥ 80% |
| RNF-05.2 | TypeScript strict mode habilitado |
| RNF-05.3 | Código fonte hospedado no Azure DevOps com pipeline CI/CD |

### RNF-06 — Compatibilidade

| ID | Requisito |
|----|-----------|
| RNF-06.1 | Chrome ≥ 114 (Manifest V3) |
| RNF-06.2 | Microsoft Edge ≥ 114 (Chromium-based) |
| RNF-06.3 | Resolução mínima: 1280x720 |

---

## 5. Regras de Negócio

| ID | Regra |
|----|-------|
| RN-01 | Uma batida registrada não pode ser editada pela extensão (somente pelo sistema administrativo) |
| RN-02 | O tipo de batida (Entrada/Intervalo/Retorno/Saída) é determinado automaticamente pela API com base na sequência de registros do dia |
| RN-03 | Geolocalização só é capturada após consentimento explícito do usuário, configurável nas opções |
| RN-04 | A extensão não exibe dados de outros colaboradores (escopo do token é individual) |
| RN-05 | O saldo de horas exibido é calculado pela API, não pela extensão |
| RN-06 | Batidas com diferença < 1 minuto da batida anterior são rejeitadas pela API |

---

## 6. Casos de Uso

### UC-01 — Bater Ponto (Fluxo Principal)

**Ator:** Colaborador autenticado

```
1. Colaborador clica no ícone da extensão na barra do Chrome
2. Popup abre exibindo batidas do dia e botão "Bater Ponto"
3. Colaborador clica em "Bater Ponto"
4. Sistema exibe loading indicator
5. Sistema envia POST /v1/ponto/batidas
6. API retorna confirmação com timestamp e tipo da batida
7. Popup exibe toast "Ponto registrado! 08:02 — Entrada"
8. Lista de batidas atualiza com o novo registro
```

**Fluxo Alternativo A — Erro de Rede:**
```
5a. Requisição falha (timeout/offline)
5b. Sistema aguarda 2s e tenta novamente (máx 3x)
5c. Se persistir, exibe "Falha ao registrar. Tente novamente." com botão de retry
```

---

### UC-02 — Primeiro Acesso (Login)

**Ator:** Colaborador sem sessão ativa

```
1. Colaborador abre o popup → tela de login exibida
2. Clica em "Entrar com conta Storer"
3. Chrome abre aba de login do Zitadel
4. Colaborador autentica (SSO corporativo)
5. Zitadel redireciona para callback da extensão
6. Extensão troca code por tokens
7. Popup fecha a aba de login e exibe tela principal
```

---

## 7. Arquitetura de Alto Nível

```
┌─────────────────────────────────────────────────────┐
│                 Chrome Extension                    │
│  ┌──────────────┐  ┌──────────────────────────────┐ │
│  │   Popup UI   │  │     Service Worker (BG)      │ │
│  │  (React/TS)  │  │  - Token refresh             │ │
│  │              │  │  - Reminder notifications    │ │
│  │  - Login     │  │  - Offline queue sync        │ │
│  │  - Bater     │  └──────────────────────────────┘ │
│  │    Ponto     │                                    │
│  │  - Espelho   │  ┌──────────────────────────────┐ │
│  │  - Saldo     │  │      Options Page            │ │
│  └──────┬───────┘  └──────────────────────────────┘ │
└─────────┼───────────────────────────────────────────┘
          │ HTTPS/REST
          ▼
┌─────────────────────┐    ┌──────────────────────┐
│   ponto-web-api     │    │    Zitadel IAM        │
│  (Azure Container   │    │  (OIDC Provider)     │
│       App)          │    └──────────────────────┘
└─────────────────────┘
```

---

## 8. Glossário

| Termo | Significado |
|-------|-------------|
| Access Token | JWT de curta duração (15min) para autorizar chamadas à API |
| Refresh Token | Token de longa duração para renovar o access token |
| chrome.storage.session | Storage que limpa ao fechar o browser (não persiste) |
| chrome.storage.local | Storage persistente, cifrado pelo Chrome |
| code_verifier | String aleatória usada no PKCE |
| code_challenge | Hash SHA-256 do code_verifier |

---

*Documento gerado para uso interno — Storer Sistemas — Campo Grande/MS*
