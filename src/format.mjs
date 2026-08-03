// Minimal ANSI helpers. Auto-disabled when stdout is not a TTY.

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;

const wrap = (open, close) => (s) => (useColor ? `\x1b[${open}m${s}\x1b[${close}m` : String(s));

export const c = {
  red: wrap(31, 39),
  green: wrap(32, 39),
  yellow: wrap(33, 39),
  blue: wrap(34, 39),
  magenta: wrap(35, 39),
  cyan: wrap(36, 39),
  bold: wrap(1, 22),
  dim: wrap(2, 22),
};

// Human-readable duration: "25m", "1h 5m", "45s".
export function fmtDuration(seconds) {
  seconds = Math.max(0, Math.round(seconds));
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    if (m > 0 && s > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${h}h ${m}m`;
    if (s > 0) return `${h}h ${s}s`;
    return `${h}h`;
  }
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

// MM:SS countdown form, padded. For >= 1h, switches to "HhMM:SS" so the
// minutes field doesn't overflow its two digits.
export function fmtClock(seconds) {
  seconds = Math.max(0, Math.round(seconds));
  const totalMin = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (totalMin >= 60) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${h}h${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(totalMin).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Parse "25", "25m", "1h30m", "90s" -> seconds. Throws on garbage.
// Both string and number inputs: bare number = minutes, "25" = 25 minutes.
// Capped at MAX_DURATION_SEC (24h). Anything longer is almost certainly a typo.
export const MAX_DURATION_SEC = 24 * 60 * 60;

export function parseDuration(input) {
  if (typeof input === 'number') {
    if (!Number.isFinite(input) || input <= 0) throw new Error('duration must be positive');
    const out = Math.round(input) * 60;
    if (out > MAX_DURATION_SEC) throw new Error(`duration must be at most 24h (got ${Math.round(input)}m)`);
    return out;
  }
  const s = String(input).trim();
  if (s === '') throw new Error('duration is required');
  if (/^\d+$/.test(s)) {
    const n = parseInt(s, 10);
    if (n <= 0) throw new Error('duration must be positive');
    const out = n * 60;
    if (out > MAX_DURATION_SEC) throw new Error(`duration must be at most 24h (got ${n}m)`);
    return out;
  }
  const m = s.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  if (!m || (!m[1] && !m[2] && !m[3])) throw new Error(`invalid duration: ${input}`);
  const h = parseInt(m[1] || '0', 10);
  const mm = parseInt(m[2] || '0', 10);
  const ss = parseInt(m[3] || '0', 10);
  if (h === 0 && mm === 0 && ss === 0) throw new Error('duration must be positive');
  const out = h * 3600 + mm * 60 + ss;
  if (out > MAX_DURATION_SEC) throw new Error(`duration must be at most 24h (got ${input})`);
  return out;
}

// Start-of-day in local time, as ISO string.
export function startOfDay(d = new Date()) {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

export function startOfWeek(d = new Date()) {
  const out = startOfDay(d);
  const day = out.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day); // make Monday the first day
  out.setDate(out.getDate() + diff);
  return out;
}
