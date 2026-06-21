import { Body, Controller, HttpCode, HttpStatus, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import { unauthorized } from '../common/errors';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type {
  AuthMeResponse,
  ForgotPasswordResponse,
  LoginResponse,
  RegisterResponse,
} from '@ecobairro/contracts';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import type { AuthenticatedUser } from './auth.types';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerifyTwoFactorDto } from './dto/verify-two-factor.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { buildRequestContext } from '../security/request-context.helper';

/** Janela de throttle para endpoints sensíveis (login, 2FA). */
const AUTH_THROTTLE_TTL_MS = 15 * 60 * 1000; // 15 min
const AUTH_THROTTLE_LIMIT = 10;

/** Duração do cookie de refresh token (igual ao TTL do token). */
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

@Controller('auth')
export class AuthController {
  private readonly authService: AuthService;

  constructor(@Inject(AuthService) authService: AuthService) {
    this.authService = authService;
  }

  @Post('register')
  register(
    @Body() body: RegisterDto,
    @Req() req: Request,
  ): Promise<RegisterResponse> {
    return this.authService.register(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: AUTH_THROTTLE_TTL_MS, limit: AUTH_THROTTLE_LIMIT } })
  async login(
    @Body() body: LoginDto, 
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ): Promise<LoginResponse> {
    const response = await this.authService.login(body, buildRequestContext(req));
    if (response.refresh_token) {
      this.setRefreshCookie(res, response.refresh_token);
      response.refresh_token = ''; // prevent leaking in JSON
    }
    return response;
  }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: AUTH_THROTTLE_TTL_MS, limit: AUTH_THROTTLE_LIMIT } })
  async googleLogin(
    @Body() body: GoogleLoginDto, 
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ): Promise<LoginResponse> {
    const response = await this.authService.googleLogin(body, buildRequestContext(req));
    if (response.refresh_token) {
      this.setRefreshCookie(res, response.refresh_token);
      response.refresh_token = ''; // prevent leaking in JSON
    }
    return response;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() body: RefreshDto, 
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ): Promise<LoginResponse> {
    const token = body.refresh_token || req.cookies?.refresh_token;
    if (!token) {
      throw unauthorized('AUTH_UNAUTHENTICATED');
    }
    const response = await this.authService.refresh({ refresh_token: token }, buildRequestContext(req));
    if (response.refresh_token) {
      this.setRefreshCookie(res, response.refresh_token);
      response.refresh_token = '';
    }
    return response;
  }

  @Post('verify-2fa')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: AUTH_THROTTLE_TTL_MS, limit: AUTH_THROTTLE_LIMIT } })
  async verifyTwoFactor(
    @Body() body: VerifyTwoFactorDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ): Promise<LoginResponse> {
    const response = await this.authService.verifyTwoFactor(body, buildRequestContext(req));
    if (response.refresh_token) {
      this.setRefreshCookie(res, response.refresh_token);
      response.refresh_token = '';
    }
    return response;
  }

  @Post('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  me(@CurrentUser() user: AuthenticatedUser): Promise<AuthMeResponse> {
    return this.authService.me(user.userId);
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() body: ForgotPasswordDto): Promise<ForgotPasswordResponse> {
    return this.authService.forgotPassword(body);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(@Body() body: ResetPasswordDto): Promise<void> {
    await this.authService.resetPassword(body);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.NO_CONTENT)
  async verifyEmail(@Body() body: VerifyEmailDto): Promise<void> {
    await this.authService.verifyEmail(body.token);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resendVerification(@Body() body: ForgotPasswordDto): Promise<void> {
    await this.authService.resendVerificationEmail(body.email);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ): Promise<void> {
    await this.authService.logout(user.userId, buildRequestContext(req));
    res.clearCookie('refresh_token');
  }

  private setRefreshCookie(res: Response, token: string) {
    res.cookie('refresh_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    });
  }
}
