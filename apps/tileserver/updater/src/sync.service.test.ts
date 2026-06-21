import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SyncService } from './sync.service';
import fs from 'node:fs/promises';
import child_process from 'node:child_process';
import util from 'node:util';
import path from 'node:path';

// Mock dependencies
vi.mock('node:fs/promises');
vi.mock('node:child_process', () => ({
  default: {
    exec: vi.fn(),
  },
}));

// We use global fetch so we mock it
const originalFetch = global.fetch;

describe('OsmSyncService', () => {
  let syncService: SyncService;

  beforeEach(() => {
    syncService = new SyncService({
      dataDir: '/tmp/osm-data',
      pbfUrl: 'http://download.geofabrik.de/europe/portugal-latest.osm.pbf',
      md5Url: 'http://download.geofabrik.de/europe/portugal-latest.osm.pbf.md5',
      terrainUrl: 'https://example.com/portugal-terrain.mbtiles',
    });
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('checkUpdateNeeded', () => {
    it('returns true if no local MD5 exists', async () => {
      // Mock remote fetch
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('remote-md5-hash  portugal-latest.osm.pbf'),
      } as any);
      // Mock local fs read to fail (file not found)
      vi.mocked(fs.readFile).mockRejectedValue({ code: 'ENOENT' });

      const needed = await syncService.checkUpdateNeeded();
      expect(needed).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith('http://download.geofabrik.de/europe/portugal-latest.osm.pbf.md5');
    });

    it('returns true if remote MD5 differs from local MD5', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('remote-md5-hash  portugal-latest.osm.pbf'),
      } as any);
      vi.mocked(fs.readFile).mockResolvedValue('local-old-md5-hash');

      const needed = await syncService.checkUpdateNeeded();
      expect(needed).toBe(true);
    });

    it('returns false if remote MD5 matches local MD5', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('same-md5-hash  portugal-latest.osm.pbf'),
      } as any);
      vi.mocked(fs.readFile).mockResolvedValue('same-md5-hash');

      const needed = await syncService.checkUpdateNeeded();
      expect(needed).toBe(false);
    });
  });

  describe('downloadPbf', () => {
    it('downloads the pbf file and saves the new md5', async () => {
      const mockStream = {
        body: 'stream data' // In reality it's a ReadableStream, we'll mock the write process
      };
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        body: mockStream,
      } as any);

      vi.mocked(fs.writeFile).mockResolvedValue();
      syncService['streamToFile'] = vi.fn().mockResolvedValue(undefined);

      await syncService.downloadPbf('new-md5-hash');
      
      expect(syncService['streamToFile']).toHaveBeenCalled();
      expect(fs.writeFile).toHaveBeenCalledWith(path.join('/tmp/osm-data', 'portugal-latest.osm.pbf.md5'), 'new-md5-hash');
    });
  });

  describe('generateTiles', () => {
    it('calls planetiler using docker', async () => {
      const execP = vi.fn().mockResolvedValue({ stdout: 'success' });
      syncService['execP'] = execP;

      await syncService.generateTiles();

      expect(execP).toHaveBeenCalled();
      const command = execP.mock.calls[0][0];
      expect(command).toContain('ghcr.io/onthegomap/planetiler');
      expect(command).toContain('portugal-latest.osm.pbf');
    });
  });

  describe('publishTiles', () => {
    it('renames the generated mbtiles atomically', async () => {
      vi.mocked(fs.rename).mockResolvedValue();

      await syncService.publishTiles();

      expect(fs.rename).toHaveBeenCalledWith(
        path.join('/tmp/osm-data', 'output.mbtiles'),
        path.join('/tmp/osm-data', 'portugal.mbtiles')
      );
    });
  });

  describe('checkTerrain', () => {
    it('downloads terrain RGB if it does not exist locally', async () => {
      vi.mocked(fs.access).mockRejectedValue({ code: 'ENOENT' });
      
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        body: 'stream',
      } as any);
      syncService['streamToFile'] = vi.fn().mockResolvedValue(undefined);

      await syncService.checkTerrain();

      expect(syncService['streamToFile']).toHaveBeenCalledWith(
        'stream',
        path.join('/tmp/osm-data', 'portugal-terrain.mbtiles')
      );
    });

    it('skips download if terrain RGB already exists', async () => {
      vi.mocked(fs.access).mockResolvedValue();

      await syncService.checkTerrain();

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
