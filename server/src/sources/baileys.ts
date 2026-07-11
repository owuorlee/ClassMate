import { makeWASocket, useMultiFileAuthState, DisconnectReason, type WASocket, type proto } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import type { IncomingMessage, MessageHandler, MessageSource, SourceHealth } from '../types.js';

/**
 * The ONLY file in the system that knows WhatsApp exists.
 *
 * Ban-risk posture (see docs/WHATSAPP_INGESTION_RISK.md):
 *  - PURE LISTENER. This adapter must never grow a send/reply capability.
 *  - No presence updates, no "online" broadcasting, no read receipts.
 *  - Session credentials in authDir are secrets: never log, never commit.
 */
export class BaileysSource implements MessageSource {
  readonly name = 'baileys';
  private handlers: MessageHandler[] = [];
  private sock?: WASocket;
  private connected = false;
  private stopping = false;
  private lastMessageAt?: Date;
  private reconnectDelayMs = 2_000;

  constructor(private readonly authDir: string) {}

  async start(): Promise<void> {
    this.stopping = false;
    await this.connect();
  }

  private async connect(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState(this.authDir);

    const sock = makeWASocket({
      auth: state,
      // Passive posture: do not announce ourselves as online on connect.
      markOnlineOnConnect: false,
      syncFullHistory: false,
    });
    this.sock = sock;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('\nScan this QR with the bot phone (WhatsApp > Linked Devices):\n');
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'open') {
        this.connected = true;
        this.reconnectDelayMs = 2_000;
        console.log('[baileys] connected');
      }

      if (connection === 'close') {
        this.connected = false;
        const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;
        console.warn(`[baileys] connection closed (status ${statusCode ?? 'unknown'})`);

        if (loggedOut) {
          // Banned number or manual unlink: a human must re-link a (new) number.
          console.error('[baileys] session logged out — re-link required. NOT retrying.');
          return;
        }
        if (!this.stopping) {
          const delay = this.reconnectDelayMs;
          this.reconnectDelayMs = Math.min(this.reconnectDelayMs * 2, 5 * 60_000);
          console.warn(`[baileys] reconnecting in ${Math.round(delay / 1000)}s`);
          setTimeout(() => void this.connect(), delay);
        }
      }
    });

    sock.ev.on('messages.upsert', ({ messages, type }) => {
      // 'notify' = fresh messages; 'append'/history syncs are handled by
      // ChatExportSource backfill instead, keeping live behavior minimal.
      if (type !== 'notify') return;
      for (const m of messages) {
        const incoming = this.toIncoming(m);
        if (!incoming) continue;
        this.lastMessageAt = incoming.timestamp;
        for (const h of this.handlers) h(incoming);
      }
    });
  }

  private toIncoming(m: proto.IWebMessageInfo): IncomingMessage | null {
    const jid = m.key?.remoteJid ?? '';
    // Group messages only — 1:1 chats are none of our business.
    if (!jid.endsWith('@g.us')) return null;
    if (m.key?.fromMe) return null;

    const msg = m.message;
    if (!msg) return null;
    // Text lives in different wrappers depending on message kind; captions
    // on images/docs often carry announcements ("notes za chapter 3" + PDF).
    const text =
      msg.conversation ??
      msg.extendedTextMessage?.text ??
      msg.imageMessage?.caption ??
      msg.videoMessage?.caption ??
      msg.documentMessage?.caption ??
      null;
    if (!text || text.trim() === '') return null;

    const tsSec = typeof m.messageTimestamp === 'number' ? m.messageTimestamp : Number(m.messageTimestamp ?? 0);

    return {
      sourceMessageId: m.key?.id ?? `${jid}:${tsSec}:${Math.random().toString(36).slice(2)}`,
      groupId: jid,
      senderId: m.key?.participant ?? jid,
      senderName: m.pushName ?? undefined,
      text,
      timestamp: new Date(tsSec * 1000),
    };
  }

  async stop(): Promise<void> {
    this.stopping = true;
    this.sock?.end(undefined);
    this.connected = false;
  }

  onMessage(handler: MessageHandler): void {
    this.handlers.push(handler);
  }

  health(): SourceHealth {
    return { connected: this.connected, lastMessageAt: this.lastMessageAt };
  }
}
