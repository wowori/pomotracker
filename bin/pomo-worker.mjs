// Detached worker: waits until the deadline passed in as argv, then
// finalizes the session (writes a record, fires beep+notification).
// Self-deletes: re-reads active.json right before acting to ensure it is still
// pointed at this session; if not, exits silently.

import { readFileSync, unlinkSync, existsSync } from 'node:fs';
import { appendSession } from '../src/sessions.mjs';
import { beep, notify } from '../src/notify.mjs';

const activePath = process.argv[2];
const expectedStart = process.argv[3];
const expectedDeadline = process.argv[4];
if (!activePath || !expectedStart || !expectedDeadline) process.exit(1);

function readActive() {
  if (!existsSync(activePath)) return null;
  try {
    return JSON.parse(readFileSync(activePath, 'utf8'));
  } catch {
    return null;
  }
}

function finalize(active) {
  const record = {
    type: active.type,
    label: active.label || '',
    start: active.start,
    end: active.deadline,
    durationSec: active.durationSec,
    completed: true,
  };
  appendSession(record);
  try {
    unlinkSync(activePath);
  } catch {}
  if (active.beepOnDone) beep();
  if (active.notifyOnDone) {
    notify({
      title: 'Pomodoro',
      body: `${active.type === 'focus' ? 'Focus' : 'Break'} complete${active.label ? `: ${active.label}` : ''}`,
    });
  }
}

(async () => {
  const deadline = new Date(expectedDeadline).getTime();
  const delay = deadline - Date.now();
  if (delay > 0) await new Promise((r) => setTimeout(r, delay));
  // Re-read right before acting. If someone replaced/stopped the session, bail.
  const current = readActive();
  if (!current) process.exit(0);
  if (current.start !== expectedStart || current.deadline !== expectedDeadline) process.exit(0);
  finalize(current);
})();
