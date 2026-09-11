/**
 * The tab bar (`designs/shell/index.html`). It gets its own route group
 * because expo-router keeps navigation state per route: a `NativeTabs`
 * navigator cannot share a route with the `Stack` that pushes the session and
 * summary screens over it. See `docs/prototypes/46-shell/README.md`.
 *
 * Native tabs mean real `UITabBarItem`/`BottomNavigationView` chrome. That used
 * to imply a custom dev client; as of SDK 57 it does not — #69 drove this tab
 * bar on an Android emulator through plain Expo Go, which is also what makes
 * `expo-sqlite` and `expo-localization` usable without a native rebuild.
 *
 * **Five is the ceiling.** UIKit collapses a sixth tab into a system "More"
 * tab, which would change this app's navigation semantics without anybody
 * deciding to. Nutrition (#69) takes the fifth slot; a sixth area has to
 * displace something rather than be appended.
 *
 * Every label comes from the message tree. Converting the four existing ones
 * alongside the new one was deliberate (#69): a tab bar with four English
 * labels and one Dutch is worse than either extreme.
 */
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { Platform, View } from "react-native";
import { useActiveSession } from "../../../src/data/session-data";
import { useI18n } from "../../../src/i18n";
import { colors } from "../../../src/theme";
import { ActiveSessionBar } from "../../../src/ui/active-session-bar";

export default function CoachTabsLayout() {
	const { t } = useI18n();
	const active = useActiveSession();
	const hasAccessory =
		Platform.OS === "ios" &&
		Number.parseInt(String(Platform.Version), 10) >= 26;

	return (
		<View style={{ flex: 1 }}>
			{!hasAccessory && active ? <ActiveSessionBar /> : null}
			<NativeTabs
				backgroundColor={colors.surface}
				tintColor={colors.accent}
				iconColor={{
					default: colors.textMuted,
					selected: colors.accent,
				}}
			>
				{hasAccessory && active ? (
					<NativeTabs.BottomAccessory>
						<ActiveSessionBar />
					</NativeTabs.BottomAccessory>
				) : null}
				<NativeTabs.Trigger name="index">
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
