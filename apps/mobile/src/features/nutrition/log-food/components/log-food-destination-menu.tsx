import { SymbolView } from "expo-symbols";
import { useRef, useState } from "react";
import {
	Animated,
	Modal,
	Pressable,
	StyleSheet,
	useWindowDimensions,
	View,
} from "react-native";
import { haptics } from "../../../../feedback/haptics";
import { useReduceMotion } from "../../../../feedback/reduce-motion";
import {
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../../theme";
import { GlassSurface } from "../../../../ui/glass-surface";
import { AppText } from "../../../../ui/text";
import type { LogFoodDestinationMenuProps } from "./log-food-destination-menu-props";

/** Design `.menu`: 282pt wide, 26pt corners, popping in under the title. */
const MENU_WIDTH = 282;
const MENU_RADIUS = 26;
/** Below a standard navigation bar, until the title has been measured. */
const FALLBACK_TOP = 104;

interface Anchor {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

/**
 * "Lunch ⌄" over the day as the navigation title, opening the destination
 * menu (design `log_final.html` §2): one line per meal with a fixed check
 * column and the meal's tally right-aligned, then "Another day…".
 *
 * Drawn by us rather than the system menu: a native menu puts the tally on a
 * second line and indents only the checked meal, which is the layout the
 * design rejects.
 */
export function LogFoodDestinationMenu(props: LogFoodDestinationMenuProps) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const reduceMotion = useReduceMotion();
	const window = useWindowDimensions();
	const trigger = useRef<View>(null);
	const pop = useRef(new Animated.Value(0)).current;
	const [open, setOpen] = useState(false);
	const [anchor, setAnchor] = useState<Anchor | null>(null);

	function show() {
		haptics.menuOpened();
		// Open at once; the measured title only places the menu under it.
		setOpen(true);
		trigger.current?.measureInWindow((x, y, width, height) =>
			setAnchor({ x, y, width, height }),
		);
		if (reduceMotion) {
			pop.setValue(1);
			return;
		}
		pop.setValue(0);
		Animated.spring(pop, {
			toValue: 1,
			useNativeDriver: true,
			speed: 28,
			bounciness: 6,
		}).start();
	}
	const close = () => setOpen(false);
	const choose = (action: () => void) => {
		close();
		action();
	};

	const width = Math.min(MENU_WIDTH, window.width - 2 * spacing.md);
	const left = anchor
		? Math.min(
				Math.max(spacing.md, anchor.x + anchor.width / 2 - width / 2),
				window.width - spacing.md - width,
			)
		: (window.width - width) / 2;
	const top = anchor ? anchor.y + anchor.height + spacing.xs : FALLBACK_TOP;

	return (
		<>
			<Pressable
				ref={trigger}
				accessibilityRole="button"
				accessibilityLabel={props.label}
				accessibilityState={{ expanded: open }}
				onPress={show}
				style={styles.trigger}
			>
				<View style={styles.titleRow}>
					<AppText variant="navTitle">{props.mealName}</AppText>
					<SymbolView
						name={{
							ios: "chevron.down",
							android: "expand_more",
							web: "expand_more",
						}}
						size={11}
						weight="semibold"
						tintColor={colors.textMuted}
					/>
				</View>
				<AppText variant="caption">{props.dayLabel}</AppText>
			</Pressable>
			<Modal
				visible={open}
				transparent
				animationType="none"
				statusBarTranslucent
				onRequestClose={close}
			>
				<Pressable
					style={StyleSheet.absoluteFill}
					onPress={close}
					accessibilityRole="button"
					accessibilityLabel={props.closeLabel}
				/>
				{open ? (
					<Animated.View
						accessibilityViewIsModal
						style={[
							styles.menu,
							{
								top,
								left,
								width,
								opacity: pop,
								transform: [
									{
										scale: pop.interpolate({
											inputRange: [0, 1],
											outputRange: [0.92, 1],
										}),
									},
								],
							},
						]}
					>
						<GlassSurface cornerRadius={MENU_RADIUS} style={styles.glass}>
							<AppText
								variant="caption"
								accessibilityRole="header"
								style={styles.heading}
							>
								{props.sectionTitle}
							</AppText>
							{props.options.map((option) => (
								<Pressable
									key={option.slot}
									accessibilityRole="button"
									accessibilityLabel={`${option.label}, ${option.detail}`}
									accessibilityState={{ selected: option.selected }}
									onPress={() => choose(() => props.onSelectMeal(option.slot))}
									style={({ pressed }) => [
										styles.item,
										pressed && styles.pressed,
									]}
								>
									<View style={styles.check}>
										{option.selected ? (
											<SymbolView
												name={{
													ios: "checkmark",
													android: "check",
													web: "check",
												}}
												size={15}
												weight="semibold"
												tintColor={colors.accentInk}
											/>
										) : null}
									</View>
									<AppText variant="row" numberOfLines={1} style={styles.name}>
										{option.label}
									</AppText>
									<AppText
										variant="footnote"
										numberOfLines={1}
										style={styles.detail}
									>
										{option.detail}
									</AppText>
								</Pressable>
							))}
							<View style={styles.divider} />
							<Pressable
								accessibilityRole="button"
								onPress={() => choose(props.onOtherDay)}
								style={({ pressed }) => [
									styles.item,
									pressed && styles.pressed,
								]}
							>
								<SymbolView
									name={{
										ios: "calendar",
										android: "calendar_month",
										web: "calendar_month",
									}}
									size={19}
									tintColor={colors.text}
								/>
								<AppText variant="row" style={styles.name}>
									{props.otherDayLabel}
								</AppText>
							</Pressable>
						</GlassSurface>
					</Animated.View>
				) : null}
			</Modal>
		</>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		trigger: { alignItems: "center", justifyContent: "center", minHeight: 44 },
		titleRow: { flexDirection: "row", alignItems: "center", gap: 4 },
		menu: {
			position: "absolute",
			borderRadius: MENU_RADIUS,
			shadowColor: "#000",
			shadowOpacity: 0.18,
			shadowRadius: 24,
			shadowOffset: { width: 0, height: 10 },
			elevation: 12,
		},
		glass: { padding: 6, overflow: "hidden" },
		heading: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 4 },
		item: {
			minHeight: 44,
			flexDirection: "row",
			alignItems: "center",
			gap: 10,
			paddingHorizontal: 14,
			paddingVertical: 11,
			borderRadius: 18,
		},
		pressed: { backgroundColor: colors.separator },
		check: { width: 16, alignItems: "center" },
		name: { flexShrink: 1, fontWeight: "400" },
		detail: { marginLeft: "auto", flexShrink: 0 },
		divider: {
			height: StyleSheet.hairlineWidth,
			marginVertical: 4,
			marginHorizontal: 10,
			backgroundColor: colors.separator,
		},
	});
