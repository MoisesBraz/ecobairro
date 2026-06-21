# DEMO ecoBairro — roteiro

## CONTAS

```
CIDADÃO:  cidadao.seed@ecobairro.local
ADMIN:    gestor.seed@ecobairro.local
PASSWORD: Password12345

Web:      http://localhost:8080
Mailpit:  http://localhost:8025
```

## ANTES DA CALL

- `docker compose ps` → 7 healthy
- Abrir separadores: `/login`, `/home` (incógnito), Mailpit (limpo)
- Mailpit "Delete all"

---

## 1. Home pública (incógnito) — 30s

> "Esta é a entrada para quem não tem conta. Notícias e campanhas da câmara, vindas da base de dados."

Click **Login**.

> "Os 9 / 7 / 93% são reais — vêm de um endpoint público que conta ecopontos, cidadãos e taxa de resolução."

## 2. Cidadão — 3 min

Login `cidadao.seed@ecobairro.local`.

**Home:**
> "Banner com pontos calculados no backend a partir dos reports resolvidos."

Click **Mapa de Ecopontos**:
> "9 ecopontos com coordenadas reais de Aveiro."

Click num marker → click **estrela** para favoritar.

Voltar a **Home**:
> "O favorito já aparece. Frontend → API → Postgres → frontend."

Click **Os Meus Reportes** → **Novo Reporte**. Anexar foto, submeter.

> "Aparece na lista com a imagem persistida."

Voltar à home, click atalho **Pedir Recolha**:
> "O modal abre pré-preparado por deep-link no URL."

Premir **Esc**:
> "Esc fecha. Tab fica preso dentro do modal. Focus trap nos seis modais custom."

## 3. Admin — 3 min

Logout → login `gestor.seed@ecobairro.local`.

**Dashboard** — abrir DevTools → Network → refrescar.

> "Um único request ao `/reports/stats`. Antes eram seis. Refactorámos para uma agregação Prisma."

Mudar filtro de estado:
> "Filtra no servidor, não em memória."

Click **CSV** → download.

**Fila de Prioridades:**
> "Tarefas operacionais. Esta página voltava 500 — fixei a injection do NestJS nesta sessão."

**Rotas:**
> "Rotas de recolha desenhadas em Leaflet."

**Utilizadores:**
> "Restrito a admin por route guard. Filtros server-side."

**Auditoria:**
> "Tabela audit_logs no schema, pronta para registar ações sensitivas."

## 4. Resiliência — 1 min

Em terminal:
```bash
docker stop ecobairro-api-1
```

Refrescar dashboard.
> "Banner com aria-live, anunciado a screen readers, botão de retry."

```bash
docker start ecobairro-api-1
```

Esperar 5s, click **Tentar novamente** → recupera.

## 5. Email — 1 min

`/login` → **Esqueceste a password?** → submeter.

Abrir Mailpit.
> "Email com layout HTML completo. Templates em ficheiros separados, não inline. Substituição de variáveis sem dependência externa."

## Fecho — 30s

> "Stack:
> Backend NestJS 11 + Prisma + Postgres + Redis. 38 unit tests.
> Frontend TanStack Router + React 19 + Vite + Tailwind + shadcn/ui. Tipos partilhados num pacote `@ecobairro/contracts`.
> Docker-compose com 7 serviços. Mailpit em dev.
> Acessibilidade: focus trap, role=dialog, aria-live, skip-link. Lint a zero."

---

## PERGUNTAS — respostas curtas

| Q | R |
|---|---|
| Onde guardam imagens? | Base64 no campo de texto. Próximo passo: S3/MinIO. |
| Validação? | DTOs class-validator + ValidationPipe whitelist. |
| Testes frontend? | Só backend. E2E Playwright + Vitest são próximo PR. |
| Passwords? | bcrypt 12 rounds. Tokens hash SHA-256 no Redis. |
| Escala? | Filtros server-side com paginação. Agregação 1-query nos KPIs. Cache em Redis é gap. |
| WCAG? | 2.1.2 e 2.4.3 cumpridos. Contraste AA não auditado. |
| Migrações? | Prisma migrate. |
| Reset password? | Token gerado, hash em Redis com TTL 30min, email com link. |
