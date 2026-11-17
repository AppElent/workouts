/**
 * Shake to report a problem, but never over a sheet or modal.
 *
 * Sentry's feedback form is a React Native `Modal` mounted at the app root, so
 * iOS presents it from the root view controller. While a sheet (a `formSheet`
 * route or any other `Modal`) is already presented there, UIKit refuses the
 * second presentation, and only the form's dark backdrop renders behind the
 * sheet with no way to close it (APP-216). So the shake listener runs only
 * while nothing is presented: every sheet and modal holds a blocker for as long
 * as it is visible, and a shake during that time does nothing.
 */

import * as Sentry from "@sentry/react-native";
import { useEffect } from "react";
import { Platform } from "react-native";

let blockers = 0;
let started = false;
let listening = false;

function sync() {
	const shouldListen = started && blockers === 0;
	if (shouldListen === listening) return;
	listening = shouldListen;
	if (shouldListen) Sentry.enableFeedbackOnShake();
	else Sentry.disableFeedbackOnShake();
}

/** Turns shake-to-report on. Call once, after `Sentry.init`. */
export function startShakeToReport() {
	if (Platform.OS === "web") return;
	started = true;
	sync();
}

/** Pauses shake-to-report while `active` is true, for a visible sheet or modal. */
export function useShakeToReportBlocker(active: boolean) {
	useEffect(() => {
		if (!active) return;
		blockers += 1;
		sync();
		return () => {
			blockers -= 1;
			sync();
		};
	}, [active]);
}

/** Native-stack presentations that cover the screen with a presented controller. */
const PRESENTED = new Set([
	"modal",
	"transparentModal",
	"containedModal",
	"containedTransparentModal",
	"fullScreenModal",
	"formSheet",
	"pageSheet",
]);

export function isPresentedRoute(presentation: string | undefined) {
	return presentation !== undefined && PRESENTED.has(presentation);
}

/** Test-only: forget all state between tests. */
export function resetShakeToReportForTests() {
	blockers = 0;
	started = false;
	listening = false;
}
