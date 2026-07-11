import { config } from './config.js';
import type { MessageSource } from './types.js';
import { BaileysSource } from './sources/baileys.js';
import { ChatExportSource } from './sources/chatExport.js';
import { MessageBuffer } from './pipeline/buffer.js';
import { Extractor } from './pipeline/extractor.js';
import { GeminiClient } from './pipeline/llm.js';
import { Store } from './store/db.js';
import { ConsoleNotifier } from './notify/notifier.js';

async function main(): Promise<void> {
  if (!config.geminiApiKey) {
    console.error('GEMINI_API_KEY is not set. Copy .env.example to .env and fill it in.');
    process.exit(1);
  }

  const store = new Store(config.dbPath);
  const notifier = new ConsoleNotifier();
  const extractor = new Extractor({
    primary: new GeminiClient(config.primaryModel, config.geminiApiKey),
    escalation: new GeminiClient(config.escalationModel, config.geminiApiKey),
    confidenceThreshold: config.confidenceThreshold,
  });

  const buffer = new MessageBuffer({
    flushIntervalMs: config.flushIntervalMs,
    maxBatchSize: config.maxBatchSize,
    onFlush: async (groupId, messages) => {
      console.log(`[pipeline] extracting batch of ${messages.length} messages from ${groupId}`);
      try {
        const result = await extractor.extract(messages);
        for (const event of result.events) {
          store.saveEvent(groupId, event, result.model);
          await notifier.eventDetected(groupId, event, result.escalated);
        }
        if (result.events.length === 0) {
          console.log('[pipeline] no academic events in this batch');
        }
      } catch (err) {
        console.error('[pipeline] extraction failed for batch:', err);
      }
    },
  });

  // --replay <file> [groupId]: run a WhatsApp chat export through the pipeline
  const replayIdx = process.argv.indexOf('--replay');
  let source: MessageSource;
  if (replayIdx !== -1) {
    const file = process.argv[replayIdx + 1];
    if (!file) {
      console.error('Usage: npm run replay -- <export.txt> [groupId]');
      process.exit(1);
    }
    source = new ChatExportSource(file, process.argv[replayIdx + 2] ?? 'replay-group');
  } else {
    source = new BaileysSource(config.baileysAuthDir);
  }

  source.onMessage((msg) => {
    if (store.markSeen(msg.sourceMessageId, msg.groupId)) return; // duplicate
    buffer.add(msg);
  });

  console.log(`[classmate] starting source: ${source.name}`);
  await source.start();

  if (replayIdx !== -1) {
    // Replay mode: everything is emitted synchronously; flush and print results.
    await buffer.flushAll();
    console.log('\n=== Active events after replay ===');
    for (const e of store.activeEvents()) {
      console.log(`- [${e.type}] ${e.title} | ${e.course ?? '—'} | ${e.datetime ?? 'no date'} | ${e.venue ?? 'no venue'}`);
    }
    store.close();
    return;
  }

  const shutdown = async () => {
    console.log('\n[classmate] shutting down…');
    await buffer.flushAll();
    await source.stop();
    store.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Health heartbeat: silence may mean a dead session, not a quiet group.
  setInterval(() => {
    const h = source.health();
    if (!h.connected) console.warn('[health] source disconnected');
  }, 60_000).unref();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
