import * as loaded from "../env.manifest.ts";
import {
	resolveEnvironmentManifest,
	STANDARD_SOURCE,
	validateEnvironmentManifest,
} from "./lib/env/index.mjs";

const manifest = resolveEnvironmentManifest(loaded);
const { ENTRIES, ENV_CONFIG, ENVIRONMENTS } = manifest;
const placements = (environment) =>
	manifest.placementsFor(environment, { prNumber: "12" });
const byKey = (key) => ENTRIES.find((entry) => entry.key === key);

describe("Foundry environment manifest", () => {
	it("is data only and uses the shared routing", () => {
		expect(Object.keys(loaded).sort()).toEqual([
			"ENTRIES",
			"ENVIRONMENTS",
			"ENV_CONFIG",
		]);
		expect(ENVIRONMENTS).toEqual([
			"local",
			"dev",
			"preview",
			"staging",
			"production",
		]);
		expect(ENV_CONFIG.source.environments).toMatchObject(STANDARD_SOURCE);
		expect(ENV_CONFIG.routes).toBeUndefined();
		expect(
			validateEnvironmentManifest(manifest).filter(
				(finding) => finding.level !== "note",
			),
		).toEqual([]);
	});

	it("targets the app's real deployments and Workers", () => {
		const target = (environment, consumer) =>
			placements(environment).find(
				(placement) => placement.consumer === consumer,
			)?.destination;
		expect(target("local", "convex-functions")).toMatchObject({
			deployment: "colorless-sturgeon-704",
		});
		expect(target("dev", "convex-functions")).toMatchObject({
			deployment: "colorless-sturgeon-704",
		});
		expect(target("production", "convex-functions")).toMatchObject({
			deployment: "fine-akita-444",
		});
		expect(target("preview", "convex-functions")).toMatchObject({
			target: "preview-default",
			project: "eric-jansen:workout-tracker",
		});
	});

	it("never lands a deployed environment in a local file", () => {
		for (const environment of ["dev", "preview", "staging", "production"])
			for (const placement of placements(environment))
				expect(placement.destination.kind).not.toBe("file");
	});

	it("never routes local preparation to a production destination", () => {
		for (const placement of placements("local")) {
			expect(placement.destination).not.toMatchObject({
				deployment: "fine-akita-444",
			});
			expect(placement.destination).not.toEqual({
				kind: "eas",
				environment: "production",
			});
			expect(placement.destination.kind).not.toBe("github");
		}
	});

	it("writes preview values to repository scope under PREVIEW_ names", () => {
		const names = placements("preview")
			.filter((placement) => placement.destination.kind === "github")
			.map((placement) => placement.name);
		expect(names.every((name) => name.startsWith("PREVIEW_"))).toBe(true);
		expect(names).toEqual(
			expect.arrayContaining([
				"PREVIEW_VITE_CLERK_PUBLISHABLE_KEY",
				"PREVIEW_CONVEX_DEPLOY_KEY",
				"PREVIEW_CLOUDFLARE_API_TOKEN",
				"PREVIEW_CLOUDFLARE_ACCOUNT_ID",
				"PREVIEW_EXPO_TOKEN",
			]),
		);
		const previewUrl = placements("preview").find(
			(placement) =>
				placement.entry.key === "convexUrl" &&
				placement.consumer === "vite-build",
		);
		expect(previewUrl?.suppliedBy).toContain("convex deploy");
	});

	it("gives web PR previews development auth and staging production auth", () => {
		const clerk = (environment) =>
			placements(environment)
				.filter((placement) => /CLERK/.test(placement.name))
				.map(
					(placement) =>
						`${placement.consumer} ${placement.entry.infisicalKey}`,
				);
		// Infisical staging (preview) holds dev Clerk values; prod (staging) live ones.
		expect(clerk("preview")).toEqual([
			"vite-build clerk-publishable-key",
			"convex-functions clerk-jwt-issuer-domain",
		]);
		expect(STANDARD_SOURCE.staging).toBe("prod");
		expect(clerk("staging")).toEqual(
			expect.arrayContaining([
				"vite-build clerk-publishable-key",
				"expo-build clerk-publishable-key",
			]),
		);
	});

	it("lands staging in the staging web and the installed preview app", () => {
		const staging = placements("staging");
		expect(staging.length).toBeGreaterThan(0);
		for (const placement of staging)
			expect([
				{ kind: "eas", environment: "preview" },
				{ kind: "github", scope: "staging" },
				{
					kind: "convex",
					target: "staging",
					deployment: ENV_CONFIG.convex.deployments.staging,
				},
			]).toContainEqual(placement.destination);
		expect(
			placements("preview").some(
				(placement) => placement.destination.kind === "eas",
			),
		).toBe(false);
	});

	it("gives the staging web its own Convex deploy key", () => {
		const key = (environment) =>
			placements(environment).find(
				(placement) => placement.variable === "CONVEX_DEPLOY_KEY",
			)?.entry.infisicalKey;
		expect(key("staging")).toBe("convex-staging-deploy-key");
		expect(key("production")).toBe("convex-deploy-key");
	});

	it("names every value deploy.yml reads in staging and production", () => {
		for (const environment of ["staging", "production"]) {
			const names = placements(environment)
				.filter((placement) => placement.destination.kind === "github")
				.map((placement) => placement.variable);
			expect(names).toEqual(
				expect.arrayContaining([
					"CONVEX_DEPLOY_KEY",
					"CLOUDFLARE_API_TOKEN",
					"CLOUDFLARE_ACCOUNT_ID",
					"SENTRY_AUTH_TOKEN",
					"VITE_CLERK_PUBLISHABLE_KEY",
					"VITE_SENTRY_DSN",
				]),
			);
		}
	});

	it("gives deploy:production an explicit Convex target", () => {
		const github = placements("production").filter(
			(placement) => placement.destination.kind === "github",
		);
		expect(github.map((placement) => placement.variable)).toContain(
			"CONVEX_DEPLOY_KEY",
		);
		expect(
			placements("dev").some(
				(placement) => placement.variable === "CONVEX_DEPLOY_KEY",
			),
		).toBe(false);
	});

	it("never routes a secret to a public client", () => {
		for (const entry of ENTRIES) {
			if (!entry.secret) continue;
			expect(entry.lands["vite-build"]).toBeUndefined();
			expect(entry.lands["expo-build"]).toBeUndefined();
			expect(entry.lands["expo-local"]).toBeUndefined();
		}
	});

	it("lands test-user values only in local and dev", () => {
		for (const key of ["testUserEmail", "testUserPassword"]) {
			expect(byKey(key)).toMatchObject({ optional: true, secret: false });
			for (const environment of ["preview", "staging", "production"])
				expect(
					placements(environment).some(
						(placement) => placement.entry.key === key,
					),
				).toBe(false);
		}
	});

	it("declares only names the code reads", () => {
		const names = ENTRIES.flatMap((entry) =>
			Object.values(entry.lands).map((landing) => landing.name),
		);
		expect(names).not.toEqual(
			expect.arrayContaining(["CONVEX_SITE_URL", "VITE_CONVEX_SITE_URL"]),
		);
		const sourceNames = ENTRIES.map((entry) => entry.infisicalKey);
		expect(new Set(sourceNames).size).toBe(sourceNames.length);
	});

	it("keeps the AI and Sign in with Apple keys in Convex functions only", () => {
		const keys = [
			"anthropicApiKey",
			"appleTeamId",
			"appleSignInKeyId",
			"appleSignInPrivateKey",
		];
		// Every environment with a named backend. Staging's Convex deployment is
		// named in ENV_CONFIG once it exists; until then it has no destination.
		const withBackend = ENVIRONMENTS.filter(
			(name) => name !== "staging" || ENV_CONFIG.convex.deployments.staging,
		);
		for (const environment of withBackend) {
			const selected = placements(environment).filter((placement) =>
				keys.includes(placement.entry.key),
			);
			expect(selected).toHaveLength(keys.length);
			for (const placement of selected) {
				expect(placement.consumer).toBe("convex-functions");
				expect(placement.entry.secret).toBe(true);
			}
		}
	});

	it("keeps Sentry upload credentials out of client bundles", () => {
		for (const environment of ENVIRONMENTS)
			for (const placement of placements(environment))
				if (placement.entry.key === "sentryAuthToken")
					expect(placement.name).toMatch(/SENTRY_AUTH_TOKEN$/);
		expect(byKey("sentryAuthToken")).toMatchObject({
			optional: true,
			secret: true,
		});
	});
});
