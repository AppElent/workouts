import { redirectSystemPath } from "../../../../app/+native-intent";
import {
	isJoinToken,
	joinRouteFromUrl,
	joinTokenFromPathname,
	joinTokenFromUrl,
	parseJoinInput,
} from "./join-link";

const TOKEN = "aB3dEfGh5jKmNpQr7t";

describe("joinTokenFromUrl", () => {
	it.each([
		`https://foundry.appelent.nl/join/${TOKEN}`,
		`https://foundry.appelent.nl/join/${TOKEN}/`,
		`https://foundry.appelent.nl/join/${TOKEN}?utm_source=whatsapp`,
		`https://foundry.appelent.nl/join/${TOKEN}#leaderboard`,
		`foundry://join/${TOKEN}`,
		`foundry:///join/${TOKEN}`,
		`foundry-preview://join/${TOKEN}`,
		`foundry-dev://join/${TOKEN}`,
		`/join/${TOKEN}`,
		`  https://foundry.appelent.nl/join/${TOKEN}  `,
	])("reads the token from %s", (url) => {
		expect(joinTokenFromUrl(url)).toBe(TOKEN);
	});

	it.each([
		"https://foundry.appelent.nl/",
		"https://foundry.appelent.nl/join/",
		`https://foundry.appelent.nl/hosted/${TOKEN}`,
		`https://foundry.appelent.nl/join/${TOKEN}/extra`,
		`https://evil.example/join/${TOKEN}`,
		`https://foundry.appelent.nl.evil.example/join/${TOKEN}`,
		`https://foundry-stg.appelent.nl/join/${TOKEN}`,
		`http://foundry.appelent.nl/join/${TOKEN}`,
		`https://www.foundry.appelent.nl/join/${TOKEN}`,
		`https://foundry.appelent.nl:8443/join/${TOKEN}`,
		`https://user@foundry.appelent.nl/join/${TOKEN}`,
		`https://foundry.appelent.nl/JOIN/${TOKEN}`,
		`HTTPS://Foundry.Appelent.NL/join/${TOKEN}`,
		`gather://join/${TOKEN}`,
		`https://foundry.appelent.nl/join/${TOKEN}%2F..`,
		"foundry://session?id=abc",
		"",
	])("rejects %s", (url) => {
		expect(joinTokenFromUrl(url)).toBeNull();
	});
});

describe("isJoinToken", () => {
	it("accepts only a bare token", () => {
		expect(isJoinToken(TOKEN)).toBe(true);
		expect(isJoinToken(`https://foundry.appelent.nl/join/${TOKEN}`)).toBe(
			false,
		);
		expect(isJoinToken(`/join/${TOKEN}`)).toBe(false);
		expect(isJoinToken(` ${TOKEN}`)).toBe(false);
		expect(isJoinToken("")).toBe(false);
	});
});

describe("joinTokenFromPathname", () => {
	it.each([`/join/${TOKEN}`, `/join/${TOKEN}/`])("reads %s", (pathname) => {
		expect(joinTokenFromPathname(pathname)).toBe(TOKEN);
	});

	it.each([
		// usePathname() decodes %23 and %3F, so these are whole segments.
		`/join/${TOKEN}#extra`,
		`/join/${TOKEN}?x=1`,
		`/join/${TOKEN}/more`,
		"/join/",
		`/hosted/${TOKEN}`,
	])("rejects %s", (pathname) => {
		expect(joinTokenFromPathname(pathname)).toBeNull();
	});
});

describe("parseJoinInput", () => {
	it("takes a bare code as typed, trimmed", () => {
		expect(parseJoinInput(`  ${TOKEN} `)).toBe(TOKEN);
	});

	it("takes a pasted link", () => {
		expect(parseJoinInput(`https://foundry.appelent.nl/join/${TOKEN}`)).toBe(
			TOKEN,
		);
	});

	it.each(["", "   ", "not a code", "https://example.com"])(
		"rejects %j",
		(input) => {
			expect(parseJoinInput(input)).toBeNull();
		},
	);
});

describe("joinRouteFromUrl", () => {
	it("maps a join link to the join route", () => {
		expect(joinRouteFromUrl(`https://foundry.appelent.nl/join/${TOKEN}`)).toBe(
			`/join/${TOKEN}`,
		);
	});
});

describe("+native-intent redirectSystemPath", () => {
	it.each([
		`https://foundry.appelent.nl/join/${TOKEN}?ref=qr`,
		`foundry://join/${TOKEN}/`,
	])("rewrites %s to the join route", (path) => {
		expect(redirectSystemPath({ path, initial: true })).toBe(`/join/${TOKEN}`);
	});

	it.each([
		"foundry://session?id=abc",
		"/hosted",
		"foundry://oauth-native-callback?code=x",
	])("leaves %s unchanged", (path) => {
		expect(redirectSystemPath({ path, initial: false })).toBe(path);
	});

	it.each([
		`https://foundry.appelent.nl:8443/join/${TOKEN}`,
		`http://foundry.appelent.nl/join/${TOKEN}`,
		`https://evil.example/join/${TOKEN}`,
		"https://foundry.appelent.nl/privacy",
	])("opens Coach for the unclaimed web link %s", (path) => {
		expect(redirectSystemPath({ path, initial: true })).toBe("/");
	});
});
