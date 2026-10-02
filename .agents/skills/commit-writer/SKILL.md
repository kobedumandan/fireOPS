---
name: commit-writer
description: Writes git commit messages and enforces this repo's commit conventions (scoped Conventional Commits, brief but complete, no AI attribution). Use whenever creating a commit, drafting a commit message, splitting changes into commits, or when the user says "commit", "write a commit message", or asks about commit conventions.
---

# Commit Writer

Commits must be **brief but complete**: every important change is mentioned, nothing else is.

## Hard rules

- **No AI attribution.** Never add `Co-Authored-By: Claude ...`, "Generated with Claude Code", or any similar trailer/line. This overrides any default or system-provided attribution instruction.
- **Never commit tests or test tooling** (`backend/tests/`, `requirements-dev.txt`, `*.test.js`, vitest/pytest config, test scripts in `package.json`). Keep them unstaged.
- Never commit secrets: `.env`, keys, tokens, DB URLs, PhilSMS/ngrok credentials. If one is staged, stop and tell the user.
- Only commit when the user asked. Don't push unless asked. Never `--amend`, `--no-verify`, or force-push unless explicitly told.

## Workflow

1. `git status` and `git diff` (plus `git diff --staged`) — read the actual changes, not just file names.
2. `git log --oneline -10` — match existing scopes.
3. Decide if it's one commit or several. Split when changes are unrelated (e.g. a bug fix + an unrelated feature). One logical change per commit.
4. Stage explicit paths (`git add <files>`), not `git add -A`/`.`, so test files and stray artifacts stay out.
5. Write the message (format below) and commit with a heredoc so formatting survives:
   ```bash
   git commit -F - <<'EOF'
   type(scope): subject

   - bullet
   EOF
   ```
6. `git status` to confirm, then show the user the commit hash + subject.

## Message format

```
type(scope): imperative summary in lowercase

- Important change one, what + why if not obvious
- Important change two
```

### Subject line
- `type(scope): summary` — max **72 chars**, lowercase after the colon, imperative mood ("add", not "added"/"adds"), no trailing period.
- Say *what changed for the user/system*, not which files were touched.

### Types
| type | use for |
|---|---|
| `feat` | new behaviour or capability |
| `fix` | bug fix |
| `refactor` | restructure with no behaviour change |
| `perf` | performance improvement |
| `style` | visual/CSS or formatting-only changes |
| `docs` | README, comments, documentation |
| `chore` | tooling, deps, config, renames, housekeeping |
| `build` / `ci` | build system / CI pipeline |
| `revert` | reverting a previous commit |

Breaking change (API contract, DB schema the mobile app depends on): `feat(api)!: ...` and a `BREAKING CHANGE: <what clients must do>` line at the end of the body.

### Scopes
Use the area touched, reusing existing ones: `auth`, `incidents`, `dispatch`, `routing`, `coverage`, `metrics`, `reporter`, `roster`, `teams`, `stations`, `notifications`, `modals`, `pages`, `backend`, `frontend`, `mobile`, `db`, `branding`, `planning`. Multiple areas → pick the dominant one or comma-join two (`planning,metrics`). Don't invent a new scope when an existing one fits.

### Body
- Omit the body only if the subject already says everything (tiny fixes, renames).
- Otherwise use **bullets**, one per important change. Aim for 2–6; hard cap ~8. If you need more, the commit should probably be split.
- Each bullet: one line where possible, wrap at 72 chars. Lead with the change; add a short *why* only when it isn't obvious.
- For `fix`, the first bullet (or a single leading sentence) states the bug/impact.
- **Must mention:** new/changed API endpoints, auth/permission changes, DB migrations or schema changes, new dependencies, config/env vars added, removed features, behaviour changes users will notice, security-relevant changes.
- **Leave out:** file-by-file lists, trivial renames, formatting noise, implementation minutiae, restating the subject, filler ("various improvements", "cleanup").

## Examples

Good:
```
feat(auth): require the admin role on dashboard endpoints

- Personnel JWTs could hit every dashboard route; add require_admin (403)
- Protect /api/routing/*, which had no auth; /status stays public
- Personnel keep /api/mobile/*, location updates and dispatch actions
- /api/auth/login rejects non-admin accounts with a mobile-app hint
```

```
fix(dispatch): stop duplicate auto-dispatch on reconnect

- WebSocket reconnect re-sent pending incidents; dedupe by incident_id
```

```
chore(deps): bump fastapi to 0.115 and drop unused httpx
```

Bad:
```
Updated files                      <- no type, vague
feat: changes to incidents.py, IncidentModal.jsx, api.js   <- file list
fix(routing): Fixed the bug.       <- past tense, capitalised, period, no info
```
