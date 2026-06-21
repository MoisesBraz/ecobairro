import { Controller, Get, HttpStatus, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { ServiceHealthPayload } from '@ecobairro/contracts';
import { HealthService } from './health.service';

@Controller()
export class HealthController {
  constructor(
    @Inject(HealthService)
    private readonly healthService: HealthService,
  ) {}

  @Get('health')
  health(): ServiceHealthPayload {
    return {
      service: 'api',
      status: 'ok',
      timestamp: new Date().toISOString(),
      dependencies: [],
    };
  }

  @Get('ready')
  async ready(
    @Res({ passthrough: true }) response: Response,
  ): Promise<ServiceHealthPayload> {
    const dependencies = await this.healthService.checkDependencies();
    const status = dependencies.every((dependency) => dependency.status === 'up')
      ? 'ok'
      : 'error';

    if (status !== 'ok') {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
    }

    return {
      service: 'api',
      status,
      timestamp: new Date().toISOString(),
      dependencies,
    };
  }
}
