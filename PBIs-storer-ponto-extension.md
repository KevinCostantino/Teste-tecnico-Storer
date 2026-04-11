# PBIs — Azure DevOps Board
## Storer Ponto Extension
*Formato: Epic → Feature → PBI (com Acceptance Criteria e Tasks)*

---

> **Como importar no Azure DevOps:**
> Use o CLI `az boards work-item create` ou importe via CSV/Excel no portal.
> Scripts de automação no final deste documento.

---

## 🟣 EPIC-01 — Storer Ponto Extension

**Título:** Storer Ponto Extension — Extensão de Navegador para Registro de Ponto  
**Tipo:** Epic  
**Área:** Storer > HR  
**Tags:** `extensão` `ponto` `chrome` `oidc`  
**Descrição:**
> Desenvolvimento de extensão Chrome/Edge (Manifest V3) para registro de ponto eletrônico integrado à ponto-web-api e autenticação via Zitadel OIDC. Substitui o acesso via portal web para batidas do dia a dia.

---

## 🔵 FEATURE-01 — Autenticação e Gerenciamento de Sessão

**Título:** Autenticação via Zitadel OIDC com PKCE  
**Tipo:** Feature  
**Epic:** EPIC-01  
**Sprint:** Sprint 1  

---

### 📋 PBI-01 — Login via Zitadel OIDC (PKCE Flow)

**Título:** Como colaborador, quero fazer login na extensão usando minha conta Storer via SSO  
**Tipo:** Product Backlog Item  
**Feature:** FEATURE-01  
**Story Points:** 5  
**Prioridade:** Alta  
**Sprint:** Sprint 1  

**Descrição:**
> Implementar o fluxo de autenticação OAuth2 Authorization Code + PKCE usando Zitadel como IdP. O usuário clica em "Entrar com conta Storer" e é redirecionado para a tela de login do Zitadel. Após autenticação, o popup exibe o nome e avatar do usuário.

**Acceptance Criteria:**
- [ ] AC-01: Botão "Entrar com conta Storer" visível na tela inicial quando não autenticado
- [ ] AC-02: Ao clicar, uma nova aba/popup do Zitadel é aberta com o fluxo OIDC correto (response_type=code, PKCE com S256)
- [ ] AC-03: Após autenticação bem-sucedida, a aba de login é fechada automaticamente
- [ ] AC-04: O popup exibe nome, email e foto do usuário autenticado
- [ ] AC-05: Access token armazenado em `chrome.storage.session` (não persiste ao fechar browser)
- [ ] AC-06: Refresh token armazenado em `chrome.storage.local` com criptografia AES-GCM
- [ ] AC-07: Se o login demorar > 5 minutos, exibir "Tempo de login expirado. Tente novamente."
- [ ] AC-08: Estado de autenticação persiste entre aberturas do popup na mesma sessão do browser

