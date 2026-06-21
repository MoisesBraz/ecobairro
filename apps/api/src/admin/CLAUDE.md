# ADMIN module (`/api/v1/admin`)

Gestão de utilizadores/perfis reservada a administradores. Complementa o
módulo `users` (que só tem `GET /v1/users` para listagem) com as operações de
escrita que o painel de administração do frontend consome.

## Estrutura do diretório

```text
admin/
  admin.module.ts
  admin.controller.ts        # @Controller('admin')
  admin.service.ts
  dto/
    create-user.dto.ts
    update-user-role.dto.ts
```

## O que foi realizado

- `GET /admin/roles` — lista de papéis (`value` + `label`) derivada do enum
  `UserRole`, para alimentar os selects do frontend. Fonte única: `../users/roles.util.ts`.
- `POST /admin/users` — cria utilizador a partir de `{ nome, email, role }`.
  Delega em `AuthService.adminCreateUser`: gera password aleatória, cria o
  `user` (+ `cidadaoPerfil` se `CIDADAO`) e **envia sempre** email ao utilizador
  para este definir a password (reutiliza o fluxo de reset).
- `PATCH /admin/users/:id/role` — altera o papel de um utilizador existente.
- `DELETE /admin/users/:id` — **soft delete anonimizado** + revoga o acesso
  (`SecurityService.revokeUser` + `SessionService.revokeAll`). Numa transação:
  põe `eliminadoEm`, **liberta o email** (reescreve para `anon_<id>@anon.invalid`,
  porque `email` é `@unique` e sem isto a pessoa nunca conseguia voltar a
  registar-se com o email original) e limpa a PII (`passwordHash` inutilizável,
  `phone`/2FA a null, perfil `CidadaoPerfil` sem nome/prefs, `Partilha.autorNome`
  → "Utilizador anónimo"). A linha **nunca** é removida — preserva o histórico
  operacional (`Report`/`Recolha`/`Partilha`) ligado ao user já anónimo. A
  auditoria refere o `id` (não o email) para não reintroduzir PII no log.
- `PATCH /admin/users/:id/reativar` — reativa (`eliminadoEm = null` +
  `SecurityService.clearRevocation`). Caveat: reativa uma conta **já anónima**
  (email = tombstone, password inutilizável → sem login útil). É uma salvaguarda
  administrativa, não um "undo" da anonimização.
- Controlo de acesso ADMIN ao nível do service (`assertAdmin`), seguindo o
  padrão de `UsersService`.
- Auditoria best-effort (`AuditService.write`) em create/update/delete.
- Salvaguardas: o admin não pode alterar o próprio papel nem desativar a
  própria conta (evita lockout).

## O que falta realizar

- Persistir o `nome` para papéis ≠ `CIDADAO` (o schema só tem nome via
  `cidadao_perfis`; atualmente o nome só é guardado quando o papel é `CIDADAO`).
- Template de email dedicado a "convite/definir password" (hoje reutiliza o
  template `password-reset`; a validade do link = `PASSWORD_RESET_TTL_MINUTES`).
- Edição de outros campos do utilizador (email, telefone) pelo admin.
- Paginação/filtros próprios (a listagem continua em `GET /v1/users`).
- Testes unitários do `AdminService`.

## O que não fazer

- Não mover o controlo de acesso ADMIN para fora do service sem manter a
  verificação (não basta o `JwtAuthGuard`, que só valida o token).
- Não remover a revogação no `deactivate` — sem ela o utilizador desativado
  mantém acesso até o access token expirar (`JwtAuthGuard` só bloqueia via
  chave de revogação no Redis).
- Não voltar a fazer hard delete nem deixar de libertar/anonimizar o email no
  `deactivate` — o email é `@unique`; mantê-lo preso impede a pessoa de recriar
  conta com o mesmo email (foi este o bug original).
- Não gravar PII (email/nome originais) na auditoria do delete — usar o `id`.
- Não aceitar valores de papel fora de `ROLE_VALUES` (validado por `@IsIn`).
- Não duplicar o mapeamento de papéis — usar sempre `../users/roles.util.ts`.
- Não deixar a auditoria bloquear a ação principal (manter best-effort).

## Notas

- Casing dos papéis: API/contratos/frontend usam minúsculas (`cidadao`, …);
  a BD usa o enum em maiúsculas (`CIDADAO`, …). A conversão é feita em
  `roles.util.ts` (`roleFromString` / `DB_ROLE_LABEL`).
- `AuthModule` reexporta `SecurityModule`, por isso importar `AuthModule` no
  `AdminModule` dá acesso a `AuthService`, `SecurityService`, `SessionService`
  e `JwtAuthGuard`.

## Linkagens para módulos utilizados

- `../auth` (`AuthService.adminCreateUser`, `JwtAuthGuard`, `CurrentUser`)
- `../security` (revogação de sessões/acesso; `buildRequestContext` para IP)
- `../audit` (`AuditService.write`)
- `../users/roles.util.ts` (mapeamento e lista de papéis)
- `../database` (Prisma)
- `../../../../packages/contracts/src/index.ts` (contratos)
