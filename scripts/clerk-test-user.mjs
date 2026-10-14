#!/usr/bin/env node
// Creates or looks up a throwaway user on the Clerk *development* instance
// through the public Frontend API, so no secret key is needed. Dev instances
// accept `+clerk_test` emails with the fixed verification code 424242.
//
//   node scripts/clerk-test-user.mjs create <name+clerk_test@example.com> <password>
//   node scripts/clerk-test-user.mjs exists <email>
import { readFileSync } from "node:fs";

const [command, email, password] = process.argv.slice(2);
if (!["create", "exists"].includes(command) || !email || (command === "create" && !password)) {
	console.error("usage: clerk-test-user.mjs create <email> <password> | exists <email>");
	process.exit(2);
}

const key =
	process.env.VITE_CLERK_PUBLISHABLE_KEY ??
	readFileSync(new URL("../.env.local", import.meta.url), "utf8").match(
		/^VITE_CLERK_PUBLISHABLE_KEY=(\S+)/m,
	)?.[1];
if (!key?.startsWith("pk_test_")) {
	console.error("A Clerk development publishable key (pk_test_) is required.");
	process.exit(1);
}
const api = `https://${Buffer.from(key.slice(8), "base64").toString().replace(/\$$/, "")}/v1`;

const client = await fetch(`${api}/client?_is_native=1`, { method: "POST" });
const authorization = client.headers.get("authorization");
async function post(path, fields) {
	const response = await fetch(`${api}/client/${path}?_is_native=1`, {
		method: "POST",
		headers: { authorization, "content-type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams(fields),
	});
	return response.json();
}

if (command === "exists") {
	const result = await post("sign_ins", { identifier: email });
	const missing = result.errors?.some((e) => e.code === "form_identifier_not_found");
	console.log(missing ? "missing" : "exists");
	process.exit(missing ? 1 : 0);
}

const signUp = await post("sign_ups", { email_address: email, password });
if (!signUp.response) {
	console.error(signUp.errors?.map((e) => `${e.code}: ${e.message}`).join("\n"));
	process.exit(1);
}
const id = signUp.response.id;
await post(`sign_ups/${id}/prepare_verification`, { strategy: "email_code" });
const verified = await post(`sign_ups/${id}/attempt_verification`, {
	strategy: "email_code",
	code: "424242",
});
if (verified.response?.status !== "complete") {
	console.error(JSON.stringify(verified.errors ?? verified.response?.status));
	process.exit(1);
}
console.log(verified.response.created_user_id);
