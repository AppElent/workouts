/**
 * The four-tab bar (`designs/shell/index.html`). It gets its own route group
 * because expo-router keeps navigation state per route: a `NativeTabs`
 * navigator cannot share a route with the `Stack` that pushes the session and
 * summary screens over it. See `docs/prototypes/46-shell/README.md`.
 *
 * Native tabs mean real `UITabBarItem`/`BottomNavigationView` chrome, which is
 * also why this app cannot run in Expo Go — it needs a dev client.
 */
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { colors } from "../../../src/theme";

export default function CoachTabsLayout() {
	return (
		<NativeTabs
			backgroundColor={colors.surface}
			tintColor={colors.accent}
			iconColor={{
				default: colors.textMuted,
				selected: colors.accent,
			}}
		>
			<NativeTabs.Trigger name="index">
				<NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
				<NativeTabs.Trigger.Icon sf="house.fill" md="home" />
			</NativeTabs.Trigger>

			<NativeTabs.Trigger name="train">
				<NativeTabs.Trigger.Label>Train</NativeTabs.Trigger.Label>
				<NativeTabs.Trigger.Icon sf="play.fill" md="play_arrow" />
			</NativeTabs.Trigger>

			<NativeTabs.Trigger name="progress">
				<NativeTabs.Trigger.Label>Progress</NativeTabs.Trigger.Label>
				<NativeTabs.Trigger.Icon sf="chart.bar.fill" md="bar_chart" />
			</NativeTabs.Trigger>

			<NativeTabs.Trigger name="profile">
				<NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
				<NativeTabs.Trigger.Icon sf="person.fill" md="person" />
			</NativeTabs.Trigger>
		</NativeTabs>
	);
}
