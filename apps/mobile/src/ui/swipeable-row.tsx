/**
 * A row whose actions can be reached three ways, none of which is the only way.
 *
 * Spec #68 is unusually specific here, so this component is built around the
 * constraint rather than decorated with it:
 *
 * - **Swipe reveals; it never commits.** The row's travel is clamped to the
 *   width of the actions it is uncovering, so a "full swipe" is not a gesture
 *   this row has. That is deliberate and stronger than choosing not to handle
 *   one: deletion here requires a confirmation, and a gesture that could fling
 *   past the confirmation would be a gesture that could delete by accident.
 *   Releasing a swipe leaves the buttons showing and waits for a tap.
 * - **Long press opens the same actions as a menu.** An accelerator for people
 *   who know it is there, never the only route to anything.
 * - **Screen readers get the actions as named custom actions**, which is the
 *   conventionally discoverable route on both platforms — a swipe is invisible
 *   to VoiceOver and TalkBack, and a row whose delete existed only in a gesture
 *   would be a row those users cannot delete.
 *
 * And above all three: the caller must still offer a visible route elsewhere.
 * On the Nutrition day that is the entry editor, which every row opens on a
 * plain tap and which carries its own visible Delete.
 *
 * Motion is `Animated` from React Native core, and the gesture is declared
 * `.runOnJS(true)`. That pairing is deliberate. By default gesture-handler
 * runs its callbacks as worklets on the UI thread, and a worklet cannot
 * capture a legacy `Animated.Value` — it throws "Cannot copy value of type
 * `AnimatedValue`" the moment a row is drawn, which is invisible to the test
 * renderer and fatal on a device. The alternative is Reanimated shared values,
 * as `ui/set-edit-sheet.tsx` uses; that costs a library whose Jest mock does
 * not load standalone here, and buys UI-thread smoothness this row does not
 * need. The travel is at most two button widths and ends in a spring.
 *
 * The drag itself follows the finger — direct manipulation, not decoration —
 * but the snap at the end of it is animation, so Reduce Motion cuts it to an
 * instant move.
 */