**Tasks:**
- [ ] Configurar aplicação Native/SPA no Zitadel (redirect_uri para chrome-extension://{ID})
- [ ] Implementar geração de code_verifier e code_challenge (crypto.subtle, SHA-256)
- [ ] Implementar fluxo de troca de code por tokens (token endpoint)
- [ ] Implementar armazenamento seguro dos tokens
- [ ] Criar componente `LoginScreen` (React)
- [ ] Criar serviço `AuthService` (PKCE, token exchange, storage)
- [ ] Testes unitários: AuthService (mock chrome.storage, mock fetch)

---

### 📋 PBI-02 — Logout e Revogação de Sessão

**Título:** Como colaborador, quero fazer logout da extensão para encerrar minha sessão com segurança  
**Tipo:** Product Backlog Item  
**Feature:** FEATURE-01  
**Story Points:** 2  
**Prioridade:** Alta  
**Sprint:** Sprint 1  

**Acceptance Criteria:**
- [ ] AC-01: Botão de logout visível no popup quando autenticado (menu ou ícone)
- [ ] AC-02: Ao fazer logout, chamar endpoint de revogação do Zitadel (token revocation endpoint)
- [ ] AC-03: Limpar `chrome.storage.session` e `chrome.storage.local` após logout
- [ ] AC-04: Redirecionar para tela de login após logout
- [ ] AC-05: Logout funciona mesmo sem conexão com a internet (limpa tokens locais)

**Tasks:**
- [ ] Implementar chamada ao token revocation endpoint do Zitadel
- [ ] Implementar limpeza completa do storage
- [ ] Criar componente `UserMenu` com opção de logout
- [ ] Testes: logout com e sem conectividade

---

### 📋 PBI-03 — Renovação Automática de Token (Token Refresh)

**Título:** Como colaborador, quero que minha sessão seja renovada automaticamente sem precisar logar novamente  
**Tipo:** Product Backlog Item  
**Feature:** FEATURE-01  
**Story Points:** 3  
**Prioridade:** Alta  
**Sprint:** Sprint 1  

**Acceptance Criteria:**
- [ ] AC-01: Service Worker monitora expiração do access_token
- [ ] AC-02: Refresh executado automaticamente 60 segundos antes da expiração
- [ ] AC-03: Se refresh falhar (refresh_token expirado), redirecionar para login
- [ ] AC-04: Fila de requisições pendentes durante o refresh é processada após renovação
- [ ] AC-05: Logs de refresh escritos no console em modo de desenvolvimento

**Tasks:**
- [ ] Implementar `TokenRefreshService` no service worker
- [ ] Implementar fila de requisições HTTP com retry após refresh
- [ ] Configurar alarm do Chrome para refresh periódico
- [ ] Testes: simulação de token expirado, refresh bem-sucedido e falho

---

## 🔵 FEATURE-02 — Registro e Consulta de Ponto

**Título:** Registro de Batidas e Consulta do Espelho Diário  
**Tipo:** Feature  
**Epic:** EPIC-01  
**Sprint:** Sprint 1  

---

### 📋 PBI-04 — Bater Ponto com 1 Clique

**Título:** Como colaborador, quero registrar minha batida de ponto com 1 clique no popup  
**Tipo:** Product Backlog Item  
**Feature:** FEATURE-02  
**Story Points:** 5  
**Prioridade:** Alta  
**Sprint:** Sprint 1  

**Descrição:**
> Funcionalidade principal da extensão. O colaborador clica em "Bater Ponto" e o sistema registra a batida via API, exibindo confirmação visual com o horário e tipo da batida (Entrada, Intervalo, Retorno ou Saída).

**Acceptance Criteria:**
- [ ] AC-01: Botão "Bater Ponto" é o elemento principal e mais visível do popup
- [ ] AC-02: Ao clicar, botão entra em estado de loading (desabilitado + spinner)
- [ ] AC-03: A requisição inclui timestamp UTC e user-agent da extensão
- [ ] AC-04: Após confirmação da API, exibir toast com "✅ Ponto registrado! HH:MM — [Tipo]"
- [ ] AC-05: Toast desaparece após 4 segundos
- [ ] AC-06: A lista de batidas do dia é atualizada imediatamente após confirmação
- [ ] AC-07: Em caso de erro de rede, executar 3 retentativas com backoff exponencial (1s, 2s, 4s)
- [ ] AC-08: Após 3 falhas, exibir "Falha ao registrar. Verifique sua conexão." com botão "Tentar novamente"
- [ ] AC-09: Batida registrada em modo offline é enfileirada e sincronizada quando a conexão retornar

**Tasks:**
- [ ] Criar serviço `PontoService.registrarBatida()` (POST /v1/ponto/batidas)
- [ ] Implementar lógica de retry com backoff exponencial
- [ ] Implementar offline queue em `chrome.storage.local`
- [ ] Criar componente `BaterPontoButton` com estados (idle/loading/success/error)
- [ ] Criar componente `ToastNotification`
- [ ] Service Worker: listener de conectividade para flush da queue offline
- [ ] Testes: fluxo feliz, retry, offline queue

---

### 📋 PBI-05 — Visualização das Batidas do Dia

**Título:** Como colaborador, quero ver todas as minhas batidas do dia no popup  
**Tipo:** Product Backlog Item  
**Feature:** FEATURE-02  
**Story Points:** 3  
**Prioridade:** Alta  
**Sprint:** Sprint 1  

**Acceptance Criteria:**
- [ ] AC-01: Lista de batidas exibida abaixo do botão "Bater Ponto"
- [ ] AC-02: Cada batida exibe: ícone do tipo, horário formatado (HH:MM), e tipo (Entrada/Intervalo/Retorno/Saída)
- [ ] AC-03: Lista ordenada cronologicamente (mais recente no topo)
- [ ] AC-04: Se não há batidas no dia, exibir "Nenhuma batida registrada hoje"
- [ ] AC-05: Loading skeleton durante o carregamento inicial
- [ ] AC-06: Botão de refresh manual disponível
- [ ] AC-07: Dados atualizados automaticamente ao abrir o popup

**Tasks:**
- [ ] Criar endpoint service `PontoService.getBatidasDia()`
- [ ] Criar componente `BatidasList` com skeleton loading
- [ ] Criar componente `BatidaItem` com ícone por tipo
- [ ] Implementar cache leve (30s) para evitar chamadas duplicadas

---

### 📋 PBI-06 — Geolocalização na Batida (Opcional)

**Título:** Como colaborador, quero que minha localização seja enviada ao registrar ponto, se eu consentir  
**Tipo:** Product Backlog Item  
**Feature:** FEATURE-02  
**Story Points:** 2  
**Prioridade:** Baixa  
**Sprint:** Sprint 2  

**Acceptance Criteria:**
- [ ] AC-01: Na primeira utilização, solicitar consentimento para geolocalização
- [ ] AC-02: Consentimento armazenado em `chrome.storage.local`
- [ ] AC-03: Se consentido, incluir lat/long na payload da batida
- [ ] AC-04: Usuário pode revogar consentimento nas configurações
- [ ] AC-05: Se geolocalização indisponível, registrar batida sem coordenadas (sem bloquear)

---

## 🔵 FEATURE-03 — Saldo e Relatório de Horas

**Título:** Consulta de Saldo de Horas  
**Tipo:** Feature  
**Epic:** EPIC-01  
**Sprint:** Sprint 2  

---

### 📋 PBI-07 — Exibição de Saldo de Horas do Mês

**Título:** Como colaborador, quero ver meu saldo de horas do mês atual no popup  
**Tipo:** Product Backlog Item  
**Feature:** FEATURE-03  
**Story Points:** 3  
**Prioridade:** Média  
**Sprint:** Sprint 2  

**Acceptance Criteria:**
- [ ] AC-01: Widget de saldo exibido no popup (acima ou abaixo da lista de batidas)
- [ ] AC-02: Saldo positivo exibido em verde com "+" (ex: "+02:30")
- [ ] AC-03: Saldo negativo exibido em vermelho com "-" (ex: "-01:15")
- [ ] AC-04: Exibir mês de referência (ex: "Abril/2026")
- [ ] AC-05: Atualizado a cada abertura do popup
- [ ] AC-06: Em caso de erro, exibir "Saldo indisponível" sem travar o popup

**Tasks:**
- [ ] Criar `PontoService.getSaldo(mesAno)`
- [ ] Criar componente `SaldoWidget`
- [ ] Testes: saldo positivo, negativo, erro de API

---

## 🔵 FEATURE-04 — Notificações e Lembretes

**Título:** Notificações de Lembrete de Ponto  
**Tipo:** Feature  
**Epic:** EPIC-01  
**Sprint:** Sprint 2  

---

### 📋 PBI-08 — Notificação de Lembrete de Ponto

**Título:** Como colaborador, quero receber uma notificação nos horários configurados se ainda não bati ponto  
**Tipo:** Product Backlog Item  
**Feature:** FEATURE-04  
**Story Points:** 4  
**Prioridade:** Média  
**Sprint:** Sprint 2  

**Acceptance Criteria:**
- [ ] AC-01: Usuário pode configurar até 4 horários de lembrete (HH:MM)
- [ ] AC-02: Service Worker verifica batidas do dia via API no horário configurado
- [ ] AC-03: Se nenhuma batida foi registrada próxima ao horário esperado, emite notificação push
- [ ] AC-04: Notificação exibe: "⏰ Lembrete de ponto — Você ainda não registrou sua saída!"
- [ ] AC-05: Clicar na notificação abre o popup da extensão
- [ ] AC-06: Notificações só disparadas em dias úteis (segunda a sexta, exceto feriados nacionais)
- [ ] AC-07: Usuário pode desativar notificações completamente nas configurações

**Tasks:**
- [ ] Implementar `ReminderService` no Service Worker
- [ ] Usar `chrome.alarms` para agendamento dos lembretes
- [ ] Integrar com `chrome.notifications.create`
- [ ] Implementar verificação de dias úteis (feriados via API ou lista local)
- [ ] Testes: alarm disparo, verificação de batidas, notificação

---

## 🔵 FEATURE-05 — Configurações e Setup

**Título:** Página de Configurações da Extensão  
**Tipo:** Feature  
**Epic:** EPIC-01  
**Sprint:** Sprint 2  

---

### 📋 PBI-09 — Página de Configurações (Options Page)

**Título:** Como colaborador, quero configurar preferências da extensão (API URL, lembretes, geoloc)  
**Tipo:** Product Backlog Item  
**Feature:** FEATURE-05  
**Story Points:** 3  
**Prioridade:** Média  
**Sprint:** Sprint 2  

**Acceptance Criteria:**
- [ ] AC-01: Options page acessível via clique direito no ícone → "Opções"
- [ ] AC-02: Campo "URL da API" (pré-preenchido com URL de produção da ponto-web-api)
- [ ] AC-03: Seção "Lembretes" com até 4 horários configuráveis (input time picker)
- [ ] AC-04: Toggle "Enviar geolocalização nas batidas"
- [ ] AC-05: Botão "Salvar configurações" com feedback visual de sucesso
- [ ] AC-06: Botão "Restaurar padrões" com confirmação

**Tasks:**
- [ ] Criar `options.html` e `OptionsPage` (React)
- [ ] Implementar persistência das configurações em `chrome.storage.sync`
- [ ] Componente `TimePickerInput`
- [ ] Testes: save, reset, validação de URL

---

## 🔵 FEATURE-06 — Infraestrutura e CI/CD

**Título:** Infraestrutura, Build e Publicação da Extensão  
**Tipo:** Feature  
**Epic:** EPIC-01  
**Sprint:** Sprint 1 (infra) / Sprint 3 (publicação)  

---

### 📋 PBI-10 — Setup do Projeto (Manifest V3 + TypeScript + React)

**Título:** Como desenvolvedor, quero o projeto base configurado com TypeScript, React e Manifest V3  
**Tipo:** Product Backlog Item  
**Feature:** FEATURE-06  
**Story Points:** 3  
**Prioridade:** Alta  
**Sprint:** Sprint 1  

**Acceptance Criteria:**
- [ ] AC-01: Repositório criado no Azure DevOps (`storer-ponto-extension`)
- [ ] AC-02: Manifest V3 com permissions corretos (storage, notifications, alarms, identity)
- [ ] AC-03: Build com Vite ou Webpack (output: dist/ com popup, background, options)
- [ ] AC-04: TypeScript strict mode habilitado
- [ ] AC-05: ESLint + Prettier configurados
- [ ] AC-06: Vitest para testes unitários
- [ ] AC-07: Hot reload em desenvolvimento

**Tasks:**
- [ ] Criar repositório no Azure DevOps
- [ ] Scaffold do projeto com Vite + TypeScript + React
- [ ] Configurar manifest.json (Manifest V3)
- [ ] Configurar build multiplo (popup, background sw, options)
- [ ] Configurar ESLint + Prettier + tsconfig strict
- [ ] Configurar Vitest

---

### 📋 PBI-11 — Pipeline CI/CD (Azure DevOps)

**Título:** Como desenvolvedor, quero um pipeline de CI/CD que valide e empacote a extensão automaticamente  
**Tipo:** Product Backlog Item  
**Feature:** FEATURE-06  
**Story Points:** 3  
**Prioridade:** Alta  
**Sprint:** Sprint 1  

**Acceptance Criteria:**
- [ ] AC-01: Pipeline disparado em push para `main` e PRs
- [ ] AC-02: Stages: lint → test → build → package
- [ ] AC-03: Artefato `.zip` da extensão publicado no Azure Artifacts
- [ ] AC-04: Cobertura de testes exibida no pipeline (mínimo 80%)
- [ ] AC-05: Build falha se cobertura < 80%

**Tasks:**
- [ ] Criar `azure-pipelines.yml`
- [ ] Stage: Node.js 20 LTS
- [ ] Stage: `npm ci && npm run lint && npm test`
- [ ] Stage: `npm run build && zip -r storer-ponto-extension.zip dist/`
- [ ] Publicar artefato no pipeline
- [ ] Configurar code coverage report (Vitest + lcov)

---

## 📊 Resumo do Backlog

| Feature | PBIs | Story Points | Sprint |
|---------|------|--------------|--------|
| FEATURE-01 Autenticação | 3 PBIs | 10 SP | Sprint 1 |
| FEATURE-02 Registro de Ponto | 3 PBIs | 10 SP | Sprint 1-2 |
| FEATURE-03 Saldo de Horas | 1 PBI | 3 SP | Sprint 2 |
| FEATURE-04 Notificações | 1 PBI | 4 SP | Sprint 2 |
| FEATURE-05 Configurações | 1 PBI | 3 SP | Sprint 2 |
| FEATURE-06 Infra/CI-CD | 2 PBIs | 6 SP | Sprint 1-3 |
| **TOTAL** | **11 PBIs** | **36 SP** | |

---

## 🤖 Script de Criação Automática via Azure CLI

```bash
#!/bin/bash
# Criar PBIs no Azure DevOps via CLI
# Pré-requisitos: az cli + az devops extension instalado
# az devops configure --defaults organization=https://dev.azure.com/StorerSistemas project=StorerHR

ORG="https://dev.azure.com/StorerSistemas"
PROJECT="StorerHR"
AREA="Storer\\HR"

# Criar Epic
EPIC_ID=$(az boards work-item create \
  --type "Epic" \
  --title "Storer Ponto Extension — Extensão de Navegador para Registro de Ponto" \
  --org "$ORG" --project "$PROJECT" \
  --fields "System.AreaPath=$AREA" "Microsoft.VSTS.Scheduling.StoryPoints=36" \
  --query id -o tsv)
echo "Epic criado: $EPIC_ID"

# Criar Feature 1
F1_ID=$(az boards work-item create \
  --type "Feature" \
  --title "Autenticação via Zitadel OIDC com PKCE" \
  --org "$ORG" --project "$PROJECT" \
  --fields "System.AreaPath=$AREA" \
  --query id -o tsv)

az boards work-item relation add \
  --id "$F1_ID" --relation-type "System.LinkTypes.Hierarchy-Reverse" \
  --target-id "$EPIC_ID" --org "$ORG"

echo "Feature 1 criada: $F1_ID"
# ... repetir para demais Features e PBIs
```

---

*Board: Azure DevOps — Storer Sistemas — Projeto: StorerHR*
