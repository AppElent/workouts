import { formatBuildInfo } from "./build-info";

const nl = { version: "Versie", update: "update", noUpdate: "geen update" };

it("shows the OTA label and channel for an applied update", () => {
	expect(
		formatBuildInfo(
			{
				version: "1.0.0",
				build: "42",
				channel: "preview",
				embedded: false,
				publishedAt: new Date("2026-11-20T09:12:00Z"),
				sha: "a1b2c3d4e5f6",
			},
			nl,
		),
	).toBe("Versie 1.0.0 (42) · update 1.0.0 · 20 nov · a1b2c3d · preview");
});

it("says there is no update on the embedded bundle", () => {
	expect(
		formatBuildInfo(
			{ version: "1.0.0", build: "42", channel: "production", embedded: true },
			nl,
		),
	).toBe("Versie 1.0.0 (42) · geen update · production");
});

it("leaves out what the device cannot report", () => {
	expect(formatBuildInfo({ version: "1.0.0", embedded: true }, nl)).toBe(
		"Versie 1.0.0 · geen update",
	);
});
