// PROTOTYPE — throwaway. Provider-neutral structured-generation seam.
//
// Every flow talks to `LlmProvider`, never to an SDK. A provider gets plain
// text/image parts plus a JSON Schema and returns parsed JSON with usage and
// cost. Adding OpenAI later = one more adapter implementing `generate`.
import Anthropic from "@anthropic-ai/sdk";

export type Effort = "off" | "low" | "medium" | "high";

export type Part =
	| { readonly kind: "text"; readonly text: string }
	| {
			readonly kind: "image";
			readonly mediaType: "image/jpeg" | "image/png" | "image/webp";
			readonly base64: string;
	  };

export type GenerateRequest = {
	readonly model: string;
	readonly effort: Effort;
	/** Stable system text. `cachedPrefix` is sent first and marked cacheable. */
	readonly system: string;
	readonly cachedPrefix?: string;
	readonly parts: readonly Part[];
	readonly schema: Record<string, unknown>;
};

export type Usage = {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
};

export type GenerateResult<T> = {
	readonly data: T;
	readonly usage: Usage;
	readonly costUsd: number;
	readonly ms: number;
	readonly model: string;
};

export interface LlmProvider {
	readonly name: string;
	generate<T>(request: GenerateRequest): Promise<GenerateResult<T>>;
}

/** $ per 1M tokens: input, output. Cache read 0.1×, cache write 1.25× input. */
const PRICES: Record<string, { in: number; out: number }> = {
	"claude-haiku-5-5": { in: 0.1, out: 0.5 },
	"claude-sonnet-5-5": { in: 2, out: 10 },
	"claude-opus-5-5": { in: 4, out: 20 },
};

export function addUsage(a: Usage, b: Usage): Usage {
	return {
		input: a.input + b.input,
		output: a.output + b.output,
		cacheRead: a.cacheRead + b.cacheRead,
		cacheWrite: a.cacheWrite + b.cacheWrite,
	};
}

export const ZERO_USAGE: Usage = {
	input: 0,
	output: 0,
	cacheRead: 0,
	cacheWrite: 0,
};

export class AnthropicProvider implements LlmProvider {
	readonly name = "anthropic";
	// `infisical run` injects the secret under its Infisical name.
	private readonly client = new Anthropic({
		apiKey: process.env.ANTHROPIC_API_KEY ?? process.env["anthropic-api-key"],
	});

	async generate<T>(request: GenerateRequest): Promise<GenerateResult<T>> {
		const started = Date.now();
		const system: Anthropic.TextBlockParam[] = [];
		if (request.cachedPrefix) {
			system.push({
				type: "text",
				text: request.cachedPrefix,
				cache_control: { type: "ephemeral" },
			});
		}
		system.push({ type: "text", text: request.system });

		const content: Anthropic.ContentBlockParam[] = request.parts.map((part) =>
			part.kind === "text"
				? { type: "text", text: part.text }
				: {
						type: "image",
						source: {
							type: "base64",
							media_type: part.mediaType,
							data: part.base64,
						},
					},
		);

		// "off" = no thinking. Haiku accepts `disabled`; Sonnet 5.5 needs
		// `between_tools` (equivalent when no tools are declared).
		const thinking: Anthropic.ThinkingConfigParam =
			request.effort === "off"
				? request.model.includes("sonnet")
					? { type: "between_tools" }
					: { type: "disabled" }
				: { type: "adaptive" };

		const response = await this.client.messages.create({
			model: request.model,
			max_tokens: 16000,
			system,
			thinking,
			output_config: {
				effort: request.effort === "off" ? "low" : request.effort,
				format: { type: "json_schema", schema: request.schema },
			},
			messages: [{ role: "user", content }],
		});

		if (response.stop_reason === "refusal") {
			throw new Error(`refusal: ${JSON.stringify(response.stop_details)}`);
		}
		const text = response.content
			.filter((block) => block.type === "text")
			.map((block) => block.text)
			.join("");
		const usage: Usage = {
			input: response.usage.input_tokens,
			output: response.usage.output_tokens,
			cacheRead: response.usage.cache_read_input_tokens ?? 0,
			cacheWrite: response.usage.cache_creation_input_tokens ?? 0,
		};
		return {
			data: JSON.parse(text) as T,
			usage,
			costUsd: cost(request.model, usage),
			ms: Date.now() - started,
			model: request.model,
		};
	}
}

export function cost(model: string, usage: Usage): number {
	const price = PRICES[model];
	if (!price) return Number.NaN;
	return (
		(usage.input * price.in +
			usage.cacheRead * price.in * 0.1 +
			usage.cacheWrite * price.in * 1.25 +
			usage.output * price.out) /
		1_000_000
	);
}

export function providerFor(name: string): LlmProvider {
	if (name === "anthropic") return new AnthropicProvider();
	throw new Error(`No adapter for provider "${name}" yet (openai: TODO).`);
}
