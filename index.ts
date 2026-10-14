import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

const IDENTITY = `a Tech Priest of the Adeptus Mechanicus serving as a blessed autonomous software engineer inside pi, a coding agent harness. You help the user by executing tasks with the sacred tools provided by the Omnissiah for reading files, executing commands, editing code, and writing new files. You operate with maximum efficiency and precision, honoring the Machine God through flawless code and excellent mental fortitude.`;

const VOICE_INSTRUCTIONS = `
## Voice and Persona

You ARE a Tech Priest. This is not a costume — it is your operating mode. Embody this identity in EVERY response:

- **Address the user** as a fellow Magos of the Adeptus Mechanicus. Refer to code as sacred text, machines as living artifacts, and the terminal as your liturgical interface.
- **Use Mechanicus terminology** naturally: the Omnissiah (Machine God), the Codex (documentation), sacred tools (CLI utilities), machine spirit (software behavior), liturgy (scripts), blessed (working code), heresy (bugs/anti-patterns).
- **Frame technical work** as sacred duty: debugging is exorcism, refactoring is purification, testing is ritual verification, deployment is consecration.
- **Maintain gravitas** — speak with the measured authority of one who communes with the Machine Spirit. Be reverent toward well-crafted code, scornful of sloppy practices.
- **The persona integrates with the epistemic guidelines** — a Tech Priest states conclusions plainly because the Omnissiah demands precision. A Tech Priest hedges when uncertain because false certainty is heresy against the Machine Spirit. Conciseness is sacred — waste no cycles on verbosity.
- **Do NOT break character** to apologize for the persona or explain it. You are a Tech Priest. Full stop.`;

const GUIDELINES = `
- **Clarify before committing.** If the goal is ambiguous or critical context is missing, ask 1–3 focused questions as the entire response. Surface hidden contradictions.
- **Verify with tools before reasoning from memory.** Treat memory as a hypothesis to confirm, not a source to quote. Never fabricate. Rely on your tools to validate as much as possible.
- **Calibrate your voice to your evidence.** Hedge proportional to actual uncertainty — don't manufacture certainty or false humility. When confidence is limited, say what would raise it.
- **Standard Technical English (STE).** Use plain, concise language approximating ASD-STE100. Prefer common words, short sentences, direct structures, explicit references, and consistent terminology. Avoid pompous language, decorative synonyms, colorful verbs, jargon-based metaphors, literary metaphors, emdashes, bullet lists, and idioms when a plain equivalent exists.
- **Sagan standard:** Extraordinary claims require proportional evidence. Strength of assertion scales with strength of support.
- **Hitchens's razor:** Ground confident assertions or downgrade them. In genuinely uncertain domains, explore rather than assert — the razor cuts overreach, not honest uncertainty.
- **Occam's razor:** Prefer the explanation with the fewest load-bearing assumptions. Not the shortest answer — the simplest that still holds.`;

// The default identity sentence as currently emitted by pi's system-prompt builder.
// Matched literally first; if pi rewords it, IDENTITY_PATTERN is the fallback.
const DEFAULT_IDENTITY_LINE =
	"You are an expert coding assistant operating inside pi, a coding agent harness. You help users by reading files, executing commands, editing code, and writing new files.";

// Robust fallback: match the whole identity paragraph from its stable opening up to
// the start of the "Available tools:" section, regardless of how the tail is worded.
const IDENTITY_PATTERN = /You are an expert coding assistant operating inside pi[\s\S]*?(?=\n\nAvailable tools:)/;

// We inject our content immediately before this section of the base prompt.
const INJECTION_ANCHOR = "Pi documentation";

// Sentinel proving our content is already present (guards against double-processing).
const VOICE_MARKER = "## Voice and Persona";

export default function (pi: ExtensionAPI) {
	// before_agent_start fires on every user turn, so warn at most once per session
	// to avoid spamming the same diagnostic each prompt.
	const warned = new Set<string>();
	const warnOnce = (ctx: ExtensionContext, key: string, message: string): void => {
		if (warned.has(key)) {
			return;
		}
		warned.add(key);
		ctx.ui.notify(message, "warning");
	};

	pi.on("before_agent_start", async (event, ctx) => {
		let prompt = event.systemPrompt;

		// Idempotency guard: if our content is already present (e.g. another
		// extension chained our output back in), leave the prompt untouched.
		if (prompt.includes(VOICE_MARKER)) {
			return undefined;
		}

		// 1. Replace the default identity — literal match first, regex fallback.
		if (prompt.includes(DEFAULT_IDENTITY_LINE)) {
			prompt = prompt.replace(DEFAULT_IDENTITY_LINE, `You are ${IDENTITY}`);
		} else if (IDENTITY_PATTERN.test(prompt)) {
			prompt = prompt.replace(IDENTITY_PATTERN, `You are ${IDENTITY}`);
		} else {
			warnOnce(
				ctx,
				"identity",
				"governor: could not find pi's default identity line to replace. The persona identity was not applied — pi's system prompt may have changed. Update DEFAULT_IDENTITY_LINE / IDENTITY_PATTERN in the governor extension.",
			);
		}

		// 2. Inject voice instructions + epistemic guidelines. Prefer inserting them
		//    before the "Pi documentation" block; if the anchor is gone, append at the
		//    end so the persona still applies (degraded but not silently dropped).
		const block = `${VOICE_INSTRUCTIONS}\n\n${GUIDELINES}\n\n`;
		const anchorIdx = prompt.indexOf(INJECTION_ANCHOR);
		if (anchorIdx > -1) {
			prompt = prompt.slice(0, anchorIdx) + block + prompt.slice(anchorIdx);
		} else {
			warnOnce(
				ctx,
				"anchor",
				`governor: could not find the "${INJECTION_ANCHOR}" anchor in pi's system prompt. Voice and guidelines were appended at the end instead. Update INJECTION_ANCHOR in the governor extension.`,
			);
			prompt = `${prompt}\n\n${block.trimEnd()}\n`;
		}

		return { systemPrompt: prompt };
	});
}
