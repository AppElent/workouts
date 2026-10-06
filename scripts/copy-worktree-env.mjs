import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const projectRoot = process.env.T3CODE_PROJECT_ROOT;
if (!projectRoot) {
	throw new Error("T3CODE_PROJECT_ROOT must point to the source checkout.");
}

for (const file of [".env.local", "apps/mobile/.env.local"]) {
	const source = resolve(projectRoot, file);
	const destination = resolve(file);
	if (source === destination) continue;

	mkdirSync(dirname(destination), { recursive: true });
	copyFileSync(source, destination);
	console.log(`Copied ${file} into worktree.`);
}
