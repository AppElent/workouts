/**
 * The camera prompt is the one piece of Nutrition copy the message tree cannot
 * reach.
 *
 * iOS reads its permission dialog from `Info.plist`, which is built from
 * `app.json` long before any JavaScript runs — so a purpose string translated
 * only in `messages/nl.ts` still appears in English on a Dutch phone, in the
 * single dialog where an unexplained request is most likely to be refused.
 * `expo.locales` is how that string gets a Dutch copy, and this is what stops
 * the Dutch copy from being quietly dropped or left behind.
 *
 * Android has no equivalent: its dialog text is supplied by the system and is
 * not settable by the app. What Android gets instead is the in-app purpose
 * line the scanner shows *before* asking, which is ordinary message-tree copy
 * and is covered by `messages.test.ts` like the rest.
 */
import appConfig from "../../app.json";
import enPermissions from "../../locales/en.json";
import nlPermissions from "../../locales/nl.json";
import { en } from "./messages/en";
import { nl } from "./messages/nl";

const locales = appConfig.expo.locales as Record<string, string>;

describe("the camera permission prompt", () => {
	it("is offered in both languages the app ships", () => {
		expect(Object.keys(locales).sort()).toEqual(["en", "nl"]);
	});

	it("explains the same purpose in each language", () => {
		for (const copy of [enPermissions, nlPermissions]) {
			expect(copy.NSCameraUsageDescription.trim().length).toBeGreaterThan(0);
		}
		// Not the same sentence in two languages — that would mean one of them
		// was never translated.
		expect(nlPermissions.NSCameraUsageDescription).not.toBe(
			enPermissions.NSCameraUsageDescription,
		);
	});

	it("names barcodes and nutrition, so the request is not an unexplained camera grab", () => {
		expect(enPermissions.NSCameraUsageDescription.toLowerCase()).toContain(
			"barcode",
		);
		expect(enPermissions.NSCameraUsageDescription.toLowerCase()).toContain(
			"nutrition",
		);
		expect(nlPermissions.NSCameraUsageDescription.toLowerCase()).toContain(
			"barcode",
		);
		expect(nlPermissions.NSCameraUsageDescription.toLowerCase()).toContain(
			"voedingswaarden",
		);
	});

	it("says in-app what the system dialog is about to ask, in both languages", () => {
		// The line the scanner shows before requesting. Android has only this.
		expect(en.nutrition.barcode.purpose.toLowerCase()).toContain("barcode");
		expect(nl.nutrition.barcode.purpose.toLowerCase()).toContain("barcode");
		expect(en.nutrition.barcode.purpose).not.toBe(nl.nutrition.barcode.purpose);
	});
});