import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import {
	type AccessibilityActionEvent,
	Animated,
	Modal,
	Pressable,
	StyleSheet,
	View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { haptics } from "../feedback/haptics";
import { modalAnimation, useReduceMotion } from "../feedback/reduce-motion";
import { colors, radius, spacing } from "../theme";
import { AppText } from "./text";

export interface RowAction {
	/** Stable across renders; also the accessibility action name. */
	key: string;
	/** Shown on the revealed button and spoken as the custom action. */
	label: string;
	onPress: () => void;
	/** Draws in the danger colour and reads as destructive. Never skips confirmation. */
	destructive?: boolean;
}

/** Spread onto the row's own focusable element so the actions reach a screen reader. */
export interface RowAccessibilityProps {
	accessibilityActions: readonly { name: string; label: string }[];
	onAccessibilityAction: (event: AccessibilityActionEvent) => void;
	onLongPress: () => void;
}

/** One action button's width, and therefore how far the row can travel. */
const ACTION_WIDTH = 88;

/** Past this fraction of the travel the row stays open on release. */
const OPEN_THRESHOLD = 0.4;

export function SwipeableRow({
	actions,
	menuTitle,
	closeMenuLabel,
	children,
}: {
	actions: readonly RowAction[];
	/** Names the thing being acted on, so the menu is not four verbs with no subject. */
	menuTitle: string;
	closeMenuLabel: string;
	children: (accessibility: RowAccessibilityProps) => ReactNode;
}) {
	const reduceMotion = useReduceMotion();
	const [menuOpen, setMenuOpen] = useState(false);
	const openWidth = ACTION_WIDTH * actions.length;
	const translateX = useRef(new Animated.Value(0)).current;
	// Plain refs: the gesture callbacks run on the JS thread, so these are
	// ordinary reads and writes rather than anything shared across threads.
	const offset = useRef(0);
	const passedThreshold = useRef(false);

	const settle = useCallback(
		(to: number) => {
			offset.current = to;
			if (reduceMotion) {
				translateX.setValue(to);
				return;
			}
			Animated.spring(translateX, {
				toValue: to,
				useNativeDriver: true,
				bounciness: 0,
				speed: 20,
			}).start();
		},
		[reduceMotion, translateX],
	);

	const close = useCallback(() => settle(0), [settle]);

	const runAction = useCallback(
		(action: RowAction) => {
			close();
			setMenuOpen(false);
			action.onPress();
		},
		[close],
	);

	const openMenu = useCallback(() => {
		haptics.menuOpened();
		setMenuOpen(true);
	}, []);

	const pan = useMemo(
		() =>
			Gesture.Pan()
				// JS thread, so the callbacks below may touch `Animated.Value` and
				// the refs around it. See the note at the top of this file.
				.runOnJS(true)
				// Only claim a drag that is clearly horizontal, so the diary keeps
				// scrolling normally under a vertical finger.
				.activeOffsetX([-12, 12])
				.failOffsetY([-12, 12])
				.onBegin(() => {
					passedThreshold.current = false;
				})
				.onUpdate((event) => {
					const next = offset.current + event.translationX;
					// Clamped both ways: closed at 0, open at exactly the buttons'
					// width. There is no distance past "open" for a full swipe to use.
					const clamped = Math.min(0, Math.max(-openWidth, next));
					translateX.setValue(clamped);
					const past = clamped <= -openWidth * OPEN_THRESHOLD;
					if (past !== passedThreshold.current) {
						passedThreshold.current = past;
						if (past) haptics.swipeThresholdPassed();
					}
				})
				.onEnd(() => {
					settle(passedThreshold.current ? -openWidth : 0);
				}),
		[openWidth, settle, translateX],
	);

	const accessibility = useMemo<RowAccessibilityProps>(
		() => ({
			accessibilityActions: actions.map((action) => ({
				name: action.key,
				label: action.label,
			})),
			onAccessibilityAction: (event: AccessibilityActionEvent) => {
				const action = actions.find(
					(candidate) => candidate.key === event.nativeEvent.actionName,
				);
				if (action) runAction(action);
			},
			onLongPress: openMenu,
		}),
		[actions, openMenu, runAction],
	);

	return (
		<View style={styles.clip}>
			{/* Drawn behind the row and uncovered by it, so it is out of reach
			    until the swipe has actually revealed it. */}
			<View style={[styles.actionsLayer, { width: openWidth }]}>
				{actions.map((action) => (
					<Pressable
						key={action.key}
						onPress={() => runAction(action)}
						accessibilityRole="button"
						accessibilityLabel={action.label}
						style={({ pressed }) => [
							styles.action,
							{
								backgroundColor: action.destructive
									? colors.dangerSoft
									: colors.surface2,
							},
							pressed && styles.actionPressed,
						]}
					>
						<AppText
							variant="caption"
							style={{
								color: action.destructive ? colors.danger : colors.text,
								fontWeight: "700",
							}}
						>
							{action.label}
						</AppText>
					</Pressable>
				))}
			</View>

			<GestureDetector gesture={pan}>
				{/* The row's own opaque background is what hides the actions. */}
				<Animated.View style={[styles.row, { transform: [{ translateX }] }]}>
					{children(accessibility)}
				</Animated.View>
			</GestureDetector>

			<ActionMenu
				visible={menuOpen}
				title={menuTitle}
				actions={actions}
				closeLabel={closeMenuLabel}
				reduceMotion={reduceMotion}
				onSelect={runAction}
				onClose={() => setMenuOpen(false)}
			/>
		</View>
	);
}

/**
 * The long-press menu.
 *
 * A themed `Modal` for the same reason `confirm-dialog.tsx` is one rather than
 * `Alert.alert`: this app has a single dark palette and a platform sheet
 * cannot take it. The actions are the row's actions verbatim — a menu that
 * offered a different set from the swipe would be a second list to keep in
 * step, and a place for a route to go quietly missing.
 */
function ActionMenu({
	visible,
	title,
	actions,
	closeLabel,
	reduceMotion,
	onSelect,
	onClose,
}: {
	visible: boolean;
	title: string;
	actions: readonly RowAction[];
	closeLabel: string;
	reduceMotion: boolean;
	onSelect: (action: RowAction) => void;
	onClose: () => void;
}) {
	return (
		<Modal
			visible={visible}
			transparent
			animationType={modalAnimation(reduceMotion, "fade")}
			// Android's back button closes the menu rather than leaving the screen.
			onRequestClose={onClose}
		>
			<Pressable style={styles.backdrop} onPress={onClose}>
				{/* Swallows taps so pressing the card itself does not dismiss it. */}
				<Pressable style={styles.menu} onPress={() => {}}>
					<AppText variant="heading">{title}</AppText>
					{actions.map((action) => (
						<Pressable
							key={action.key}
							onPress={() => onSelect(action)}
							accessibilityRole="button"
							accessibilityLabel={action.label}
							style={({ pressed }) => [
								styles.menuItem,
								pressed && styles.actionPressed,
							]}
						>
							<AppText
								style={{
									fontWeight: "700",
									color: action.destructive ? colors.danger : colors.text,
								}}
							>
								{action.label}
							</AppText>
						</Pressable>
					))}
					<Pressable
						onPress={onClose}
						accessibilityRole="button"
						accessibilityLabel={closeLabel}
						style={({ pressed }) => [
							styles.menuItem,
							pressed && styles.actionPressed,
						]}
					>
						<AppText style={{ color: colors.textMuted }}>{closeLabel}</AppText>
					</Pressable>
				</Pressable>
			</Pressable>
		</Modal>
	);
}

const styles = StyleSheet.create({
	clip: { overflow: "hidden" },
	actionsLayer: {
		position: "absolute",
		right: 0,
		top: 0,
		bottom: 0,
		flexDirection: "row",
	},
	action: {
		width: ACTION_WIDTH,
		// 44pt is the platform minimum; these rows are taller, but the button
		// must not fall under it when a row is short.
		minHeight: 44,
		alignItems: "center",
		justifyContent: "center",
		paddingHorizontal: spacing.xs,
	},
	actionPressed: { opacity: 0.7 },
	row: { backgroundColor: colors.surface },

	backdrop: {
		flex: 1,
		backgroundColor: "rgba(0,0,0,0.6)",
		justifyContent: "flex-end",
		padding: spacing.md,
	},
	menu: {
		backgroundColor: colors.surface,
		borderRadius: radius.sheet,
		borderWidth: 1,
		borderColor: colors.border,
		padding: spacing.md,
		gap: spacing.xs,
	},
	menuItem: {
		minHeight: 48,
		justifyContent: "center",
		paddingHorizontal: spacing.sm,
	},
});
