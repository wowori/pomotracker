import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { POMO_DIR, ACTIVE_PATH } from './paths.mjs';
import { loadConfig } from './config.mjs';
import { appendSession } from './sessions.mjs';
import { beep, notify } from './notify.mjs';
import { fmtClock, parseDuration } from './format.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

function ensureDir() {
  if (!existsSync(POMO_DIR)) mkdirSync(POMO_DIR, { recursive: true });
}

function readActive() {
  if (!existsSync(ACTIVE_PATH)) return null;
  try {
    return JSON.parse(readFileSync(ACTIVE_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function writeActive(record) {
  ensureDir();
  writeFileSync(ACTIVE_PATH, JSON.stringify(record, null, 2));
}

function clearActive() {
  try {
    unlinkSync(ACTIVE_PATH);
  } catch {}
}

// PID liveness check. process.kill(pid, 0) throws ESRCH if no such process.
function isAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    if (err.code === 'EPERM') return true; // exists but no permission -> treat as alive
    return false;
  }
}

// If a session is recorded as active but the worker is gone, reconcile:
// - worker dead AND past deadline -> completed
// - worker dead AND before deadline -> aborted (likely killed via stop or system shutdown)
// - worker alive -> still running, leave alone
function reconcile() {
  const active = readActive();
  if (!active) return null;
  const deadline = new Date(active.deadline).getTime();
  const now = Date.now();
  if (isAlive(active.childPid)) return active; // still running
  // worker is gone
  if (now >= deadline) {
    appendSession({
      type: active.type,
      label: active.label || '',
      start: active.start,
      end: active.deadline,
      durationSec: active.durationSec,
      completed: true,
    });
    clearActive();
    if (active.beepOnDone) beep();
    if (active.notifyOnDone) {
      notify({ title: 'Pomodoro', body: `${active.type === 'focus' ? 'Focus' : 'Break'} complete` });
    }
    return null;
  }
  // Worker died before deadline: treat as aborted.
  appendSession({
    type: active.type,
    label: active.label || '',
    start: active.start,
    end: new Date().toISOString(),
    durationSec: Math.round((Date.now() - new Date(active.start).getTime()) / 1000),
    completed: false,
  });
  clearActive();
  return null;
}

// The worker gets start/deadline as argv, so it does not depend on reading
// active.json at startup (avoids a race with the parent writing it).
function spawnWorker({ start, deadline }) {
  const childScript = join(__dirname, '..', 'bin', 'pomo-worker.mjs');
  const child = spawn(process.execPath, [childScript, ACTIVE_PATH, start, deadline], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  });
  child.unref();
  return child.pid;
}

function beginSession({ type, minutes, label, cfg, force = false }) {
  reconcile();
  const existing = readActive();
  if (existing) {
    if (!force) {
      const remaining = Math.max(0, Math.round((new Date(existing.deadline) - Date.now()) / 1000));
      throw new Error(
        `a session is already active (${existing.type}, ${fmtClock(remaining)} left). ` +
          `Use --force to replace it, or 'pomo stop' to cancel.`,
      );
    }
    clearActive();
  }
  const defaultMin = type === 'focus' ? cfg.focusMinutes : cfg.breakMinutes;
  const durationSec = minutes ? parseDuration(minutes) : defaultMin * 60;
  const startTime = new Date();
  const deadline = new Date(startTime.getTime() + durationSec * 1000);
  const startIso = startTime.toISOString();
  const deadlineIso = deadline.toISOString();
  const childPid = spawnWorker({ start: startIso, deadline: deadlineIso });
  const record = {
    type,
    label: label || cfg.label || '',
    start: startIso,
    deadline: deadlineIso,
    durationSec,
    notifyOnDone: cfg.notify,
    beepOnDone: cfg.beep,
    childPid,
  };
  writeActive(record);
  return record;
}

export function start({ minutes, label, autoBreak = false, force = false } = {}) {
  const cfg = loadConfig();
  return beginSession({ type: 'focus', minutes, label, cfg, force });
}

export function startBreak({ minutes, label, force = false } = {}) {
  const cfg = loadConfig();
  return beginSession({ type: 'break', minutes, label, cfg, force });
}

export function stop() {
  const active = readActive();
  if (!active) {
    throw new Error('no active session');
  }
  appendSession({
    type: active.type,
    label: active.label || '',
    start: active.start,
    end: new Date().toISOString(),
    durationSec: Math.round((Date.now() - new Date(active.start).getTime()) / 1000),
    completed: false,
  });
  clearActive();
  // Best-effort kill the worker so it doesn't fire a notification later.
  if (active.childPid) {
    try {
      process.kill(active.childPid);
    } catch {}
  }
  return { stopped: true, type: active.type };
}

export function status({ json = false } = {}) {
  reconcile();
  const active = readActive();
  if (!active) {
    if (json) console.log(JSON.stringify({ active: null }));
    else console.log('No active session.');
    return { active: null };
  }
  const remainingSec = Math.max(0, Math.round((new Date(active.deadline) - Date.now()) / 1000));
  const total = active.durationSec;
  const elapsed = total - remainingSec;
  if (json) {
    console.log(
      JSON.stringify({
        type: active.type,
        label: active.label,
        start: active.start,
        deadline: active.deadline,
        remainingSec,
        elapsedSec: elapsed,
        totalSec: total,
        progress: total > 0 ? Math.min(1, Math.max(0, elapsed / total)) : 0,
      }),
    );
  } else {
    const left = fmtClock(remainingSec);
    const totalStr = fmtClock(total);
    console.log(`${active.type === 'focus' ? 'Focus' : 'Break'} session: ${left} left (of ${totalStr})${active.label ? ` - ${active.label}` : ''}`);
  }
  return { active, remainingSec };
}
