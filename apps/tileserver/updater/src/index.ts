import { SyncService } from './sync.service';

const config = {
  dataDir: process.env.DATA_DIR || '/data',
  pbfUrl: process.env.PBF_URL || 'http://download.geofabrik.de/europe/portugal-latest.osm.pbf',
  md5Url: process.env.MD5_URL || 'http://download.geofabrik.de/europe/portugal-latest.osm.pbf.md5',
  terrainUrl: process.env.TERRAIN_URL || 'https://github.com/onthegomap/planetiler/releases/download/v0.6.0/terrain-rgb.mbtiles',
};

const service = new SyncService(config);

async function main() {
  const intervalHours = parseInt(process.env.CRON_INTERVAL_HOURS || '24', 10);
  const intervalMs = intervalHours * 60 * 60 * 1000;

  console.log(`Starting OSM Updater service. Interval: ${intervalHours} hours.`);

  while (true) {
    try {
      console.log(`[${new Date().toISOString()}] Running sync cycle...`);
      await service.run();
    } catch (err) {
      console.error(`[${new Date().toISOString()}] Failed to update map data:`, err);
    }

    console.log(`[${new Date().toISOString()}] Sleeping for ${intervalHours} hours...`);
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

main();
