# pomotracker

Cross-platform Pomodoro timer CLI. Zero dependencies, Node.js >= 18.

`pomo start` returns immediately. The session runs in a detached worker.
When time is up you get a beep and a desktop notification. Sessions are
logged to `~/.pomo/sessions.jsonl`.

## Install

```
npm install -g pomotracker
```

Or without installing:

```
npx pomotracker start 25
```

## Usage

```
pomo start [duration] [--label "..."] [--force]
pomo break [duration] [--label "..."] [--force]
pomo stop
pomo status [--json]
pomo stats [day|week|month|all] [--json]
pomo log [--limit N] [--today] [--type focus|break] [--json]
pomo config get|set|list|reset [key] [value]
pomo completions <bash|zsh|fish>
pomo --version
pomo --help
```

### Duration

A bare number is minutes. With a suffix: `90s`, `25m`, `1h`, `1h30m`.
Maximum: 24h. To pass a value that starts with a dash, put `--` first:

```
pomo start -- -5m
```

### Examples

```
pomo start                          # focus, default 25m
pomo start 1h30m --label "deep work"
pomo break 10
pomo status                         # 00:24 left (of 01:30) - deep work
pomo stats week
pomo log -n 5
pomo config set focusMinutes 50
pomo completions bash > ~/.pomo-completion.bash
```

## Config

`~/.pomo/config.json`. Defaults:

| Key              | Default | Notes                                   |
| ---------------- | ------- | --------------------------------------- |
| focusMinutes     | 25      | default focus length                    |
| breakMinutes     | 5       | default break length                    |
| longBreakMinutes | 15      | reserved (long breaks: not implemented) |
| longBreakEvery   | 4       | reserved                                |
| autoBreak        | false   | reserved (auto-start break: not impl.)  |
| notify           | true    | desktop notification on completion      |
| beep             | true    | console beep on completion              |
| label            | ""      | default label applied to new sessions   |

`pomo config set <key> <value>` validates the value (positive number for
duration keys, `true`/`false` for booleans) and writes it back.

## Data files

| File                          | Purpose                                |
| ----------------------------- | -------------------------------------- |
| `~/.pomo/config.json`         | config                                 |
| `~/.pomo/active.json`         | current session (deleted on finish)    |
| `~/.pomo/sessions.jsonl`      | one JSON record per session            |

## Notifications

| OS      | Beep                         | Notification                                             |
| ------- | ---------------------------- | -------------------------------------------------------- |
| Windows | PowerShell `[Console]::Beep` | BurntToast if installed, else balloon-tip fallback       |
| macOS   | terminal bell                | `osascript display notification`                         |
| Linux   | terminal bell                | `notify-send` (libnotify)                                |

On Windows, to get rich toasts: `Install-Module -Scope CurrentUser BurntToast`
in an elevated PowerShell (one-time).

## Background worker

`pomo start` writes `active.json`, spawns `bin/pomo-worker.mjs` detached, and
exits. The worker sleeps until the deadline, writes the session record, deletes
`active.json`, and fires the beep + notification.

Any subsequent `pomo` command reconciles `active.json`. If the worker is gone
and the deadline has passed, the session is logged as completed. If the worker
is gone but the deadline is still in the future, the session is logged as
stopped. This handles system reboots, kills, and `pomo stop`.

`pomo stop` deletes `active.json` and kills the worker.

## Development

```
git clone https://github.com/wowori/pomotracker
cd pomo
npm test
```

## License

MIT
