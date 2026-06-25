import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { readNumberEnv } from '@ecobairro/config';

export type MailTemplate =
  | 'password-reset'
  | 'email-verification'
  | 'welcome'
  | 'account-locked'
  | 'new-device-login'
  | 'two-factor-code'
  | 'partilha-interesse';

const TEMPLATES_DIR = join(__dirname, 'templates');

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private mailer: Transporter | null = null;
  private readonly cache = new Map<string, string>();

  private readonly smtpHost = process.env.SMTP_HOST?.trim();
  private readonly smtpPort = readNumberEnv('SMTP_PORT', 587);
  private readonly smtpUser = process.env.SMTP_USER?.trim();
  private readonly smtpPass = process.env.SMTP_PASS;
  private readonly smtpFrom = process.env.SMTP_FROM?.trim() ?? 'no-reply@ecobairro.local';
  private readonly smtpSecure = (process.env.SMTP_SECURE ?? 'false') === 'true';
  private readonly appBaseUrl = (process.env.APP_BASE_URL ?? 'http://localhost:8080').replace(/\/$/, '');

  async send(
    template: MailTemplate,
    options: {
      to: string;
      subject: string;
      variables: Record<string, string | number>;
    },
  ): Promise<void> {
    if (!this.smtpHost) {
      this.logger.warn(
        `SMTP_HOST não configurado — email "${template}" para ${options.to} foi suprimido.`,
      );
      return;
    }

    const rawVars: Record<string, string | number> = {
      ...options.variables,
      subject: options.subject,
      year: new Date().getFullYear(),
      logoUrl: `${this.appBaseUrl}/favicon.svg`,
      appBaseUrl: this.appBaseUrl,
    };

    // Escape all variables before HTML injection to prevent XSS via user-supplied values.
    const htmlVars = Object.fromEntries(
      Object.entries(rawVars).map(([k, v]) => [k, MailService.htmlEscape(String(v))]),
    );

    const innerHtml = this.render(`${template}.html`, htmlVars);
    // body is already-rendered HTML — must NOT be escaped a second time.
    const layout = this.render('layout.html', { ...htmlVars, body: innerHtml });
    const text = this.render(`${template}.txt`, rawVars);

    await this.getMailer().sendMail({
      from: this.smtpFrom,
      to: options.to,
      subject: options.subject,
      text,
      html: layout,
    });
  }

  private static htmlEscape(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private render(file: string, vars: Record<string, string | number>): string {
    let tpl = this.cache.get(file);
    if (!tpl) {
      tpl = readFileSync(join(TEMPLATES_DIR, file), 'utf8');
      this.cache.set(file, tpl);
    }
    return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) =>
      key in vars ? String(vars[key]) : '',
    );
  }

  private getMailer(): Transporter {
    if (this.mailer) return this.mailer;

    const transport: {
      host: string;
      port: number;
      secure: boolean;
      auth?: { user: string; pass: string };
    } = {
      host: this.smtpHost!,
      port: this.smtpPort,
      secure: this.smtpSecure,
    };

    if (this.smtpUser && this.smtpPass) {
      transport.auth = { user: this.smtpUser, pass: this.smtpPass };
    }

    this.mailer = nodemailer.createTransport(transport);
    return this.mailer;
  }
}
