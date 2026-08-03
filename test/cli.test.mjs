import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFlags } from '../src/cli.mjs';

test('parseFlags: boolean flag does not swallow the next positional', () => {
  const { flags, positional } = parseFlags(['start', '--force', '25']);
  assert.equal(flags.force, true);
  assert.deepEqual(positional, ['start', '25']);
});

test('parseFlags: -- ends option parsing', () => {
  const { flags, positional } = parseFlags(['start', '--', '-5m']);
  assert.equal(flags['5m'], undefined);
  assert.deepEqual(positional, ['start', '-5m']);
});

test('parseFlags: value flags consume the next token', () => {
  const { flags, positional } = parseFlags(['log', '--limit', '5', '--type', 'focus']);
  assert.equal(flags.limit, '5');
  assert.equal(flags.type, 'focus');
  assert.deepEqual(positional, ['log']);
});

test('parseFlags: --flag=value form', () => {
  const { flags, positional } = parseFlags(['start', '--label=deep work', '25']);
  assert.equal(flags.label, 'deep work');
  assert.deepEqual(positional, ['start', '25']);
});

test('parseFlags: short value flag works', () => {
  const { flags, positional } = parseFlags(['start', '-l', 'deep']);
  assert.equal(flags.l, 'deep');
  assert.deepEqual(positional, ['start']);
});

test('parseFlags: value flag with missing value throws', () => {
  assert.throws(() => parseFlags(['log', '--limit']), /requires a value/);
});

test('parseFlags: --help after a subcommand is a flag, not a command', () => {
  const { flags, positional } = parseFlags(['start', '--help']);
  assert.equal(flags.help, true);
  assert.deepEqual(positional, ['start']);
});
