import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { start, startBreak, stop, status } from './timer.mjs';
import { loadConfig, setKey, resetConfig } from './config.mjs';
import { computeStats, formatStats } from './stats.mjs';
import { readSessions } from './sessions.mjs';
import { fmtDuration, fmtClock, c } from './format.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_PATH = join(__dirname, '..', 'package.json');

function getVersion() {
  return JSON.parse(readFileSync(PKG_PATH, 'utf8')).version;
}

// Tiny flag parser. Recognizes --flag, --flag value, --flag=value, -f value,
// and '--' as an end-of-options marker (everything after is positional).
// Only --label/-l, --limit, and --type take values. Every other flag is
// boolean, so a value never swallows the next token ('--force 25' keeps 25).
const VALUE_FLAGS = new Set(['label', 'l', 'limit', 'type']);

export function parseFlags(argv) {
  const flags = {};
  const positional = [];
  let onlyPositional = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (onlyPositional || !a.startsWith('-') || a === '-') {
      positional.push(a);
      continue;
    }
    if (a === '--') {
      onlyPositional = true;
      continue;
    }
    let body = a.slice(a.startsWith('--') ? 2 : 1);
    let inlineValue;
    const eq = body.indexOf('=');
    if (eq >= 0) {
      inlineValue = body.slice(eq + 1);
      body = body.slice(0, eq);
    }
    if (VALUE_FLAGS.has(body)) {
      if (inlineValue !== undefined) {
        flags[body] = inlineValue;
      } else {
        const next = argv[i + 1];
        if (next === undefined) throw new Error(`--${body} requires a value`);
        flags[body] = next;
        i++;
      }
    } else {
      flags[body] = inlineValue !== undefined ? inlineValue : true;
    }
  }
  return { flags, positional };
}

const HELP = `${c.bold('pomo')} - cross-platform Pomodoro timer (no dependencies)

${c.bold('Usage:')}
  pomo start [duration] [--label "..."] [--force]
  pomo break [duration] [--label "..."] [--force]
  pomo stop
  pomo status [--json]
  pomo stats [day|week|month|all] [--json]
  pomo log [--limit N] [--today] [--type focus|break] [--json]
  pomo config get <key>
  pomo config set <key> <value>
  pomo config list
  pomo config reset
  pomo completions <bash|zsh|fish>
  pomo --version | --help

${c.bold('Duration:')}
  Bare number = minutes (25). With suffix: 90s, 25m, 1h30m.
  Maximum: 24h. Pass 'pomo start -- -5m' if your duration starts with a dash.

${c.bold('Examples:')}
  pomo start                          # focus, default 25m
  pomo start 1h30m --label "deep work"
  pomo break 10
  pomo stats week
`;

function help() {
  console.log(HELP);
}

function showLog({ flags, positional }) {
  const limit = flags.limit ? Number(flags.limit) : 20;
  if (flags.limit && !Number.isFinite(limit)) throw new Error('--limit must be a number');
  const type = flags.type;
  const since = flags.today ? new Date(new Date().setHours(0, 0, 0, 0)) : null;
  const records = readSessions({ since, type });
  const slice = limit > 0 ? records.slice(-limit) : records;
  if (flags.json) {
    console.log(JSON.stringify(slice, null, 2));
    return;
  }
  if (slice.length === 0) {
    console.log('No sessions logged yet.');
    return;
  }
  console.log(`${c.bold('Recent sessions:')}`);
  for (const r of slice) {
    const start = new Date(r.start);
    const status = r.completed ? c.green('done') : c.yellow('stopped');
    const tag = r.type === 'focus' ? c.cyan('focus') : c.magenta('break');
    const when = start.toISOString().slice(0, 16).replace('T', ' ');
    const labelPart = r.label ? ` ${c.dim(`"${r.label}"`)}` : '';
    console.log(`  ${when}  ${tag}  ${fmtDuration(r.durationSec).padStart(8)}  ${status}${labelPart}`);
  }
}

function showConfig({ positional }) {
  const sub = positional[0];
  const cfg = loadConfig();
  if (!sub || sub === 'list') {
    for (const [k, v] of Object.entries(cfg)) {
      console.log(`${k} = ${JSON.stringify(v)}`);
    }
    return;
  }
  if (sub === 'get') {
    const key = positional[1];
    if (!key) throw new Error('usage: pomo config get <key>');
    if (!(key in cfg)) throw new Error(`unknown key: ${key}`);
    console.log(JSON.stringify(cfg[key]));
    return;
  }
  if (sub === 'set') {
    const key = positional[1];
    const value = positional[2];
    if (!key || value === undefined) throw new Error('usage: pomo config set <key> <value>');
    const v = setKey(key, value);
    console.log(`${key} = ${JSON.stringify(v)}`);
    return;
  }
  if (sub === 'reset') {
    resetConfig();
    console.log('config reset to defaults');
    return;
  }
  throw new Error(`unknown config subcommand: ${sub}`);
}

