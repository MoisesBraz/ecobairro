import type { Request } from 'express';
import type { RequestContext } from './security.service';

/**
 * Extrai IP e User-Agent de um Express Request, com normalização.
 *
 * - IP: prefere `X-Forwarded-For` (atrás de nginx/load balancer),
 *   caso contrário usa `req.ip`. Strip de portos IPv6.
 * - User-Agent: header `user-agent` ou null.
 */
export function buildRequestContext(req: Request): RequestContext {
  const xff = req.header('x-forwarded-for');
  let ip = xff?.split(',')[0]?.trim() || req.ip || 'unknown';
  // Remove prefixo IPv4-mapped IPv6 (::ffff:1.2.3.4 → 1.2.3.4)
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  return {
    ipAddress: ip,
    userAgent: req.header('user-agent') ?? null,
  };
}
