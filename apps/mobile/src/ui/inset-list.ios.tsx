/**
 * The inset grouped list as a real SwiftUI `List` — system corners, system
 * separators, system swipe actions and context menu, Dynamic Type. This is
 * the single change that most separates a native screen from a web page
 * (Foundry readme, "Lists over cards"), so the whole group is SwiftUI and
 * nothing in it is drawn by React Native unless a caller passes a React
 * element as `leading`.
 *
 * Where SwiftUI draws it, the system's look wins: no `radius.card`, no
 * hairline colour, no row height — those are the RN fallback's business.
 * Only the accent, the sport hues and the copy come from us.
 *
 * Sizing. A `List` has no intrinsic height, and this list sits inside an RN
 * `ScrollView` among RN content, so it is `scrollDisabled` and its height is
 * driven from the list's own scroll geometry (`contentHeight`, iOS 18+) with a
 * row-count estimate until the first measurement arrives. `.swipeActions`
 * only exists inside a `List`, which is why the group is one, and why the
 * earlier per-row `Host` + `SwipeActions` canary could never have swiped.
 *
 * The screen gutter is undone with a negative margin so the List's own
 * inset-grouped margins meet the screen edge at the system distance.
 */
import {
	Button,
	ContextMenu,
	Host,
	HStack,
	Image,
	List,
	RNHostView,
	RoundedRectangle,
	Section,
	Spacer,
	SwipeActions,
	Text,
	VStack,
	ZStack,
} from "@expo/ui/swift-ui";
import {
	accessibilityAddTraits,
	accessibilityLabel,
	contentShape,
	font,
	foregroundStyle,
	frame,
	lineLimit,
	listStyle,
	monospacedDigit,
	onTapGesture,
	scrollContentBackground,
	scrollDisabled,
	shapes,
	tint,
	useScrollGeometryChange,
} from "@expo/ui/swift-ui/modifiers";
import { version as expoVersion } from "expo/package.json";
import { Children, isValidElement, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
	metrics,
	sportMeta,
	useHostScheme,
	useSportColors,
	useTokens,
} from "../theme";
import type {
	InsetListProps,
	InsetRowProps,
	RowLeading,
} from "./inset-list.types";

export type { InsetListProps, InsetRowProps, RowLeading };

/** Until the list reports its geometry: rows at the native default, plus chrome. */
function estimateHeight(rows: number, header?: string, footer?: string) {
	return rows * 52 + (header ? 44 : 20) + (footer ? 36 : 20);
}

/**
 * `@expo/ui` 57.0.18 was built against expo 57.0.22, and its
 * `useScrollGeometryChange` reaches for `useReleasingSharedObjectWithLifecycle`,
 * which the `expo-modules-core` that ships with expo < 57.0.22 does not export
 * — the call throws "undefined is not a function" from inside the hook.
 * `expo-modules-core` is not resolvable from here under pnpm, so the check is
 * on expo's own version. Until `expo` is aligned (plan doc, open questions)
 * the list falls back to the estimate. Decided once at module load, so the
 * hook order is constant.
 */
const [major, , patch] = expoVersion.split(".").map(Number);
const canMeasure = major > 57 || (major === 57 && patch >= 22);
const useContentHeight: typeof useScrollGeometryChange = canMeasure
	? useScrollGeometryChange
	: () => null;

export function InsetList({ header, footer, children }: InsetListProps) {
	const tokens = useTokens();
	const rows = Children.count(children);
	const [measured, setMeasured] = useState<number | null>(null);
	const geometry = useContentHeight((g) => {
		if (g.contentHeight > 0) setMeasured(Math.ceil(g.contentHeight));
	});
	const height = measured ?? estimateHeight(rows, header, footer);

	return (
		<View style={styles.bleed}>
			<Host
				colorScheme={useHostScheme()}
				seedColor={tokens.accent}
				style={{ width: "100%", height }}
			>
				<List
					modifiers={[
						listStyle("insetGrouped"),
						scrollDisabled(true),
						scrollContentBackground("hidden"),
						...(geometry ? [geometry] : []),
					]}
				>
					<Section
						title={header}
						footer={footer ? <Text>{footer}</Text> : undefined}
					>
						{children}
					</Section>
				</List>
			</Host>
		</View>
	);
}

