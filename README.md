# Governor Extension

The governor extension rewrites pi's system prompt to inject a custom identity, voice instructions, and epistemic guidelines.

## What It Does

Hooks into `before_agent_start` and transforms the system prompt **before** it reaches the model. This event fires on **every user turn** (not just session start); pi rebuilds the base prompt fresh each turn, so the transform is reapplied to a clean prompt each time and never accumulates. Two operations:

1. **Identity replacement** — replaces the default identity line with a custom one (literal match, with a regex fallback if pi rewords the line)
2. **Guideline injection** — inserts voice instructions and epistemic guidelines into the prompt (before the "Pi documentation" block, or appended at the end if that anchor is gone)

Both operations degrade gracefully: if a target string can't be found, the extension emits a one-time warning notification instead of failing silently.

## Base System Prompt Structure

The base system prompt (built by `@earendil-works/pi-coding-agent/dist/core/system-prompt.js`) is assembled in this order:

```
1. Identity line
   "You are an expert coding assistant operating inside pi, ..."

2. Available tools
   "- read: ..."
   "- bash: ..."
   etc.

3. Guidelines
   "- Use bash for file operations..."
   "- Be concise in your responses"
   "- Show file paths clearly when working with files"

4. Pi documentation
   "Pi documentation (read only when the user asks about pi itself...)"
   "- Main documentation: ..."
   "- Additional docs: ..."
   etc.

5. Project context (if any)
   "<project_context>"
   "<project_instructions path=\"<file-path>\">"
   "<content>"
   "</project_instructions>"
   "</project_context>"

6. Skills section (if read tool available and skills exist)
   "<available_skills>...</available_skills>"

7. Date and working directory
   "Current date: YYYY-MM-DD"
   "Current working directory: /path/to/cwd"
```

**The governor injects content between sections 3 (Guidelines) and 4 (Pi documentation).** It finds the `"Pi documentation"` string and inserts before it.

## How to Modify

### Changing the Identity

Edit the `IDENTITY` constant in `index.ts`. It replaces this exact string:

```
You are an expert coding assistant operating inside pi, a coding agent harness. You help users by reading files, executing commands, editing code, and writing new files.
```

With: `You are ${IDENTITY}`

**Robustness:** The replacement tries the literal string first, then falls back to `IDENTITY_PATTERN` (a regex anchored on the stable `"You are an expert coding assistant operating inside pi"` opening). If neither matches, a one-time warning is shown and the default identity is left in place — voice instructions are still injected so the persona mostly holds.

### Changing Voice Instructions

Edit the `VOICE_INSTRUCTIONS` constant. This block is injected **before** the epistemic guidelines and **after** the base guidelines. It controls how the model embodies its identity — tone, terminology, framing.

### Changing Epistemic Guidelines

Edit the `GUIDELINES` constant. These are reasoning standards (Sagan standard, Occam's razor, etc.) that govern how the model handles uncertainty, evidence, and claims.

### Changing Injection Position

The injection point is determined by `prompt.indexOf("Pi documentation")`. To inject elsewhere:

- **Before tools:** find `"Available tools:"`
- **Before guidelines:** find `"Guidelines:"`
- **After skills:** find `"Current date:"`
- **At the very end:** append directly (no indexOf needed)

## File Structure

```
governor/
├── index.ts          # Extension source (identity, voice, guidelines, injection logic)
├── package.json      # Extension manifest (declares ./index.ts as the entry point)
├── tsconfig.json     # TypeScript config (types only; pi supplies the package at runtime)
└── README.md         # This file
```

## Activation

The extension activates automatically when present in `~/.pi/agent/extensions/governor/index.ts` (the `*/index.ts` subdirectory form is auto-discovered from trusted locations). No additional configuration needed. After editing `index.ts`, run `/reload` to hot-reload it — no restart required.

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Warning: "could not find pi's default identity line" | Base identity string changed beyond what the regex fallback matches | Update `DEFAULT_IDENTITY_LINE` / `IDENTITY_PATTERN` in `index.ts` |
| Warning: "could not find the \"Pi documentation\" anchor" | The `"Pi documentation"` string changed (guidelines were appended at the end as a fallback) | Update `INJECTION_ANCHOR` in `index.ts` |
| Identity not changing, no warning | Persona content already present (idempotency guard skipped the turn) | Expected when our output was chained back in; otherwise check the extension loaded |
| Extension not loading | Wrong directory name or missing `index.ts` | Verify path is `~/.pi/agent/extensions/governor/index.ts`, then `/reload` |
| Type errors on another machine | `tsconfig.json` path assumes `~/.pi` + `~/.npm-global` layout | Adjust the relative `paths` mapping to your pi install location |