function completions({ positional }) {
  const shell = positional[0];
  if (shell === 'bash') {
    process.stdout.write(`_pomo() {
  local cur prev cmds
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
  prev="\${COMP_WORDS[COMP_CWORD-1]}"
  cmds="start break stop status stats log config completions"
  if [ \$COMP_CWORD -eq 1 ]; then
    COMPREPLY=( \$(compgen -W "\$cmds" -- "\$cur") )
  fi
  return 0
}
complete -F _pomo pomo
`);
    return;
  }
  if (shell === 'zsh') {
    process.stdout.write(`#compdef pomo
_pomo() {
  local -a subcommands
  subcommands=(
    'start:Start a focus session'
    'break:Start a break'
    'stop:Cancel the active session'
    'status:Show the active session'
    'stats:Aggregate stats (day|week|month|all)'
    'log:List recent sessions'
    'config:Get or set configuration'
    'completions:Print shell completions'
  )
  _describe 'subcommand' subcommands
}
compdef _pomo pomo
`);
    return;
  }
  if (shell === 'fish') {
    process.stdout.write(`complete -c pomo -f
complete -c pomo -n "__fish_use_subcommand" -a "start" -d "Start a focus session"
complete -c pomo -n "__fish_use_subcommand" -a "break" -d "Start a break"
complete -c pomo -n "__fish_use_subcommand" -a "stop" -d "Cancel the active session"
complete -c pomo -n "__fish_use_subcommand" -a "status" -d "Show the active session"
complete -c pomo -n "__fish_use_subcommand" -a "stats" -d "Aggregate stats"
complete -c pomo -n "__fish_use_subcommand" -a "log" -d "List recent sessions"
complete -c pomo -n "__fish_use_subcommand" -a "config" -d "Configuration"
complete -c pomo -n "__fish_use_subcommand" -a "completions" -d "Print shell completions"
`);
    return;
  }
  throw new Error(`unsupported shell: ${shell}. Use bash, zsh, or fish.`);
}

export async function run(argv) {
  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    help();
    return;
  }
  if (argv[0] === '--version' || argv[0] === '-V') {
    console.log(getVersion());
    return;
  }
  const { flags, positional } = parseFlags(argv);
  if (flags.help || flags.h) {
    help();
    return;
  }
  const cmd = positional[0];
  const rest = positional.slice(1);

  switch (cmd) {
    case 'start': {
      const minutes = rest[0];
      const label = typeof flags.label === 'string' || typeof flags.l === 'string'
        ? flags.label || flags.l
        : undefined;
      const rec = start({
        minutes,
        label,
        force: !!flags.force,
      });
      console.log(`${c.cyan('Focus')} session started: ${fmtClock(rec.durationSec)}${rec.label ? ` - ${rec.label}` : ''}`);
      console.log(c.dim(`Ends at ${new Date(rec.deadline).toLocaleTimeString()} (pid ${rec.childPid})`));
      break;
    }
    case 'break': {
      const minutes = rest[0];
      const label = typeof flags.label === 'string' || typeof flags.l === 'string'
        ? flags.label || flags.l
        : undefined;
      const rec = startBreak({ minutes, label, force: !!flags.force });
      console.log(`${c.magenta('Break')} started: ${fmtClock(rec.durationSec)}${rec.label ? ` - ${rec.label}` : ''}`);
      console.log(c.dim(`Ends at ${new Date(rec.deadline).toLocaleTimeString()} (pid ${rec.childPid})`));
      break;
    }
    case 'stop': {
      const r = stop();
      console.log(`Stopped ${c.bold(r.type)} session.`);
      break;
    }
    case 'status': {
      status({ json: !!flags.json });
      break;
    }
    case 'stats': {
      const period = rest[0] || 'day';
      const s = computeStats({ period });
      console.log(formatStats(s, { json: !!flags.json }));
      break;
    }
    case 'log': {
      showLog({ flags, positional: rest });
      break;
    }
    case 'config': {
      showConfig({ positional: rest });
      break;
    }
    case 'completions': {
      completions({ positional: rest });
      break;
    }
    default:
      throw new Error(`unknown command: ${cmd}. Run 'pomo --help'.`);
  }
}
