import 'dotenv/config';

function num(name: string, fallback: number): number {
  const v = process.env[name];
  const n = v === undefined ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  geminiApiKey: process.env.GEMINI_API_KEY ?? '',
  primaryModel: process.env.PRIMARY_MODEL ?? 'gemini-2.5-flash-lite',
  escalationModel: process.env.ESCALATION_MODEL ?? 'gemini-2.5-flash',
  confidenceThreshold: num('CONFIDENCE_THRESHOLD', 0.8),
  flushIntervalMs: num('FLUSH_INTERVAL_MS', 10 * 60 * 1000),
  maxBatchSize: num('MAX_BATCH_SIZE', 25),
  dbPath: process.env.DB_PATH ?? './classmate.db',
  apiPort: num('API_PORT', 4000),
  source: process.env.SOURCE ?? 'baileys',
  baileysAuthDir: process.env.BAILEYS_AUTH_DIR ?? './baileys-auth',
  timezone: 'Africa/Nairobi',
};
