import { Controller, Get, Inject, Query, UseGuards } from '@nestjs/common';
import type { GeocodeSearchResponse } from '@ecobairro/contracts';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GeocodeSearchDto } from './dto/geocode-search.dto';
import { GeocodingService } from './geocoding.service';

@Controller('geocoding')
@UseGuards(JwtAuthGuard)
export class GeocodingController {
  private readonly svc: GeocodingService;
  constructor(@Inject(GeocodingService) svc: GeocodingService) {
    this.svc = svc;
  }

  @Get('search')
  async search(@Query() query: GeocodeSearchDto): Promise<GeocodeSearchResponse> {
    const results = await this.svc.search(query.q);
    return { results };
  }
}
