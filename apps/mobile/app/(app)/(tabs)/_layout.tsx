/**
 * PROTOTYPE — #46, variant B's shell.
 *
 * ADR-0018's shape: `b-home` and `b-exercises` are destinations, `b-start` is
 * a verb — a `disabled` trigger, which still draws in the bar and still emits
 * `tabPress`, but never navigates. The listener turns that press into a push,
 * so the bar reads as three tabs and behaves as two tabs and a button.
 *
 * The bet this variant makes about decision 2: ship **two** real destinations
 * and no stubs. Dashboard, progress and routines stay off the bar entirely
 * rather than appearing as empty rooms — a tab bar with a stub in it is a
 * promise the app can't keep.
 *
 * Icons are SF Symbols / Material Symbols, not lucide: the native tab bar
 * renders a real `UITabBarItem`/`BottomNavigationView` item, which wants a
 * platform symbol name and cannot take a React component.
 */
import { useRouter } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { colors } from "../../../src/theme";

export default function TabsLayout() {
	const router = useRouter();

	return (
		<NativeTabs
			backgroundColor={colors.surface}
			tintColor={colors.accent}
			iconColor={{ default: colors.textMuted, selected: colors.accent }}
		>
			<NativeTabs.Trigger name="b-home">
				<NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
				<NativeTabs.Trigger.Icon sf="house.fill" md="home" />
			</NativeTabs.Trigger>

			<NativeTabs.Trigger
				name="b-start"
				disabled
				listeners={{
					// Verified on an Android emulator, not assumed: a `disabled`
					// trigger really does still emit `tabPress`, and the push lands
					// on the parent stack so the session covers the tab bar.
					tabPress: () => {
						router.push("/session");
					},
				}}
			>
				<NativeTabs.Trigger.Label>Start</NativeTabs.Trigger.Label>
				<NativeTabs.Trigger.Icon sf="plus.circle.fill" md="add_circle" />
			</NativeTabs.Trigger>

			<NativeTabs.Trigger name="b-exercises">
				<NativeTabs.Trigger.Label>Exercises</NativeTabs.Trigger.Label>
				<NativeTabs.Trigger.Icon sf="list.bullet" md="format_list_bulleted" />
			</NativeTabs.Trigger>
		</NativeTabs>
	);
}
