# Changelog

All notable changes to pomotracker are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.1] - 2026-08-03

### Fixed

- Flag parser no longer swallows a positional that follows a boolean flag
  (`pomo start --force 25` keeps the 25 as the duration)
- `--` is now honored as an end-of-options marker, so
  `pomo start -- -5m` behaves as documented
- `--help`/`-h` after a subcommand prints help instead of starting a session
- Config key `beep` now actually controls the console beep; it no longer only
  fires when `notify` is on
- The background worker no longer depends on reading `active.json` at startup,
  removing a race where a session could start without a worker
- `npm test` runs on Node 22 (the old `node --test test/` invocation failed
  with MODULE_NOT_FOUND)
- `fmtDuration` no longer drops seconds for durations over an hour

## [0.1.0] - 2026-06-26

### Added

- `pomo start [duration] [--label] [--force]` - start a focus session, runs in a
  detached worker so the terminal returns immediately
- `pomo break [duration] [--label] [--force]` - start a break
- `pomo stop` - cancel the active session
- `pomo status [--json]` - show the active session and remaining time
- `pomo stats [day|week|month|all] [--json]` - aggregate stats for a period,
  including a focus-session streak
- `pomo log [--limit N] [--today] [--type focus|break] [--json]` - list past
  sessions
- `pomo config get|set|list|reset` - manage `~/.pomo/config.json` with
  validation (positive numbers, booleans)
- `pomo completions bash|zsh|fish` - print a shell completion script
- Cross-platform beep + desktop notification on completion (Windows BurntToast
  with balloon-tip fallback, macOS osascript, Linux notify-send)
- Session log persisted as `~/.pomo/sessions.jsonl` (one JSON record per line)
- `reconcile()` on every command: if a previous worker is gone, the leftover
  `active.json` is finalized correctly (completed if past deadline, stopped
  otherwise) so the user never loses a session to a reboot or crash
- Shell completions for bash, zsh, fish
- 27 unit tests (`node --test`) covering duration parsing, time formatting,
  session read/write with corrupt-line tolerance, stats aggregation, streak
  computation, and config validation

### Fixed

- `parseDuration` rejects zero, negative, and oversize values; caps at 24h
- `coerceConfigValue` rejects non-positive numbers and unknown keys; surfaces
  a `pomo config reset` hint when the on-disk config file is malformed
- `fmtClock` renders as `HhMM:SS` for durations >= 1 hour (was `MM:SS` with
  minute overflow)
- The detached worker rechecks `active.json` right before finalizing and
  exits silently if the session was replaced by `--force` or `stop`

[0.1.1]: https://github.com/wowori/pomotracker/releases/tag/v0.1.1
[0.1.0]: https://github.com/wowori/pomotracker/releases/tag/v0.1.0
