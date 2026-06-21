# AUTH module (`/api/v1/auth`)

## Estrutura do diretório

```text
auth/
  auth.module.ts
  auth.controller.ts
  auth.service.ts
  auth.types.ts
  current-user.decorator.ts
  jwt-auth.guard.ts
  dto/
    login.dto.ts
    refresh.dto.ts
    register.dto.ts
```

## O que foi realizado

- Endpoint `POST /auth/register` implementado.
- Endpoint `POST /auth/login` implementado.
- Endpoint `POST /auth/refresh` implementado.
- Endpoint `POST /auth/logout` implementado.
- Hash de password com bcrypt.
- Sessão de refresh token em Redis (`user:session:{user_id}`).
- Guard JWT funcional (`JwtAuthGuard`).

## O que falta realizar

- Verificação de email.
- Forgot/reset password.
- 2FA.
- Estratégia de múltiplas sessões por utilizador (atualmente é 1 sessão ativa por user).

## O que não fazer

- Não mover regra de negócio para controller.
- Não aceitar campos fora de DTO (manter validação global ativa).
- Não quebrar formato dos contratos sem atualizar `packages/contracts`.
- Não remover normalização de email para lowercase.

## Linkagens para módulos utilizados

- `../database` (Prisma)
- `../redis` (sessões)
- `../cidadaos` (perfil cidadão criado no registo)
- `../../../../packages/contracts/src/index.ts` (tipos request/response)
- `../../../../docs/08-api-implementation-playbook.md` (guia backend)
