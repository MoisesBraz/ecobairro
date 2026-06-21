import { UserRole } from '@prisma/client';
import type { AdminRoleOption } from '@ecobairro/contracts';

/**
 * Fonte única de verdade para o mapeamento de papéis entre o enum `UserRole`
 * da base de dados (MAIÚSCULAS) e os valores em minúsculas usados nos
 * contratos/API e no frontend.
 */
export const DB_ROLE_LABEL: Record<UserRole, string> = {
  CIDADAO:  'cidadao',
  OPERADOR: 'operador',
  GESTOR:   'gestor',
  ADMIN:    'admin',
};

/** Converte um valor em minúsculas para o enum `UserRole`; `undefined` se inválido. */
export function roleFromString(s: string): UserRole | undefined {
  const map: Record<string, UserRole> = {
    cidadao:  UserRole.CIDADAO,
    operador: UserRole.OPERADOR,
    gestor:   UserRole.GESTOR,
    admin:    UserRole.ADMIN,
  };
  return map[s];
}

/**
 * Lista ordenada de papéis (valor + label PT) servida em `GET /v1/admin/roles`
 * e usada para alimentar os selects do frontend. Derivada do enum `UserRole`,
 * por isso fica sempre alinhada com o schema da base de dados.
 */
export const ROLE_OPTIONS: AdminRoleOption[] = [
  { value: 'cidadao',  label: 'Cidadão'       },
  { value: 'operador', label: 'Operador'      },
  { value: 'gestor',   label: 'Gestor'        },
  { value: 'admin',    label: 'Administrador' },
];

/** Valores de papel válidos (minúsculas) — útil para validação `@IsIn`. */
export const ROLE_VALUES: string[] = ROLE_OPTIONS.map((r) => r.value);
