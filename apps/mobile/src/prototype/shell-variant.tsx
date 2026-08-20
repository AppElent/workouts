/**
 * PROTOTYPE — #46. Delete this file when the shell decision lands.
 *
 * Three shells of the same app, switchable in the hand.
 *
 * The first version of this swapped the navigator itself — `(app)/_layout`
 * returned a `Stack` for A and C and `NativeTabs` for B. That crashes:
 * expo-router keeps navigation state per route, so the tab router is handed
 * the stack's state and dies on `state.preloadedRouteKeys.filter`. Found on
 * the emulator, not by reading.
 *
 * So each variant owns its own **route** instead, and the switcher navigates
 * rather than re-renders. `(app)` is a plain Stack forever; variant B's tab
 * bar lives one level down in `(tabs)`. Route names are variant-prefixed
 * because two files cannot both claim `/`.
 *
 * Consequence worth knowing while judging: switching variants is a `replace`
 * to that variant's front door, which is also what a cold launch does — so
 * every switch is a fair look at the variant's first screen.
 */
import { useRouter } from "expo-router";
import { createContext, type ReactNode, useContext, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { colors, radius, spacing } from "../theme";
import { AppText } from "../ui/text";

export const VARIANTS = [
	{ key: "A", name: "Home base — stack, no tab bar", home: "/a-home" },
	{
		key: "B",
		name: "Tabs with a verb — Home | Start | Exercises",
		home: "/b-home",
	},
	{
		key: "C",
		name: "Session first — one target, chrome hidden",
		home: "/c-start",
	},
] as const;

export type VariantKey = (typeof VARIANTS)[number]["key"];

const VariantContext = createContext<VariantKey>("A");

export const useVariant = () => useContext(VariantContext);

export function ShellVariantProvider({ children }: { children: ReactNode }) {
	const router = useRouter();
	const [variant, setVariant] = useState<VariantKey>("A");
	const index = VARIANTS.findIndex((v) => v.key === variant);

	const step = (delta: number) => {
		const next = VARIANTS[(index + delta + VARIANTS.length) % VARIANTS.length];
		setVariant(next.key);
		router.replace(next.home);
	};

	return (
		<VariantContext.Provider value={variant}>
			{/* One flex parent around both children, not a bare fragment. The bar
			    is `position: absolute`, and on Android a touch that lands outside
			    the *parent's* bounds is dropped even though the child draws fine —
			    with a fragment the pill was visible and completely untappable. */}
			<View style={styles.fill}>
				<View style={styles.fill}>{children}</View>
				{__DEV__ ? (
					<View style={styles.bar} pointerEvents="box-none">
						<View style={styles.pill}>
							<Pressable
								onPress={() => step(-1)}
								hitSlop={16}
								style={styles.arrow}
							>
								<AppText style={styles.arrowText}>‹</AppText>
							</Pressable>
							<AppText style={styles.label} numberOfLines={1}>
								{VARIANTS[index].key} — {VARIANTS[index].name}
							</AppText>
							<Pressable
								onPress={() => step(1)}
								hitSlop={16}
								style={styles.arrow}
							>
								<AppText style={styles.arrowText}>›</AppText>
							</Pressable>
						</View>
					</View>
				) : null}
			</View>
		</VariantContext.Provider>
	);
}

const styles = StyleSheet.create({
	fill: { flex: 1 },
	bar: {
		position: "absolute",
		left: 0,
		right: 0,
		// Clear of Android's gesture strip *and* of variant B's tab bar. Sitting
		// on the strip meant a tap on the arrows registered as a swipe-home and
		// backgrounded the app instead of switching variant.
		bottom: 108,
		alignItems: "center",
	},
	pill: {
		flexDirection: "row",
		alignItems: "center",
		gap: spacing.sm,
		maxWidth: "94%",
		// Deliberately off-palette: this bar is not part of the design under test.
		backgroundColor: "#ff3b30",
		borderRadius: radius.pill,
		paddingVertical: 6,
		paddingHorizontal: spacing.sm,
	},
	arrow: { paddingHorizontal: spacing.xs },
	arrowText: {
		color: colors.text,
		fontSize: 20,
		fontWeight: "800",
		lineHeight: 22,
	},
	label: { color: colors.text, fontSize: 11, fontWeight: "700", flexShrink: 1 },
});
