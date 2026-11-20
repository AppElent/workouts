import Constants from "expo-constants";
import * as Updates from "expo-updates";
import { formatOtaLabel } from "../../observability/ota-label";

type BuildInfoText = {
	version: string;
	update: string;
	noUpdate: string;
};

type BuildInfo = {
	version?: string | null;
	build?: string | null;
	channel?: string | null;
	/** True when no OTA update is applied: the bundle shipped inside the app. */
	embedded: boolean;
	publishedAt?: Date | null;
	sha?: string | null;
};

/**
 * `Versie <version> (<build>) · update <label> · <channel>`, or `geen update`
 * in place of `update <label>` on the embedded bundle (standards/releases.md,
 * "OTA label"). Parts the device cannot report are left out.
 */
export function formatBuildInfo(info: BuildInfo, text: BuildInfoText): string {
	const parts = [
		[text.version, info.version, info.build ? `(${info.build})` : ""]
			.filter(Boolean)
			.join(" "),
		info.embedded ? text.noUpdate : `${text.update} ${otaLabel(info)}`,
		info.channel,
	];
	return parts.filter(Boolean).join(" · ");
}

function otaLabel({ version, publishedAt, sha }: BuildInfo): string {
	try {
		return formatOtaLabel(version ?? "", publishedAt ?? "", sha ?? "");
	} catch {
		// An update published before the sha was passed into the bundle.
		return "?";
	}
}

/** The running build, read from the native config and `expo-updates`. */
export function currentBuildInfo(): BuildInfo {
	return {
		version: Constants.expoConfig?.version,
		build: Constants.nativeBuildVersion,
		channel: Updates.channel,
		// A development client loads its bundle from Metro, never an OTA update.
		embedded: __DEV__ || !Updates.isEnabled || Updates.isEmbeddedLaunch,
		publishedAt: Updates.createdAt,
		// Inlined by Metro at publish time (publish-update.mjs).
		sha: process.env.EXPO_PUBLIC_GIT_SHA,
	};
}
