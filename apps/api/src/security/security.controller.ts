import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import type {
  ActiveSessionRecord,
  ListActiveSessionsResponse,
  ListSecurityLogsResponse,
} from '@ecobairro/contracts';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { SecurityService } from './security.service';
import { SessionService } from './session.service';
import { parsePagination } from '../common/pagination';

class PageQuery {
  page?: number;
  pageSize?: number;
}

interface ActiveSessionListRow {
  id: string;
  ipAddress: string;
  userAgent: string | null;
  criadoEm: Date;
  expiresAt: Date;
}

interface SecurityLogListRow {
  id: string;
  event: string;
  ipAddress: string;
  userAgent: string | null;
  criadoEm: Date;
}

@Controller('security')
@UseGuards(JwtAuthGuard)
export class SecurityController {
  private readonly security: SecurityService;
  private readonly session: SessionService;

  constructor(
    @Inject(SecurityService) security: SecurityService,
    @Inject(SessionService) session: SessionService,
  ) {
    this.security = security;
    this.session = session;
  }

  // ─── Sessões activas ──────────────────────────────────────────────────────

  @Get('sessions')
  async listSessions(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ListActiveSessionsResponse> {
    const sessions = await this.session.list(user.userId);
    const mapped: ActiveSessionRecord[] = (sessions as ActiveSessionListRow[]).map((s) => {
      const parsed = parseUserAgent(s.userAgent);

      return {
        id: s.id,
        ip_address: s.ipAddress,
        user_agent: s.userAgent ?? null,
        device: parsed.device,
        browser: parsed.browser,
        os: parsed.os,
        criado_em: s.criadoEm.toISOString(),
        expires_at: s.expiresAt.toISOString(),
        current: s.id === user.sessionId,
      };
    });
    return { sessions: mapped };
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) sessionId: string,
  ): Promise<void> {
    const removed = await this.session.revoke(user.userId, sessionId);
    // Só marca a revogação imediata (Redis) se a sessão era mesmo deste user.
    if (removed) {
      await this.security.revokeSession(sessionId);
    }
  }

  @Delete('sessions')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeAllSessions(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.session.revokeAll(user.userId);
    await this.security.revokeUser(user.userId);
  }

  // ─── Histórico de segurança ───────────────────────────────────────────────

  @Get('logs')
  async listLogs(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: PageQuery,
  ): Promise<ListSecurityLogsResponse> {
    const { page, pageSize } = parsePagination(query.page, query.pageSize);
    const { rows, total } = await this.security.listLogs(
      user.userId,
      page,
      pageSize,
    );
    return {
      logs: (rows as SecurityLogListRow[]).map((r) => ({
        id: r.id,
        event: r.event as ListSecurityLogsResponse['logs'][number]['event'],
        ip_address: r.ipAddress,
        user_agent: r.userAgent ?? null,
        criado_em: r.criadoEm.toISOString(),
      })),
      page,
      pageSize,
      total,
    };
  }
}

function parseUserAgent(userAgent: string | null): Pick<ActiveSessionRecord, 'device' | 'browser' | 'os'> {
  if (!userAgent) {
    return { device: null, browser: null, os: null };
  }

  const browser = parseBrowser(userAgent);
  const os = parseOperatingSystem(userAgent);
  const device = parseDevice(userAgent);

  return { device, browser, os };
}

function parseBrowser(userAgent: string): string | null {
  const browserRules: Array<[RegExp, string]> = [
    [/Edg\/([\d.]+)/, 'Microsoft Edge'],
    [/OPR\/([\d.]+)/, 'Opera'],
    [/Firefox\/([\d.]+)/, 'Mozilla Firefox'],
    [/Chrome\/([\d.]+)/, 'Google Chrome'],
    [/Version\/([\d.]+).*Safari/, 'Safari'],
    [/Safari\/([\d.]+)/, 'Safari'],
  ];

  for (const [regex, name] of browserRules) {
    const match = userAgent.match(regex);
    if (match?.[1]) return `${name} ${majorVersion(match[1])}`;
  }

  return null;
}

function parseOperatingSystem(userAgent: string): string | null {
  const osRules: Array<[RegExp, string]> = [
    [/Windows NT 10/, 'Windows 10/11'],
    [/Windows NT ([\d.]+)/, 'Windows'],
    [/Mac OS X ([\d_]+)/, 'macOS'],
    [/Android ([\d.]+)/, 'Android'],
    [/(iPhone|iPad).*OS ([\d_]+)/, 'iOS'],
    [/Linux/, 'Linux'],
  ];

  for (const [regex, name] of osRules) {
    const match = userAgent.match(regex);
    if (!match) continue;
    const version = match[2] ?? match[1];
    if (!version || version.includes('Windows')) return name;
    return `${name} ${version.replace(/_/g, '.')}`;
  }

  return null;
}

function parseDevice(userAgent: string): string | null {
  if (/iPad/i.test(userAgent)) return 'Tablet';
  if (/iPhone|Android.*Mobile/i.test(userAgent)) return 'Telemóvel';
  if (/Android/i.test(userAgent)) return 'Tablet';
  if (/Macintosh|Windows|Linux/i.test(userAgent)) return 'Computador';
  return null;
}

function majorVersion(version: string): string {
  return version.split('.')[0] ?? version;
}
