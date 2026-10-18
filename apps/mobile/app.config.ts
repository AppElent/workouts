/**
 * One identity per EAS profile, so production, preview and development builds
 * install side by side. `app.json` holds everything shared; this file only
 * swaps the per-variant name, scheme, bundle ID, package and icons.
 *
 * `APP_VARIANT` is set per profile in `eas.json` and per channel by
 * `scripts/publish-update.mjs`. Unset means a local development build, so a
 * local run never replaces the App Store install.
 */
import type { ConfigContext, ExpoConfig } from "expo/config";

export type AppVariant = "development" | "preview" | "production";

const VARIANTS = {
	production: { suffix: "", name: "Foundry", scheme: "foundry", icon: "" },
	preview: {
		suffix: ".preview",
		name: "Foundry Preview",
		scheme: "foundry-preview",
		icon: "-preview",
	},
	development: {
		suffix: ".dev",
		name: "Foundry Dev",
		scheme: "foundry-dev",
		icon: "-dev",
	},
} as const satisfies Record<AppVariant, object>;

export function appVariant(value = process.env.APP_VARIANT): AppVariant {
	if (!value) return "development";
	if (value in VARIANTS) return value as AppVariant;
	throw new Error(`Unknown APP_VARIANT "${value}"`);
}

export default ({ config }: ConfigContext): ExpoConfig => {
	const variant = appVariant();
	const { suffix, name, scheme, icon } = VARIANTS[variant];
	const id = `com.appelent.foundry${suffix}`;
	return {
		...config,
		name,
		slug: "foundry",
		scheme,
		icon: `./assets/icon${icon}.png`,
		ios: { ...config.ios, bundleIdentifier: id },
		android: {
			...config.android,
			package: id,
			adaptiveIcon: {
				...config.android?.adaptiveIcon,
				foregroundImage: `./assets/adaptive-icon${icon}.png`,
			},
		},
		extra: { ...config.extra, appVariant: variant },
	};
};
