#!/usr/bin/env node
// One-off backfill of `appleSignInLinks` for AppElent logins whose Apple link
// predates the Clerk webhook's user.created/user.updated subscription (APP-242).
// Reads users from the Clerk Backend API with a secret key given to this one
// command only, and stores each verified Apple link through the internal
// mutation `account:backfillAppleLinks`. The key never reaches Convex.
//
//   CLERK_SECRET_KEY=sk_... node scripts/backfill-apple-links.mjs            # dry run: counts only
//   CLERK_SECRET_KEY=sk_... node scripts/backfill-apple-links.mjs --apply -- --prod
//
// Arguments after `--` go to `convex run` (for example `--prod`). Safe to
// repeat: a link the webhook stored later is newer and is kept.
import { execFileSync } from "node:child_process";
import { verifiedAppleUserIds } from "../convex/lib/clerkUsers.ts";

const args = process.argv.slice(2);
const split = args.indexOf("--");
const own = split === -1 ? args : args.slice(0, split);
const convexArgs = split === -1 ? [] : args.slice(split + 1);
const apply = own.includes("--apply");

const key = process.env.CLERK_SECRET_KEY;
if (!key?.startsWith("sk_")) {
	console.error("Set CLERK_SECRET_KEY (sk_) for this command only.");
	process.exit(2);
}

const PAGE = 100;
const links = [];
let users = 0;
for (let offset = 0; ; offset += PAGE) {
	const response = await fetch(
		`https://api.clerk.com/v1/users?limit=${PAGE}&offset=${offset}&order_by=created_at`,
		{ headers: { Authorization: `Bearer ${key}` } },
	);
	if (!response.ok) {
		console.error(`Clerk /users returned ${response.status}`);
		process.exit(1);
	}
	const page = await response.json();
	users += page.length;
	for (const user of page) {
		const appleUserIds = verifiedAppleUserIds(user);
		if (appleUserIds.length > 0 && typeof user.updated_at === "number")
			links.push({
				userId: user.id,
				appleUserIds,
				clerkUpdatedAt: user.updated_at,
			});
	}
	if (page.length < PAGE) break;
}

console.log(
	`${users} Clerk users, ${links.length} with a verified Apple link.`,
);
if (!apply) {
	console.log(
		"Dry run. Add --apply (and -- --prod for production) to store them.",
	);
	process.exit(0);
}
for (let start = 0; start < links.length; start += PAGE) {
	const batch = links.slice(start, start + PAGE);
	execFileSync(
		"pnpm",
		[
			"exec",
			"convex",
			"run",
			"account:backfillAppleLinks",
			JSON.stringify({ links: batch }),
			...convexArgs,
		],
		{ stdio: ["ignore", "ignore", "inherit"] },
	);
	console.log(
		`Stored ${Math.min(start + PAGE, links.length)} of ${links.length}.`,
	);
}
