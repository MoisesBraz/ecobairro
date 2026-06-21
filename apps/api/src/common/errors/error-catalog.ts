import { HttpStatus } from '@nestjs/common';
import type { ApiErrorCode } from '@ecobairro/contracts';

interface CatalogEntry {
  status: number;
  message: string;
}

/**
 * Fonte de verdade das mensagens de erro mostradas ao utilizador.
 *
 * Todas em PT, amigáveis e sem jargão técnico. O frontend mostra estas
 * mensagens diretamente (e pode ramificar por `code`). Mensagens dinâmicas
 * (ex.: lockout com minutos) são passadas explicitamente ao criar a exceção.
 */
export const ERROR_CATALOG: Record<ApiErrorCode, CatalogEntry> = {
  // Autenticação / sessão
  AUTH_UNAUTHENTICATED: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Sessão inválida ou expirada. Inicie sessão novamente.',
  },
  AUTH_SESSION_REVOKED: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'A sua sessão foi terminada. Inicie sessão novamente.',
  },
  AUTH_INVALID_GOOGLE_TOKEN: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Token do Google inválido ou expirado.',
  },
  AUTH_INVALID_GOOGLE_CLIENT: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Token do Google não pertence a esta aplicação.',
  },
  AUTH_INVALID_CREDENTIALS: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Email ou password incorrectos.',
  },
  AUTH_EMAIL_NOT_VERIFIED: {
    status: HttpStatus.FORBIDDEN,
    message: 'Confirme o seu email antes de iniciar sessão. Verifique a sua caixa de entrada.',
  },
  AUTH_ACCOUNT_LOCKED: {
    status: HttpStatus.FORBIDDEN,
    message: 'Conta bloqueada temporariamente por demasiadas tentativas. Tente novamente mais tarde.',
  },
  AUTH_EMAIL_TAKEN: {
    status: HttpStatus.CONFLICT,
    message: 'Este email já está registado.',
  },
  AUTH_INVALID_VERIFICATION: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Ligação de verificação inválida ou expirada.',
  },
  AUTH_INVALID_RESET_TOKEN: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Ligação de recuperação inválida ou expirada. Peça uma nova.',
  },
  AUTH_PASSWORD_INCORRECT: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Password incorrecta.',
  },
  AUTH_2FA_EXPIRED: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Sessão de verificação em dois passos expirada. Inicie sessão novamente.',
  },
  AUTH_2FA_INVALID: {
    status: HttpStatus.UNAUTHORIZED,
    message: 'Código de verificação inválido.',
  },
  AUTH_2FA_ALREADY_ENABLED: {
    status: HttpStatus.BAD_REQUEST,
    message: 'A verificação em dois passos já está activada.',
  },
  // Autorização
  FORBIDDEN: {
    status: HttpStatus.FORBIDDEN,
    message: 'Não tem permissão para esta acção.',
  },
  // Recurso não encontrado
  NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'O recurso pedido não foi encontrado.',
  },
  REPORT_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'Reporte não encontrado.',
  },
  ECOPONTO_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'Ecoponto não encontrado.',
  },
  USER_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'Utilizador não encontrado.',
  },
  CITIZEN_PROFILE_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'Perfil de cidadão não encontrado.',
  },
  // Conflito
  CONFLICT: {
    status: HttpStatus.CONFLICT,
    message: 'Já existe um registo com estes dados.',
  },
  ECOPONTO_ALREADY_FAVORITE: {
    status: HttpStatus.CONFLICT,
    message: 'Este ecoponto já está nos seus favoritos.',
  },
  // Gamificação / quiz
  QUIZ_OPT_IN_REQUIRED: {
    status: HttpStatus.FORBIDDEN,
    message: 'Ative a gamificação para jogar o quiz.',
  },
  QUIZ_UNAVAILABLE: {
    status: HttpStatus.NOT_FOUND,
    message: 'Não há nenhum quiz disponível de momento.',
  },
  QUIZ_SESSION_NOT_FOUND: {
    status: HttpStatus.NOT_FOUND,
    message: 'Sessão de quiz inválida ou expirada. Comece um novo quiz.',
  },
  // Genéricos
  VALIDATION_ERROR: {
    status: HttpStatus.BAD_REQUEST,
    message: 'Dados inválidos. Verifique os campos e tente novamente.',
  },
  RATE_LIMITED: {
    status: HttpStatus.TOO_MANY_REQUESTS,
    message: 'Demasiadas tentativas. Tente novamente mais tarde.',
  },
  SERVICE_UNAVAILABLE: {
    status: HttpStatus.SERVICE_UNAVAILABLE,
    message: 'Serviço indisponível neste momento. Tente novamente daqui a pouco.',
  },
  INTERNAL: {
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    message: 'Serviço indisponível neste momento. Tente novamente daqui a pouco.',
  },
};
