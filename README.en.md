# dsh-transfer-export

[中文](README.md) | English

Session backup export plugin for DSH (DeepSeek Harness): exports a session as a **JSON fidelity layer + Markdown readable layer** (default dual output), single-file HTML optional. Triggered by the `/transfer-export` command or an icon button on the assistant message action strip.

## Why JSON + MD dual layers

- **JSON is the fidelity layer**: full normalized events + metadata, never truncated. Any future format (docx/HTML re-render) regenerates from this layer.
- **MD is the readable layer**: turn headings, collapsed tool calls, long outputs truncated with an explicit note. Good for humans, notes, diffing.
- **HTML is the distribution layer** (`--html`): self-contained single file, opens offline, printable.
- docx is not an archive format (binary, diff-unfriendly); v2 plans `--docx` via the renderer registry (`FORMAT_RENDERERS` in `lib/core.js`) with a dynamic import.

## Usage

```text
/transfer-export                    # current session → JSON + MD
/transfer-export --html             # additionally emit HTML
/transfer-export --only md|json|html
/transfer-export --id <sessionId>   # export any historical session (even pre-install)
/transfer-export --last-turns 5     # only the last 5 turns
/transfer-export --out <dir>        # override output dir (rest of the line is the path)
/transfer-export --mask             # redact secrets (default off: fidelity first for backups)
```

Default output dir: `~/.dsh/exports/dsh-transfer-export/` (`$DSH_HOME` aware). Files: `transfer-<id8>-<timestamp>.{json,md,html}`, auto `-2` suffix on collision, atomic writes.

The message-strip button exports the current session with default options and shows the written paths in a toast.

## Export semantics

Only "user-visible surface events" are exported: real user inputs (`source.kind === 'user'`, injected scaffolding dropped and counted), assistant messages (text/reasoning/tool-call blocks), tool calls paired with results (by callId, then arrival-order adoption, else orphan), deliverables. Reasoning goes to the JSON layer only, not MD.

## Install

```bash
dsh plugin --profile web add dsh-transfer-export
# or from GitHub
dsh plugin --profile web add github:vu345/dsh-transfer-export
```

Desktop users: Settings → Plugins, search `dsh-transfer-export`.

## Docs

- [docs/STATUS.md](docs/STATUS.md) — current state (single source of "now")
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — data flow, host seams, invariants
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) — test, install, smoke checklist, rollback

## License

[MIT](LICENSE)
