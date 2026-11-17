// Pure progress logic. done: slug -> t (unix seconds); t > 0 is "done", t < 0 is "un-marked",
// the larger |t| wins. Device clocks are taken as-is, nothing is corrected.

export type Done = Record<string, number>;

// CloudStorage value limit, in characters.
export const MAX_VALUE = 4096;

export function mergeDone(a: Done, b: Done): Done {
  const out: Done = { ...a };
  for (const [slug, t] of Object.entries(b)) {
    const o = out[slug];
    if (o === undefined) out[slug] = t;
    else if (
      Math.abs(t) > Math.abs(o) ||
      (Math.abs(t) === Math.abs(o) && t > 0)
    )
      out[slug] = t;
  }
  return out;
}

export function isDone(d: Done, slug: string): boolean {
  return d[slug] > 0;
}

export function mark(d: Done, slug: string, done: boolean, now: number): Done {
  const t = Math.max(now, Math.abs(d[slug] ?? 0) + 1);
  return { ...d, [slug]: done ? t : -t };
}

export function parseScore(v: string): { score: number; total: number } | null {
  const m = /^(\d+)\/(\d+)$/.exec(v);
  if (!m) return null;
  const score = Number(m[1]);
  const total = Number(m[2]);
  return total > 0 && score <= total ? { score, total } : null;
}

// Larger share wins, invalid values are ignored, a tie keeps the first.
export function mergeQuiz(
  a: string | undefined,
  b: string | undefined,
): string | undefined {
  const pa = a === undefined ? null : parseScore(a);
  const pb = b === undefined ? null : parseScore(b);
  if (!pa) return pb ? b : undefined;
  if (!pb) return a;
  return pb.score * pa.total > pa.score * pb.total ? b : a;
}

// A stored `done` value: a JSON object of finite numbers, anything else is garbage (null).
export function parseDone(v: string): Done | null {
  let x: unknown;
  try {
    x = JSON.parse(v);
  } catch {
    return null;
  }
  if (typeof x !== "object" || x === null || Array.isArray(x)) return null;
  for (const t of Object.values(x)) {
    if (typeof t !== "number" || !Number.isFinite(t)) return null;
  }
  return x as Done;
}

// Chunk 1 has no suffix: done-<m>, done-<m>-2, done-<m>-3, ...
export function doneKey(module: string, chunk: number): string {
  return chunk === 1 ? `done-${module}` : `done-${module}-${chunk}`;
}

export function splitDone(module: string, d: Done): Record<string, string> {
  const out: Record<string, string> = {};
  let chunk = 1;
  let cur: Done = {};
  for (const [slug, t] of Object.entries(d)) {
    const next = { ...cur, [slug]: t };
    if (
      Object.keys(cur).length > 0 &&
      JSON.stringify(next).length > MAX_VALUE
    ) {
      out[doneKey(module, chunk++)] = JSON.stringify(cur);
      cur = { [slug]: t };
    } else cur = next;
  }
  out[doneKey(module, chunk)] = JSON.stringify(cur);
  return out;
}

// Merges every valid chunk of the module; a garbage chunk is skipped, not fatal.
export function joinDone(
  module: string,
  entries: Record<string, string>,
): Done {
  const base = doneKey(module, 1);
  let out: Done = {};
  for (const [key, value] of Object.entries(entries)) {
    const isChunk =
      key === base ||
      (key.startsWith(`${base}-`) && /^\d+$/.test(key.slice(base.length + 1)));
    const d = isChunk ? parseDone(value) : null;
    if (d) out = mergeDone(out, d);
  }
  return out;
}
