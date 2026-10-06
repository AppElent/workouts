import { SymbolView } from "expo-symbols";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
	modalAnimation,
	useReduceMotion,
} from "../../../../feedback/reduce-motion";
import {
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../../theme";
import { AppText } from "../../../../ui/text";
import type { LogFoodCopy } from "../log-food-copy";

const ACTIONS = [
	{
		key: "create",
		ios: "square.and.pencil",
		android: "edit",
	},
	{ key: "search", ios: "magnifyingglass", android: "search" },
	{ key: "rescan", ios: "barcode.viewfinder", android: "barcode_scanner" },
] as const;

/**
 * An unknown barcode is a fork in the road, not an error toast: create the
 * food with the barcode already filled in, link the barcode to a food found
 * by name, or scan again.
 */
export function LogFoodBarcodeSheet({
	barcode,
	copy,
	closeLabel,
	onCreate,
	onSearchByName,
	onRescan,
	onClose,
}: {
	barcode: string | undefined;
	copy: LogFoodCopy;
	closeLabel: string;
	onCreate: () => void;
	onSearchByName: () => void;
	onRescan: () => void;
	onClose: () => void;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const reduceMotion = useReduceMotion();
	const labels = {
		create: [copy.newPersonalFood, copy.barcodeNewFoodHint],
		search: [copy.barcodeSearchByName, copy.barcodeSearchByNameHint],
		rescan: [copy.barcodeRescan, undefined],
	} as const;
	const handlers = {
		create: onCreate,
		search: onSearchByName,
		rescan: onRescan,
	};
	return (
		<Modal
			visible={barcode !== undefined}
			presentationStyle="formSheet"
			animationType={modalAnimation(reduceMotion, "slide")}
			onRequestClose={onClose}
		>
			<SafeAreaView edges={["bottom"]} style={styles.sheet}>
				<View style={styles.header}>
					<Pressable
						accessibilityRole="button"
						accessibilityLabel={closeLabel}
						onPress={onClose}
						hitSlop={8}
						style={styles.close}
					>
						<SymbolView
							name={{ ios: "xmark", android: "close", web: "close" }}
							size={17}
							tintColor={colors.text}
						/>
					</Pressable>
					<View style={styles.title}>
						<AppText variant="navTitle" accessibilityRole="header">
							{copy.barcodeNotFound}
						</AppText>
						<AppText variant="caption" style={styles.tabular}>
							{barcode}
						</AppText>
					</View>
					<View style={styles.close} />
				</View>
				<AppText variant="secondary" style={styles.body}>
					{copy.barcodeNotFoundBody}
				</AppText>
				<View style={styles.card}>
					{ACTIONS.map((action, index) => {
						const [label, hint] = labels[action.key];
						return (
							<Pressable
								key={action.key}
								accessibilityRole="button"
								accessibilityHint={hint}
								onPress={handlers[action.key]}
								style={[styles.action, index > 0 && styles.divided]}
							>
								<SymbolView
									name={{
										ios: action.ios,
										android: action.android,
										web: action.android,
									}}
									size={20}
									tintColor={colors.accentInk}
								/>
								<View style={styles.flex}>
									<AppText style={styles.label}>{label}</AppText>
									{hint ? <AppText variant="caption">{hint}</AppText> : null}
								</View>
							</Pressable>
						);
					})}
				</View>
			</SafeAreaView>
		</Modal>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		sheet: {
			flex: 1,
			gap: spacing.md,
			padding: spacing.md,
			backgroundColor: colors.bg,
		},
		header: { flexDirection: "row", alignItems: "center" },
		close: {
			width: 44,
			height: 44,
			alignItems: "center",
			justifyContent: "center",
		},
		title: { flex: 1, alignItems: "center" },
		tabular: { fontVariant: ["tabular-nums"] },
		body: { textAlign: "center", paddingHorizontal: spacing.lg },
		card: {
			borderRadius: radius.contentCard,
			backgroundColor: colors.surface,
			overflow: "hidden",
		},
		action: {
			minHeight: 56,
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.md,
			paddingHorizontal: spacing.md,
			paddingVertical: spacing.sm,
		},
		divided: {
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: colors.separator,
		},
		flex: { flex: 1 },
		label: { color: colors.accentInk, fontWeight: "600" },
	});
