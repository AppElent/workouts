/**
 * One identity per EAS profile, so production, preview and development builds
 * install side by side. `app.json` holds everything shared; this file swaps the
 * per-variant name, scheme, bundle ID, package and icons, and fills in the
 * values that have a source elsewhere: colours from the theme palette and the
 * permission prompts from `locales/en.json` (iOS reads the localized copies
 * from `expo.locales`).
 *
 * `APP_VARIANT` is set per profile in `eas.json` and per channel by
 * `scripts/publish-update.mjs`. Unset means a local development build, so a
 * local run never replaces the App Store install.
 */
import type { ConfigContext, ExpoConfig } from "expo/config";
import permissions from "./locales/en.json";
import { darkColors, lightColors } from "./src/theme/palette.ts";

type AppVariant = "development" | "preview" | "production";

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

function variantOf(value = process.env.APP_VARIANT): AppVariant {
	if (!value) return "development";
	if (value in VARIANTS) return value as AppVariant;
	throw new Error(`Unknown APP_VARIANT "${value}"`);
}

/** Options for plugins that `app.json` lists by name only. */
const PLUGIN_OPTIONS: Record<string, object> = {
	"expo-camera": {
		cameraPermission: permissions.NSCameraUsageDescription,
		microphonePermission: false,
		recordAudioAndroid: false,
	},
	"expo-image-picker": {
		photosPermission: permissions.NSPhotoLibraryUsageDescription,
		cameraPermission: permissions.NSCameraUsageDescription,
		microphonePermission: false,
	},
	"expo-notifications": { color: darkColors.accentFill },
	"expo-splash-screen": {
		backgroundColor: lightColors.bg,
		dark: { backgroundColor: darkColors.bg },
	},
};

export default ({ config }: ConfigContext): ExpoConfig => {
	const variant = variantOf();
	const { suffix, name, scheme, icon } = VARIANTS[variant];
	const id = `com.appelent.foundry${suffix}`;
	return {
		...config,
		name,
		slug: "foundry",
		scheme,
		icon: `./assets/icon${icon}.png`,
		backgroundColor: lightColors.bg,
		plugins: config.plugins?.map((plugin) =>
			typeof plugin === "string" && plugin in PLUGIN_OPTIONS
				? [plugin, PLUGIN_OPTIONS[plugin]]
				: plugin,
		),
		ios: { ...config.ios, bundleIdentifier: id },
		android: {
			...config.android,
			package: id,
			backgroundColor: lightColors.bg,
			adaptiveIcon: {
				...config.android?.adaptiveIcon,
				backgroundColor: darkColors.bg,
				foregroundImage: `./assets/adaptive-icon${icon}.png`,
			},
		},
		extra: { ...config.extra, appVariant: variant },
	};
};
