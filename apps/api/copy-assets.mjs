import { cpSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

try {
  cpSync(
    join(__dirname, 'src', 'mail', 'templates'),
    join(__dirname, 'dist', 'mail', 'templates'),
    { recursive: true }
  );
  console.log('✅ Templates copied to dist successfully.');
} catch (err) {
  console.error('❌ Error copying templates:', err);
  process.exit(1);
}
