# Governor Extension

The governor extension modifies pi's system prompt at session start to inject custom identity, voice instructions, and epistemic guidelines.

## What It Does

Hooks into `before_agent_start` and transforms the system prompt **before** it reaches the model. Two operations:

1. **Identity replacement** — replaces the default identity line with a custom one
2. **Guideline injection** — inserts voice instructions and epistemic guidelines into the prompt

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
   "# Project Context"
   "## <file-path>"
   "<content>"

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

**Important:** The replacement is a literal string match. If the base prompt changes, the replacement will silently fail (no error, just no replacement).

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
├── tsconfig.json     # TypeScript config
└── README.md         # This file
```

## Activation

The extension activates automatically when present in `.pi/agent/extensions/governor/`. No additional configuration needed. Changes to `index.ts` take effect on the next session start.

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Identity not changing | Base prompt string changed | Update the search string in `prompt.replace()` |
| Guidelines not appearing | `"Pi documentation"` string changed | Update the `indexOf()` search string |
| Extension not loading | Wrong directory name or missing `index.ts` | Verify path is `.pi/agent/extensions/governor/index.ts` |
