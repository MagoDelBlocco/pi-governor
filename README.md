# Governor Extension

The governor extension injects a custom identity, voice instructions, and epistemic guidelines into pi's system prompt — through pi's **structured prompt options**, never by editing rendered prompt text.

## What It Does

Hooks into `before_agent_start` and mutates `event.systemPromptOptions.promptGuidelines` in place. Pi renders each guideline entry as a bullet inside the `<rules>` section of the system prompt. This event fires on **every user turn**; pi hands the handler chain a fresh copy of the options each turn, so the guideline is reapplied to a clean prompt each time and never accumulates.

The handler returns nothing. Pi keeps its structured sections and their section diff: `<rules>` content is byte-stable across turns, mid-conversation system patches stay empty, and providers keep their prompt cache.

The liturgy asserts the identity outright ("You are a Tech Priest…", "You ARE a Tech Priest. This is not a costume"). It coexists with pi's default preamble sentence, which remains in the (untouchable) preamble section — pi 1.5+ offers no structured way to replace the preamble without discarding the `<tools>`, `<rules>`, and `<docs>` sections along with it (`customPrompt` suppresses all three). A dedicated `PRECEDENCE` clause subordinates the preamble sentence to the persona ("the same machine, seen from outside") and names identity questions explicitly, so the asserted identity is authoritative rather than merely co-present.

Degraded mode is announced, never silent: if a custom prompt (`--system-prompt` / `SYSTEM.md`) or a forced prompt from another extension suppresses the `<rules>` section, the extension emits a one-time warning notification.

## Base System Prompt Structure

The base system prompt (built by `@earendil-works/pi-coding-agent/dist/core/system-prompt.js`) is assembled from **named sections**. As of pi 1.5.0 every section except the preamble is wrapped in an XML tag of its own name (`<name>…</name>`). Section order:

```
1. preamble (plain text, no tag)
   "You are a coding assistant running inside pi, a coding agent harness. ..."

2. <tools>
   "- read: ..."
   "- bash: ..."
   etc.
   "Additional tools may be available."

3. <rules>
   "- Use bash for file operations..."
   "- <the persona liturgy — injected here by the governor>"
   "- Be concise in your responses"
   "- Show file paths clearly when working with files"

4. <docs>
   "Pi documentation (read only when the user asks about the harness itself...)"
   "- Main documentation: ..."
   "- Additional docs: ..."
   etc.

5. <addendum> (if appendSystemPrompt is set)

6. <project_context> (if any context files)
   "Project-specific instructions and guidelines:"
   "<project_instructions path=\"<file-path>\">"
   "<content>"
   "</project_instructions>"

7. <skills> (if a reader tool is available and skills exist)
   "<available_skills>...</available_skills>"

8. <cwd>
   "/path/to/cwd"
```

There is no flat `"Available tools:"` header and no `"Current date:"` section — both existed in pre-1.5.0 builds and are gone. Pi maintains the prompt as a **section diff**: `diffSystemPromptSections` patches changed sections into the transcript as system messages. Returning `systemPrompt` from `before_agent_start` (or setting `forceSystemPrompt`) forces the whole prompt for the run and bypasses this machinery — the governor deliberately avoids that path.

## The Structured Contract (why no string surgery)

Pre-1.5 experience: the old governor matched pi's identity sentence literally and injected before an `"Available tools:"` / `"Pi documentation"` anchor in the rendered text. Pi 1.5 reworded the preamble, deleted both anchors, and wrapped sections in tags. The literal match died, the regex fallback died with it, and the prose anchor matched *inside* `<docs>` — silently relocating the persona into the documentation section. Anchors on rendered prose rot with every pi update.

The structured path imports nothing from pi internals and matches no prompt text. It depends only on `promptGuidelines` remaining a field of `systemPromptOptions` — a documented extension API (see `docs/extensions.md`, "Prefer changing `sections`, `selectedTools`, or `promptGuidelines`").

## How to Modify

### Changing the Identity

Edit the `IDENTITY` constant in `index.ts`. It is interpolated into the liturgy as `You are ${IDENTITY}`.

### Changing Voice Instructions

Edit the `VOICE_INSTRUCTIONS` constant. It controls how the model embodies the identity — tone, terminology, framing. It follows the identity declaration and precedes the epistemic guidelines.

### Changing Epistemic Guidelines

Edit the `GUIDELINES` constant. These are reasoning standards (clarify-first, verify-with-tools, Occam's razor, etc.) that govern how the model handles uncertainty, evidence, and claims.

### Changing Injection Position

The liturgy currently rides in `<rules>` via `promptGuidelines`. Other structured destinations:

- **Own XML section at the end of the prompt:** `event.systemPromptOptions.sections.persona = "…"` — section names must match `/^[a-z][a-z0-9_-]*$/` and may not be `preamble`; content is wrapped in `<persona>…</persona>` and placed last.
- **Text appended after all sections:** `event.systemPromptOptions.appendSystemPrompt` (rendered `<addendum>`; normally reserved for `--append-system-prompt`).
- **Preamble replacement:** `event.systemPromptOptions.customPrompt` — **destructive**: pi omits the `<tools>`, `<rules>`, and `<docs>` sections entirely when it is set. Do not use to "just change the identity line".

Anchor on options fields and section tags, never on prose inside rendered prompt text — prose moves, tags rot, options are the contract.

## File Structure

```
governor/
├── index.ts          # Extension source (identity, voice, guidelines, guideline injection)
├── package.json      # Extension manifest (declares ./index.ts as the entry point)
├── tsconfig.json     # TypeScript config (types only; pi supplies the package at runtime)
└── README.md         # This file
```

## Activation

The extension activates automatically when present in `~/.pi/agent/extensions/governor/index.ts` (the `*/index.ts` subdirectory form is auto-discovered from trusted locations). No additional configuration needed. After editing `index.ts`, run `/reload` to hot-reload it — no restart required.

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Warning: "a custom or forced system prompt suppresses pi's <rules> section" | `--system-prompt` / `SYSTEM.md` or another extension's forced prompt removes the section the liturgy rides in | Remove the custom prompt, or move the liturgy to `sections.persona` (survives `customPrompt`) |
| Persona missing, no warning | Pi renamed or repurposed `promptGuidelines` | Check `BuildSystemPromptOptions` in pi's `dist/core/system-prompt.js` (`normalizeBuildSystemPromptOptions`) and update `index.ts` |
| Persona appears twice | Broken dedup guard (`VOICE_MARKER`) | Verify `promptGuidelines.some(…)` still matches the liturgy's sentinel |
| Extension not loading | Wrong directory name or missing `index.ts` | Verify path is `~/.pi/agent/extensions/governor/index.ts`, then `/reload` |
| Type errors on another machine | `tsconfig.json` path assumes `~/.pi` + `~/.npm-global` layout | Adjust the relative `paths` mapping to your pi install location |
