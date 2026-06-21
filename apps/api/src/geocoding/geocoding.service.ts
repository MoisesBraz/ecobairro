import { Inject, Injectable } from '@nestjs/common';
import type { GeocodeResult } from '@ecobairro/contracts';
import { RedisService } from '../redis/redis.service';
import { serviceUnavailable } from '../common/errors';

/**
 * Pesquisa de moradas/ruas em Portugal, via Nominatim (OSM).
 *
 * Respeita a usage policy do Nominatim público: User-Agent identificável,
 * resultados em cache (Redis) para não martelar o serviço.
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 dias
const NOMINATIM_TIMEOUT_MS = 5000;
const MIN_QUERY_LENGTH = 3;
const USER_AGENT =
  'ecoBairro/1.0 (plataforma municipal de reciclagem; contacto: no-reply@ecobairro.local)';

interface NominatimItem {
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    road?: string;
    pedestrian?: string;
    postcode?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
  };
}

@Injectable()
export class GeocodingService {
  private readonly redis: RedisService;

  constructor(@Inject(RedisService) redis: RedisService) {
    this.redis = redis;
  }

  async search(rawQuery: string): Promise<GeocodeResult[]> {
    const query = rawQuery.trim();
    if (query.length < MIN_QUERY_LENGTH) return [];

    const cacheKey = `geocode:${query.toLowerCase()}`;
    const cached = await this.redis.getClient().get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as GeocodeResult[];
    }

    const url = new URL(NOMINATIM_URL);
    url.searchParams.set('q', `${query}, Portugal`);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', '6');
    url.searchParams.set('countrycodes', 'pt');

    let items: NominatimItem[];
    try {
      const res = await fetch(url.toString(), {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(NOMINATIM_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`Nominatim ${res.status}`);
      items = (await res.json()) as NominatimItem[];
    } catch {
      throw serviceUnavailable(
        'SERVICE_UNAVAILABLE',
        'O serviço de pesquisa de moradas está indisponível. Tente novamente.',
      );
    }

    const results = items.map(toResult);

    // Cacheia mesmo quando vazio — evita repetir pedidos ao Nominatim.
    await this.redis
      .getClient()
      .set(cacheKey, JSON.stringify(results), 'EX', CACHE_TTL_SECONDS);

    return results;
  }
}

function toResult(it: NominatimItem): GeocodeResult {
  const a = it.address ?? {};
  return {
    lat: Number.parseFloat(it.lat),
    lng: Number.parseFloat(it.lon),
    label: it.display_name,
    rua: a.road ?? a.pedestrian ?? null,
    codigo_postal: a.postcode ?? null,
  };
}