function Leading({ leading }: { leading: RowLeading }) {
	const tokens = useTokens();
	if (isValidElement(leading)) {
		return <RNHostView matchContents>{leading}</RNHostView>;
	}
	if ("sport" in leading) {
		return <SportTile sport={leading.sport} size={leading.size ?? 30} />;
	}
	return (
		<Image
			systemName={leading.symbol}
			size={20}
			color={tokens.accentInk}
			modifiers={[frame({ width: 28 })]}
		/>
	);
}

/** `SportIcon` in SwiftUI: a tinted continuous-corner tile with the letter glyph. */
function SportTile({
	sport,
	size,
}: {
	sport: keyof typeof sportMeta;
	size: number;
}) {
	const { color, dim } = useSportColors(sport);
	return (
		<ZStack modifiers={[frame({ width: size, height: size })]}>
			<RoundedRectangle
				cornerRadius={size * 0.32}
				modifiers={[foregroundStyle(dim)]}
			/>
			<Text
				modifiers={[
					font({ size: size * 0.4, weight: "heavy" }),
					foregroundStyle(color),
				]}
			>
				{sportMeta[sport].glyph}
			</Text>
		</ZStack>
	);
}

export function InsetRow({
	leading,
	title,
	secondary,
	value,
	chevron = false,
	destructive = false,
	onPress,
	actions,
	// `menuTitle` is unused here: a SwiftUI context menu has no title row.
	accessibilityLabel: label,
}: InsetRowProps) {
	const tokens = useTokens();
	const spoken = label ?? (secondary ? `${title}, ${secondary}` : title);
	const swipe = (actions ?? []).filter((a) => a.swipe !== false);

	const row = (
		<HStack
			spacing={12}
			modifiers={[
				contentShape(shapes.rectangle()),
				accessibilityLabel(spoken),
				...(onPress
					? [onTapGesture(onPress), accessibilityAddTraits(["isButton"])]
					: []),
			]}
		>
			{leading ? <Leading leading={leading} /> : null}
			<VStack alignment="leading" spacing={1}>
				<Text
					modifiers={[
						font({ textStyle: "body", weight: "semibold" }),
						foregroundStyle(destructive ? tokens.danger : tokens.text),
						lineLimit(2),
					]}
				>
					{title}
				</Text>
				{secondary ? (
					<Text
						modifiers={[
							font({ textStyle: "footnote" }),
							foregroundStyle(tokens.textMuted),
							lineLimit(2),
						]}
					>
						{secondary}
					</Text>
				) : null}
			</VStack>
			<Spacer />
			{value ? (
				<Text
					modifiers={[
						font({ textStyle: "subheadline" }),
						foregroundStyle(tokens.textMuted),
						monospacedDigit(),
					]}
				>
					{value}
				</Text>
			) : null}
			{chevron ? (
				<Image
					systemName="chevron.right"
					size={13}
					color={tokens.textFaint}
					modifiers={[font({ weight: "semibold" })]}
				/>
			) : null}
		</HStack>
	);

	if (!actions || actions.length === 0) return row;

	// Long press: the same actions as a system menu. Swipe: the ones that fit.
	// Full swipe never commits — every destructive action still confirms.
	const withMenu = (
		<ContextMenu>
			<ContextMenu.Items>
				{actions.map((action) => (
					<Button
						key={action.key}
						label={action.label}
						role={action.destructive ? "destructive" : "default"}
						onPress={action.onPress}
					/>
				))}
			</ContextMenu.Items>
			<ContextMenu.Trigger>{row}</ContextMenu.Trigger>
		</ContextMenu>
	);

	if (swipe.length === 0) return withMenu;

	return (
		<SwipeActions>
			{withMenu}
			<SwipeActions.Actions edge="trailing" allowsFullSwipe={false}>
				{swipe.map((action) => (
					<Button
						key={action.key}
						label={action.label}
						role={action.destructive ? "destructive" : "default"}
						systemImage={action.destructive ? "trash" : undefined}
						onPress={action.onPress}
						modifiers={action.destructive ? [] : [tint(tokens.accent)]}
					/>
				))}
			</SwipeActions.Actions>
		</SwipeActions>
	);
}

const styles = StyleSheet.create({
	bleed: { marginHorizontal: -metrics.screenGutter },
});
