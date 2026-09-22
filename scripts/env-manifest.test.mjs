import {
	CONSUMERS,
	destinationFor,
	ENTRIES,
	ENV_CONFIG,
	ENVIRONMENTS,
	placementsFor,
} from "../env.manifest.ts";

const byKey = (key) => ENTRIES.find((entry) => entry.key === key);

describe("Workouts environment routing", () => {
	it("uses the app's real environment and provider identities", () => {
		expect(ENVIRONMENTS).toEqual([
			"local",
			"preview",
			"dev",
			"production",
		]);
		expect(ENV_CONFIG.source.paths).toEqual(["/", "/workouts"]);
		expect(ENV_CONFIG.source.environments).toEqual({
			local: "dev",
			preview: "staging",
			dev: "staging",
			production: "prod",
		});
		expect(ENV_CONFIG.mobile.path).toBe("apps/mobile");
		expect(ENV_CONFIG.github.repository).toBe("AppElent/workouts");
		expect(destinationFor("convex-functions", "dev")).toMatchObject({
			kind: "convex",
			deployment: "colorless-sturgeon-704",
		});
		expect(destinationFor("convex-functions", "production")).toMatchObject({
			kind: "convex",
			deployment: "fine-akita-444",
		});
	});

	it("answers every consumer/environment pair without staging", () => {
		for (const consumer of CONSUMERS) {
			for (const environment of ENVIRONMENTS) {
				expect(() => destinationFor(consumer, environment)).not.toThrow();
			}
		}
		expect(ENVIRONMENTS).not.toContain("stg");
	});

	it("never routes local preparation to a production destination", () => {
		for (const placement of placementsFor("local")) {
			expect(placement.destination).not.toMatchObject({
				kind: "convex",
				target: "production",
			});
			expect(placement.destination).not.toEqual({
				kind: "eas",
				environment: "production",
			});
			expect(placement.destination).not.toEqual({
				kind: "github",
				scope: "production",
			});
		}
	});

	it("preserves app-owned local and mobile files", () => {
		expect(destinationFor("vite-build", "local")).toEqual({
			kind: "file",
			path: ".env.local",
		});
		expect(destinationFor("vite-build", "dev")).toEqual({
			kind: "file",
			path: ".env.development.local",
		});
		expect(destinationFor("vite-build", "production")).toEqual({
			kind: "file",
			path: ".env.production.local",
		});
		expect(destinationFor("expo-local", "local")).toEqual({
			kind: "file",
			path: "apps/mobile/.env.local",
		});
	});

	it("uses the existing preview GitHub secret names", () => {
		const names = placementsFor("preview")
			.filter((placement) => placement.destination.kind === "github")
			.map((placement) => placement.name);
		expect(names).toEqual(
			expect.arrayContaining([
				"PREVIEW_CLERK_PUBLISHABLE_KEY",
				"CONVEX_DEPLOY_KEY",
				"NODE_AUTH_TOKEN",
				"CLOUDFLARE_API_TOKEN",
				"CLOUDFLARE_ACCOUNT_ID",
			]),
		);
	});

	it("marks workspace and preview URLs as generated outputs", () => {
		const localFiles = placementsFor("local").filter(
			(placement) =>
				placement.entry.key === "convexUrl" &&
				placement.destination.kind === "file",
		);
		expect(localFiles).toHaveLength(2);
		expect(localFiles.every((placement) => placement.suppliedBy)).toBe(true);

		const previewWebUrl = placementsFor("preview").find(
			(placement) =>
				placement.entry.key === "convexUrl" &&
				placement.consumer === "vite-build",
		);
		expect(previewWebUrl?.suppliedBy).toContain("convex deploy");
	});

	it("never routes a secret to a public client", () => {
		for (const entry of ENTRIES) {
			if (!entry.secret) continue;
			expect(entry.lands["vite-build"]).toBeUndefined();
			expect(entry.lands["expo-build"]).toBeUndefined();
			expect(entry.lands["expo-local"]).toBeUndefined();
		}
	});

	it("keeps test credentials optional, public, and out of production", () => {
		for (const key of ["testUserEmail", "testUserPassword"]) {
			const entry = byKey(key);
			expect(entry).toMatchObject({ optional: true, secret: false });
			expect(
				placementsFor("production").some(
					(placement) => placement.entry.key === key,
				),
			).toBe(false);
		}
		expect(byKey("convexDeployKey")?.optional).toBeUndefined();
		expect(byKey("nodeAuthToken")?.optional).toBeUndefined();
	});

	it("gives every logical value a unique evidenced source name", () => {
		expect(ENTRIES).toHaveLength(11);
		const sourceNames = ENTRIES.map((entry) => entry.infisicalKey);
		expect(new Set(sourceNames).size).toBe(sourceNames.length);
		expect(sourceNames).not.toEqual(
			expect.arrayContaining([
				"CLERK_SECRET_KEY",
				"VITE_CONVEX_SITE_URL",
				"REGISTRY_OWNER",
				"CLOUDFLARE_ENV",
			]),
		);
	});

	it("claims each destination slot only once", () => {
		for (const environment of ENVIRONMENTS) {
			const seen = new Set();
			for (const placement of placementsFor(environment)) {
				const slot = `${JSON.stringify(placement.destination)}/${placement.name}`;
				expect(seen.has(slot)).toBe(false);
				seen.add(slot);
			}
		}
	});
});
