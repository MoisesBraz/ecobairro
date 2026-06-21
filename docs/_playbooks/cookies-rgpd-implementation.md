# Documentação: Sistema de Gestão de Cookies e Consentimento (RGPD)

## 📌 Visão Geral

Foi desenvolvido um sistema customizado (feito de raiz) na aplicação `web` (`@ecobairro/web`) para a gestão de consentimento de cookies. Este sistema assegura a conformidade total com o **Regulamento Geral sobre a Proteção de Dados (RGPD)** na Europa, sem necessidade de depender de soluções externas (SaaS) como Cookiebot ou OneTrust, reduzindo custos e mantendo 100% de coerência visual.

A solução suporta:
- Bloqueio preventivo de carregamento de *iframes* ou *scripts* não estritamente necessários.
- Registo nativo e envio de sinal (Google Consent Mode v2) de forma automática.
- Personalização de categorias (Essenciais, Analíticos, Marketing/Redes Sociais, Preferências).
- Alteração ou revogação de consentimento fácil a partir do Rodapé (*Footer*).

---

## 📂 Arquitetura e Ficheiros

Toda a implementação ocorreu dentro do pacote Front-End (`apps/web/src/`). Aqui estão os ficheiros principais do sistema e a responsabilidade de cada um:

### 1. Lógica Base e Armazenamento
- **Ficheiro:** `apps/web/src/lib/cookie-consent.ts`
- **Descrição:** Contém a tipagem das categorias (`CookiePreferences`) e as funções responsáveis por gravar ou ler as permissões no `localStorage` do browser do utilizador.
- **Importante:** Inclui a função `initializeGoogleConsentMode()` e `updateGoogleConsentMode()` que injeta nativamente as variáveis `dataLayer` no browser para sinalizar ao Google Analytics e Google Ads se o utilizador aceitou *cookies* de marketing ou análise (Consent Mode v2).

### 2. Contexto de Estado Global (React Context)
- **Ficheiro:** `apps/web/src/components/cookie-consent/CookieConsentProvider.tsx`
- **Descrição:** O *Provider* de React que envolve a aplicação. Verifica se já existe uma escolha guardada. Expõe métodos (`acceptAll`, `rejectAll`, `savePreferences`) e estados para o resto da aplicação consumir usando o *Hook* `useCookieConsent()`.

### 3. Componentes Visuais (Interface)
Foram utilizados os princípios de `shadcn/ui` (Radix UI e Tailwind) para criar os componentes visuais de forma a encaixarem naturalmente no design system.

- **Banner Flutuante:** `apps/web/src/components/cookie-consent/CookieBanner.tsx`
  Aparece no canto inferior direito para utilizadores novos (sem consentimento registado).

- **Modal de Definições:** `apps/web/src/components/cookie-consent/CookieSettingsModal.tsx`
  O modal que se abre ao clicar em "Personalizar" ou "Gerir Cookies". Permite ativar ou desativar categorias específicas. Utiliza os pacotes `@radix-ui/react-dialog` e `@radix-ui/react-switch`.

### 4. Wrapper para Proteção de iFrames
- **Ficheiro:** `apps/web/src/components/cookie-consent/CookieIframe.tsx`
- **Descrição:** Sempre que a equipa precisar de incorporar vídeos (YouTube, Vimeo) ou mapas de terceiros via `<iframe>`, deve importar este componente em vez de usar a tag HTML padrão (`<iframe />`).
- **Como funciona:** Ele avalia se a categoria "Marketing & Redes Sociais" foi aceite. Se sim, carrega o `<iframe />` original. Se não, bloqueia o carregamento para prevenir rastreio não autorizado e apresenta uma caixa a informar o utilizador de que precisa de aceitar os cookies para ver o conteúdo.

### 5. Prova de Consentimento (Audit Trail) - Backend e Base de Dados
Para efeitos de auditoria legal (ex: CNPD), implementámos um registo centralizado das escolhas dos utilizadores, equiparando esta solução às plataformas comerciais:
- **Frontend (`cookie-consent.ts`)**: Gera um `deviceId` anónimo (UUID) e guarda-o no `localStorage`. Sempre que as preferências são guardadas, envia um `POST` para `/v1/cookies/consent`.
- **Backend (`apps/api/src/cookies/`)**: Um módulo NestJS (`CookiesModule`, `CookiesController`, `CookiesService`) que recebe o pedido, ofusca/anonimiza o endereço de IP (`ipHash`) usando criptografia (SHA-256) e guarda a entrada de forma segura.
- **Base de Dados (`schema.prisma`)**: Tabela `CookieConsentLog` (`cookie_consent_logs`) que associa as opções marcadas (`analytics`, `marketing`, `preferences`) ao `deviceId` ou `userId` (caso o cidadão tenha feito login), gravando um registo a cada nova escolha.

---

## 🔗 Integração na Aplicação

O sistema foi inserido em dois pontos cruciais do Router da aplicação para garantir cobertura total:

1. **Injeção Global (`__root.tsx`)**
   - **Local:** `apps/web/src/routes/__root.tsx`
   - **Ação:** O `<Outlet />` principal foi embrulhado no `<CookieConsentProvider>` e foi adicionado ao lado o `<CookieBanner />`. Isto garante que o sistema de cookies corre ativamente quer o utilizador esteja numa página pública ou dentro do painel autenticado.

2. **Atalho de Revogação de Consentimento (`Footers`)**
   - **Requisito RGPD:** É obrigatório fornecer uma forma simples de alterar ou revogar consentimentos a qualquer altura.
   - **Onde:** Foram adicionados botões de **"Gerir Cookies"** nos rodapés.
     - Rodapé Público: `apps/web/src/routes/_layoutpublic.home.tsx` (Função `PublicFooter`)
     - Rodapé do Dashboard: `apps/web/src/components/layout/vertical/FooterContent.tsx`

---

## 🛠️ Como Utilizar no Dia-a-Dia (Guia para Developers)

1. **Adicionar novos trackers/scripts no HTML (`index.html`):**
   Não deve inserir tags `<script src="...">` de Facebook Pixels ou Google Analytics diretamente. Estes devem ser inseridos com validação (ou usando diretamente o Google Tag Manager que passará a respeitar os sinais enviados pelo nosso *Consent Mode v2*).

2. **Embutir Vídeos e Conteúdos Externos:**
   ```tsx
   // ❌ NÂO FAZER ISTO (inicia tracking sem consentimento)
   <iframe src="https://youtube.com/embed/XXXXX" />
   
   // ✅ FAZER ISTO
   import { CookieIframe } from '@/components/cookie-consent/CookieIframe'
   
   <CookieIframe src="https://youtube.com/embed/XXXXX" fallbackText="Vídeo do YouTube" />
   ```

3. **Verificar se tem consentimento antes de correr lógica complexa:**
   ```tsx
   import { useCookieConsent } from '@/components/cookie-consent/CookieConsentProvider'
   
   function AnyComponent() {
     const { preferences } = useCookieConsent()
     
     const onSpecificAction = () => {
        if (preferences?.analytics) {
           // Executar tracking customizado apenas se tiver permissão analítica
        }
     }
   }
   ```
