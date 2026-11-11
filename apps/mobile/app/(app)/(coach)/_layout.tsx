/**
 * The tab bar (`designs/shell/index.html`). It gets its own route group
 * because expo-router keeps navigation state per route: a `NativeTabs`
 * navigator cannot share a route with the `Stack` that pushes the session and
 * summary screens over it. See `docs/records/2026-08-20-shell-prototype/README.md`.
 *
 * **Five is the ceiling.** UIKit collapses a sixth tab into a system "More"
 * tab, which would change this app's navigation semantics without anybody
 * deciding to. A sixth area has to displace something rather than be appended.
 *
 * Colours are `chrome` (UIKit-resolved dynamic colours), never `colors`: on
 * iOS 26 the glass picks its own trait from the content under it and comes up
 * light for a moment even with the dark pin in Info.plist, so a static colour
 * would put a lime icon on light glass.
 */
import { useSegments } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import { Platform, View } from "react-native";
import { useActiveSession } from "../../../src/data/session-data";
import { useFirstRunPrompt } from "../../../src/features/onboarding/first-run/use-first-run-prompt";
import { ActiveSessionBar } from "../../../src/features/strength-session/components/active-session-bar";
import { useI18n } from "../../../src/i18n";
import { chrome, useTokens } from "../../../src/theme";
import { isIOS26OrLater } from "../../../src/ui/platform";
import {
	TabBarVisibilityProvider,
	useTabBarVisibility,
} from "../../../src/ui/tab-bar-visibility";

export default function CoachTabsLayout() {
	return (
		<TabBarVisibilityProvider>
			<CoachTabs />
		</TabBarVisibilityProvider>
	);
}
function CoachTabs() {
	const { hidden } = useTabBarVisibility();
	const colors = useTokens();
	const tabColors = Platform.OS === "ios" ? chrome : colors;
	const { t } = useI18n();
	const segments = useSegments();
	// The resume affordance belongs to training; other tabs keep their space.
	const showSession =
		Boolean(useActiveSession()) &&
		segments.some((segment) => segment === "train");
	const hasAccessory = isIOS26OrLater();
	useFirstRunPrompt();

	return (
		<View style={{ flex: 1 }}>
			{!hasAccessory && showSession ? <ActiveSessionBar /> : null}
			<NativeTabs
				hidden={hidden}
				backgroundColor={Platform.OS === "ios" ? undefined : colors.surface}
				minimizeBehavior="onScrollDown"
				tintColor={tabColors.accentInk}
				iconColor={{
					default: tabColors.textMuted,
					selected: tabColors.accentInk,
				}}
				labelStyle={{
					default: { color: tabColors.textMuted },
					selected: { color: tabColors.accentInk },
				}}
			>
				{hasAccessory && showSession ? (
					<NativeTabs.BottomAccessory>
						<ActiveSessionBar />
					</NativeTabs.BottomAccessory>
				) : null}
				<NativeTabs.Trigger name="(home)">
					<NativeTabs.Trigger.Label>{t.tabs.home}</NativeTabs.Trigger.Label>
					<NativeTabs.Trigger.Icon sf="house.fill" md="home" />
				</NativeTabs.Trigger>

				<NativeTabs.Trigger name="train">
					<NativeTabs.Trigger.Label>{t.tabs.train}</NativeTabs.Trigger.Label>
					<NativeTabs.Trigger.Icon sf="play.fill" md="play_arrow" />
				</NativeTabs.Trigger>

				<NativeTabs.Trigger name="nutrition">
					<NativeTabs.Trigger.Label>
						{t.tabs.nutrition}
					</NativeTabs.Trigger.Label>
					<NativeTabs.Trigger.Icon sf="fork.knife" md="restaurant" />
				</NativeTabs.Trigger>

				<NativeTabs.Trigger name="progress">
					<NativeTabs.Trigger.Label>{t.tabs.progress}</NativeTabs.Trigger.Label>
					<NativeTabs.Trigger.Icon sf="chart.bar.fill" md="bar_chart" />
				</NativeTabs.Trigger>

				<NativeTabs.Trigger name="profile">
					<NativeTabs.Trigger.Label>{t.tabs.profile}</NativeTabs.Trigger.Label>
					<NativeTabs.Trigger.Icon sf="person.fill" md="person" />
				</NativeTabs.Trigger>
			</NativeTabs>
		</View>
	);
}
