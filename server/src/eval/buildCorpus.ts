import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { parseChatExport, detectDateOrder } from '../sources/chatExport.js';
import { Anonymizer } from './anonymize.js';

/**
 * Turns raw WhatsApp exports into an anonymized, labelable corpus.
 *
 *   npx tsx src/eval/buildCorpus.ts "<exports dir>" [sampleSize]
 *
 * Writes to eval-data/:
 *   corpus.jsonl   every anonymized message (the full haystack)
 *   tolabel.jsonl  a stratified sample awaiting human labels
 *
 * Sampling deliberately keeps the real noise ratio rather than cherry-picking
 * academic-looking messages: an eval set of only obvious hits would flatter the
 * model and tell us nothing about false positives on everyday chatter. We do
 * oversample keyword candidates somewhat so a few hundred labels contain enough
 * positives to measure recall meaningfully.
 */

export interface CorpusMessage {
  id: string;
  group: string;
  sender: string;
  isRep: boolean;
  timestamp: string;
  text: string;
  /** Cheap prefilter signal — NOT a label, just used for stratified sampling. */
  candidate: boolean;
}

const KEYWORDS =
  /\b(cat|cats|c\.a\.t|exam|exams|assignment|assignments|deadline|due|submit|submission|venue|lecture|lesson|class|lab|practical|quiz|marks|transcript|semester|registration|portal|attendance|makeup|presentation|report|sitin|sit-in|timetable|revision|supplementary|suppl)\b/i;
const SHENG =
  /\b(imehamia|imesogezwa|imecancel|imekufa|imeahirishwa|kesho|leo|kutwa|wadau|wasee|comrades|mlete|beba|hakuna|tuko|mko|saa\s+\w+)\b/i;

export function isCandidate(text: string): boolean {
  return KEYWORDS.test(text) || SHENG.test(text);
}

/** Messages that carry no extractable text at all. */
function isEmptyNoise(text: string): boolean {
  const t = text.trim();
  return (
    t.length < 3 ||
    t === '<Media omitted>' ||
    t === 'null' ||
    /^This message was (deleted|edited)$/i.test(t) ||
    /^(Waiting for this message|Missed voice call|Missed video call)/i.test(t)
  );
}

export function buildCorpus(exportsDir: string): CorpusMessage[] {
  const anon = new Anonymizer();
  const out: CorpusMessage[] = [];

  for (const file of readdirSync(exportsDir).filter((f) => f.endsWith('.txt'))) {
    const raw = readFileSync(join(exportsDir, file), 'utf8');
    const group = basename(file, '.txt').replace(/^WhatsApp Chat with\s*/i, '').trim();
    const order = detectDateOrder(raw);
    const parsed = parseChatExport(raw, order);

    for (const m of parsed) {
      if (isEmptyNoise(m.text)) continue;
      const iso = m.timestamp.toISOString();
      const text = anon.text(m.text);
      out.push({
        id: Anonymizer.messageId(group, iso, text),
        group,
        sender: anon.sender(m.sender),
        isRep: /Class Rep/.test(anon.sender(m.sender)),
        timestamp: iso,
        text,
        candidate: isCandidate(text),
      });
    }
    console.log(`  ${group.padEnd(38)} order=${order} kept=${parsed.length}`);
  }

  out.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  console.log(`\nAnonymized ${anon.size} distinct senders.`);
  return out;
}

/**
 * Stratified sample: contiguous windows around candidate messages, so the
 * labeler (and later the model) sees conversational context — a correction
 * three messages later is part of the same event.
 */
export function sampleForLabeling(corpus: CorpusMessage[], target: number): CorpusMessage[] {
  const byGroup = new Map<string, CorpusMessage[]>();
  for (const m of corpus) {
    const arr = byGroup.get(m.group) ?? [];
    arr.push(m);
    byGroup.set(m.group, arr);
  }

  const picked = new Map<string, CorpusMessage>();
  const perGroup = Math.ceil(target / byGroup.size);

  for (const [, msgs] of byGroup) {
    const candidateIdx = msgs.map((m, i) => (m.candidate ? i : -1)).filter((i) => i >= 0);
    // Evenly spaced candidates across the group's history, not just the newest.
    const step = Math.max(1, Math.floor(candidateIdx.length / (perGroup / 3)));
    let taken = 0;
    for (let k = 0; k < candidateIdx.length && taken < perGroup; k += step) {
      const centre = candidateIdx[k];
      for (let i = Math.max(0, centre - 1); i <= Math.min(msgs.length - 1, centre + 1); i++) {
        if (!picked.has(msgs[i].id)) {
          picked.set(msgs[i].id, msgs[i]);
          taken++;
        }
      }
    }
  }

  return [...picked.values()].sort(
    (a, b) => a.group.localeCompare(b.group) || a.timestamp.localeCompare(b.timestamp),
  );
}

function main(): void {
  const dir = process.argv[2];
  if (!dir) {
    console.error('Usage: npx tsx src/eval/buildCorpus.ts "<exports dir>" [sampleSize]');
    process.exit(1);
  }
  const sampleSize = Number(process.argv[3] ?? 250);

  console.log(`Building corpus from ${dir}\n`);
  const corpus = buildCorpus(dir);
  const sample = sampleForLabeling(corpus, sampleSize);

  mkdirSync('eval-data', { recursive: true });
  writeFileSync('eval-data/corpus.jsonl', corpus.map((m) => JSON.stringify(m)).join('\n') + '\n');
  writeFileSync(
    'eval-data/tolabel.jsonl',
    sample.map((m) => JSON.stringify({ ...m, label: null })).join('\n') + '\n',
  );

  const cand = corpus.filter((m) => m.candidate).length;
  console.log(`\nCorpus:  ${corpus.length} messages  (${cand} keyword candidates, ${((cand / corpus.length) * 100).toFixed(1)}%)`);
  console.log(`Sample:  ${sample.length} messages queued for labeling`);
  console.log(`\nWrote eval-data/corpus.jsonl and eval-data/tolabel.jsonl`);
}

// Run only when invoked directly (not when imported by tests).
if (process.argv[1] && process.argv[1].endsWith('buildCorpus.ts')) main();
