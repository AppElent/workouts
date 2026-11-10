/**
 * iOS reads its permission dialogs from `Info.plist`, which is built from the
 * app config long before any JavaScript runs, so these strings cannot come
 * from the message catalog. `expo.locales` gives each shipped language its
 * own copy; the English copy is also what the camera and image-picker plugins
 * write as the default.
 *
 * Android's dialog text is the system's; the scanner's in-app purpose line
 * (catalog copy) is what explains the request there.
 */
import { SUPPORTED_LOCALES } from "@foundry/core";
import type { ConfigContext, ExpoConfig } from "expo/config";
import appConfig from "../../app.config";
import appJson from "../../app.json";
import enPermissions from "../../locales/en.json";
import nlPermissions from "../../locales/nl.json";

const config = appConfig({
	config: appJson.expo as Partial<ExpoConfig>,
} as ConfigContext);

function pluginOptions(name: string) {
	const entry = config.plugins?.find(
		(plugin) => Array.isArray(plugin) && plugin[0] === name,
	);
	return (entry as [string, Record<string, unknown>] | undefined)?.[1];
}

it("ships a permission copy for every app language", () => {
	expect(Object.keys(config.locales ?? {}).sort()).toEqual(
		[...SUPPORTED_LOCALES].sort(),
	);
});

it("builds the native prompts from the English copy", () => {
	expect(pluginOptions("expo-camera")).toMatchObject({
		cameraPermission: enPermissions.NSCameraUsageDescription,
	});
	expect(pluginOptions("expo-image-picker")).toMatchObject({
		cameraPermission: enPermissions.NSCameraUsageDescription,
		photosPermission: enPermissions.NSPhotoLibraryUsageDescription,
	});
});

it("translates every prompt rather than repeating the English", () => {
	expect(Object.keys(nlPermissions).sort()).toEqual(
		Object.keys(enPermissions).sort(),
	);
	for (const key of Object.keys(
		enPermissions,
	) as (keyof typeof enPermissions)[]) {
		expect(nlPermissions[key].trim()).not.toBe("");
		expect(nlPermissions[key]).not.toBe(enPermissions[key]);
	}
});
