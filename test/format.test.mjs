import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fmtDuration, fmtClock, parseDuration, startOfDay, startOfWeek } from '../src/format.mjs';

test('fmtDuration: seconds under a minute', () => {
  assert.equal(fmtDuration(0), '0s');
  assert.equal(fmtDuration(45), '45s');
});

test('fmtDuration: minutes only', () => {
  assert.equal(fmtDuration(60), '1m');
  assert.equal(fmtDuration(60 * 25), '25m');
});

test('fmtDuration: mixed', () => {
  assert.equal(fmtDuration(60 * 60 + 60 * 5), '1h 5m');
  assert.equal(fmtDuration(60 * 30 + 5), '30m 5s');
  assert.equal(fmtDuration(3600), '1h');
});

test('fmtDuration: keeps seconds when over an hour', () => {
  assert.equal(fmtDuration(3605), '1h 5s');
  assert.equal(fmtDuration(3600 + 60 + 5), '1h 1m 5s');
});

test('fmtDuration: clamps negatives to zero', () => {
  assert.equal(fmtDuration(-10), '0s');
});

test('fmtClock: pads MM:SS', () => {
  assert.equal(fmtClock(0), '00:00');
  assert.equal(fmtClock(59), '00:59');
  assert.equal(fmtClock(60), '01:00');
  assert.equal(fmtClock(25 * 60), '25:00');
  assert.equal(fmtClock(60 * 60 + 5), '1h00:05');
  assert.equal(fmtClock(24 * 60 * 60), '24h00:00');
});

test('parseDuration: bare number is minutes', () => {
  assert.equal(parseDuration('25'), 25 * 60);
  assert.equal(parseDuration(25), 25 * 60);
});

test('parseDuration: with units', () => {
  assert.equal(parseDuration('90s'), 90);
  assert.equal(parseDuration('25m'), 25 * 60);
  assert.equal(parseDuration('1h'), 3600);
  assert.equal(parseDuration('1h30m'), 3600 + 30 * 60);
  assert.equal(parseDuration('1h30m15s'), 3600 + 30 * 60 + 15);
});

test('parseDuration: rejects garbage', () => {
  assert.throws(() => parseDuration(''));
  assert.throws(() => parseDuration('abc'));
  assert.throws(() => parseDuration('0'));
  assert.throws(() => parseDuration('-5m'));
  assert.throws(() => parseDuration(0));
  assert.throws(() => parseDuration(-1));
});

test('parseDuration: caps at 24h', () => {
  assert.throws(() => parseDuration('25h'));
  assert.throws(() => parseDuration('24h1m'));
  assert.throws(() => parseDuration(1500), /24h/); // 1500 minutes = 25h
  // boundary: exactly 24h is allowed
  assert.equal(parseDuration('24h'), 24 * 60 * 60);
  assert.equal(parseDuration('1440'), 24 * 60 * 60); // 1440 minutes
});

test('startOfDay: zeroes time portion', () => {
  const d = new Date('2026-06-26T15:34:22.123Z');
  const out = startOfDay(d);
  assert.equal(out.getHours(), 0);
  assert.equal(out.getMinutes(), 0);
  assert.equal(out.getSeconds(), 0);
  assert.equal(out.getMilliseconds(), 0);
});

test('startOfWeek: returns Monday', () => {
  // 2026-06-26 is a Friday. Monday of that week is 2026-06-22.
  const d = new Date('2026-06-26T15:00:00Z');
  const out = startOfWeek(d);
  assert.equal(out.getDay(), 1);
});
