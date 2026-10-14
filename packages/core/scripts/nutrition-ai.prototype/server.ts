// PROTOTYPE — throwaway. Tiny local server for the playground page.
//
//   pnpm --filter @foundry/core prototype:nutrition-ai     → http://<host>:5179
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { networkInterfaces } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runLabel, runMeal, type Strategy } from "./flows";
import { type Effort, type Part, providerFor } from "./provider";

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 5179);

type Body = {
	flow: "label" | "text" | "photo";
	provider: string;
	model: string;
	effort: Effort;
	strategy: Strategy;
	text?: string;
	image?: {
		mediaType: "image/jpeg" | "image/png" | "image/webp";
		base64: string;
	};
	off?: boolean;
};

createServer(async (req, res) => {
	try {
		if (
			req.method === "GET" &&
			(req.url === "/" || req.url === "/index.html")
		) {
			res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
			res.end(readFileSync(join(here, "index.html")));
			return;
		}
		if (req.method === "GET" && req.url?.startsWith("/fixtures/")) {
			const name = req.url.slice("/fixtures/".length).replace(/[^\w.-]/g, "");
			res.writeHead(200, { "content-type": "image/jpeg" });
			res.end(readFileSync(join(here, "fixtures", name)));
			return;
		}
		if (req.method === "POST" && req.url === "/api/run") {
			const chunks: Buffer[] = [];
			for await (const chunk of req) chunks.push(chunk as Buffer);
			const body = JSON.parse(Buffer.concat(chunks).toString()) as Body;
			const config = {
				provider: providerFor(body.provider),
				model: body.model,
				effort: body.effort,
			};
			const image: Part | undefined = body.image
				? { kind: "image", ...body.image }
				: undefined;
			let result: unknown;
			if (body.flow === "label") {
				if (!image) throw new Error("label flow needs an image");
				result = await runLabel(config, image, { off: body.off });
			} else {
				const parts: Part[] =
					body.flow === "photo"
						? [
								image!,
								{ kind: "text", text: body.text || "What is in this meal?" },
							]
						: [{ kind: "text", text: body.text ?? "" }];
				result = await runMeal(config, parts, body.strategy);
			}
			res.writeHead(200, { "content-type": "application/json" });
			res.end(JSON.stringify(result));
			return;
		}
		res.writeHead(404).end();
	} catch (error) {
		res.writeHead(500, { "content-type": "application/json" });
		res.end(JSON.stringify({ error: String(error) }));
	}
}).listen(PORT, "0.0.0.0", () => {
	const lan = Object.values(networkInterfaces())
		.flat()
		.find((i) => i?.family === "IPv4" && !i.internal)?.address;
	console.log(`PROTOTYPE nutrition-ai → http://${lan ?? "localhost"}:${PORT}`);
	if (!process.env.ANTHROPIC_API_KEY && !process.env["anthropic-api-key"])
		console.log(
			"⚠ ANTHROPIC_API_KEY not set — run via `infisical run --env=dev --path=/foundry -- …`",
		);
});
