import { appendFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const token = process.env.NODE_AUTH_TOKEN;

if (!token) {
	console.error(
		"NODE_AUTH_TOKEN is required to install the private @appelent packages on EAS.",
	);
	process.exit(1);
}

appendFileSync(
	join(homedir(), ".npmrc"),
	`\n//npm.pkg.github.com/:_authToken=${token}\n`,
	{
		encoding: "utf8",
		mode: 0o600,
	},
);

console.log("Configured GitHub Packages authentication for EAS Build.");
