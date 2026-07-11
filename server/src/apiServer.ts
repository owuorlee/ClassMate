import { config } from './config.js';
import { Store } from './store/db.js';
import { createApp } from './api/app.js';

const store = new Store(config.dbPath);
const app = createApp(store);

app.listen(config.apiPort, () => {
  console.log(`[api] listening on http://localhost:${config.apiPort} (db: ${config.dbPath})`);
});

function shutdown(): void {
  store.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
