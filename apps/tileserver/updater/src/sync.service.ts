import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import child_process from 'node:child_process';
import util from 'node:util';

export interface SyncConfig {
  dataDir: string;
  pbfUrl: string;
  md5Url: string;
  terrainUrl: string;
}

export class SyncService {
  private config: SyncConfig;
  private execP = util.promisify(child_process.exec);

  constructor(config: SyncConfig) {
    this.config = config;
  }

  /**
   * Checks if the remote OSM map has been updated.
   * Returns true if an update is needed.
   */
  async checkUpdateNeeded(): Promise<boolean> {
    const remoteResponse = await fetch(this.config.md5Url);
    if (!remoteResponse.ok) {
      throw new Error(`Failed to fetch MD5: ${remoteResponse.statusText}`);
    }
    const remoteText = await remoteResponse.text();
    const remoteMd5 = remoteText.split(' ')[0].trim();

    try {
      const localMd5 = await fs.readFile(
        path.join(this.config.dataDir, 'portugal-latest.osm.pbf.md5'),
        'utf-8'
      );
      
      // Also verify that the final mbtiles file actually exists
      try {
        await fs.access(path.join(this.config.dataDir, 'portugal.mbtiles'));
        
        if (localMd5.trim() === remoteMd5) {
          return false;
        }
      } catch (e) {
        console.log('portugal.mbtiles missing, forcing update.');
      }
    } catch (e: any) {
      if (e.code !== 'ENOENT') {
        throw e;
      }
    }

    this.remoteMd5Cache = remoteMd5;
    return true;
  }

  private remoteMd5Cache?: string;

  /**
   * Downloads the latest PBF file and saves the MD5 hash.
   */
  async downloadPbf(md5?: string): Promise<void> {
    const hash = md5 || this.remoteMd5Cache;
    const pbfResponse = await fetch(this.config.pbfUrl);
    if (!pbfResponse.ok || !pbfResponse.body) {
      throw new Error(`Failed to download PBF: ${pbfResponse.statusText}`);
    }

    const pbfPath = path.join(this.config.dataDir, 'portugal-latest.osm.pbf');
    await this.streamToFile(pbfResponse.body as any, pbfPath);

    if (hash) {
      await fs.writeFile(
        path.join(this.config.dataDir, 'portugal-latest.osm.pbf.md5'),
        hash
      );
    }
  }

  /**
   * Runs Planetiler to generate vector tiles (.mbtiles) from the PBF.
   */
  async generateTiles(): Promise<void> {
    const dataDir = path.resolve(this.config.dataDir);
    const volumeName = process.env.OSM_VOLUME_NAME || dataDir;
    // Planetiler docker command
    const cmd = `docker run --rm -v "${volumeName}:/data" ghcr.io/onthegomap/planetiler:latest --download --osm-path=/data/portugal-latest.osm.pbf --output=/data/output.mbtiles --force`;
    console.log(`Running: ${cmd}`);
    await this.execP(cmd);
  }

  /**
   * Renames the newly generated tiles file atomically to the final name
   * served by the tile server.
   */
  async publishTiles(): Promise<void> {
    const source = path.join(this.config.dataDir, 'output.mbtiles');
    const dest = path.join(this.config.dataDir, 'portugal.mbtiles');
    await fs.rename(source, dest);
    
    // Restart tileserver so it picks up the new SQLite database file
    try {
      console.log('Restarting tileserver container...');
      // Try restarting both dev and prod container names
      await this.execP('docker restart ecobairro-tileserver-1 || docker restart ecobairro-prod-tileserver-1');
      console.log('Tileserver restarted successfully.');
    } catch (e) {
      console.error('Failed to restart tileserver. It may continue serving old data.', e);
    }
  }

  /**
   * Checks for the pre-computed terrain RGB mbtiles.
   * If it doesn't exist, downloads it.
   */
  async checkTerrain(): Promise<void> {
    const terrainPath = path.join(this.config.dataDir, 'portugal-terrain.mbtiles');
    try {
      await fs.access(terrainPath);
      // Exists, skip download
      return;
    } catch {
      // Does not exist, download it
    }

    console.log('Downloading 3D Terrain RGB...');
    const response = await fetch(this.config.terrainUrl);
    if (!response.ok || !response.body) {
      throw new Error(`Failed to download Terrain: ${response.statusText}`);
    }
    await this.streamToFile(response.body as any, terrainPath);
  }

  /**
   * Helper to write web stream to file
   */
  private async streamToFile(stream: ReadableStream, filePath: string): Promise<void> {
    const fileStream = createWriteStream(filePath);
    // Node 20 fetch body is a ReadableStream which can be converted to async iterator or pipelined
    // @ts-ignore Node 20 pipeline supports web streams
    await pipeline(stream, fileStream);
  }

  /**
   * Main execution flow
   */
  async run(): Promise<void> {
    await fs.mkdir(this.config.dataDir, { recursive: true });

    const needsUpdate = await this.checkUpdateNeeded();
    if (!needsUpdate) {
      console.log('Map is already up-to-date.');
      return;
    }

    console.log('Update found. Downloading PBF...');
    await this.downloadPbf();

    console.log('Generating MBTiles with Planetiler...');
    await this.generateTiles();

    console.log('Publishing new map...');
    await this.publishTiles();

    console.log('Update complete!');
  }
}
