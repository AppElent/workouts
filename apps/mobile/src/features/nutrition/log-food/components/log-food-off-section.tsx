import { SymbolView } from "expo-symbols";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { PersonalFoodDraft } from "../../../../data/personal-food-repository";
import type { Messages } from "../../../../i18n";
import {
	radius,
	spacing,
	type Tokens,
	useThemedStyles,
	useTokens,
} from "../../../../theme";
import { SkeletonBlock, SkeletonGroup } from "../../../../ui/skeleton";
import { AppText } from "../../../../ui/text";
import { FoodRowLayout } from "../../components/food-row-layout";
import { compactEnergyPer100, offFailureMessage } from "../log-food-captions";
import type { LogFoodCopy } from "../log-food-copy";
import type { OffSearchState } from "../use-off-search";
import { LogFoodMediaSlot } from "./log-food-media-slot";
import { LogFoodSectionHeader } from "./log-food-section-header";

/** How many products the section shows before "Show all". */
const OFF_PREVIEW = 3;

/**
 * Open Food Facts as its own section under the local results.
 *
 * It is present whenever there is a query, whatever the local results are,
 * and only ever reflects `useOffSearch`: a rate limit counts down here while
 * the rows above stay put. A product is a proposal, so tapping one opens the
 * import review rather than logging it.
 */
export function LogFoodOffSection({
	state,
	query,
	copy,
	messages,
	locale,
	offline,
	onCommit,
	onReview,
	onScan,
}: {
	state: OffSearchState;
	query: string;
	copy: LogFoodCopy;
	messages: Messages["nutrition"];
	locale: "en" | "nl";
	/** Nothing can be asked: the manual row gives way to the offline notice. */
	offline: boolean;
	onCommit: () => void;
	onReview: (draft: PersonalFoodDraft) => void;
	onScan: () => void;
}) {
	const styles = useThemedStyles(createStyles);
	const [showAll, setShowAll] = useState(false);
	const term = query.trim();
	// A new answer starts collapsed again.
	useEffect(() => {
		if (state.kind !== "found") setShowAll(false);
	}, [state.kind]);
	if (state.kind === "idle") return null;

	if (state.kind === "offline" || (offline && state.kind === "waiting"))
		return (
			<View testID="off-section" style={styles.section}>
				<Notice symbol="wifi.slash" text={copy.offline} />
			</View>
		);

	if (state.kind === "waiting")
		return (
			<View testID="off-section" style={styles.section}>
				<ManualSearch term={term} copy={copy} onCommit={onCommit} />
			</View>
		);

	const detail =
		state.kind === "loading"
			? copy.searchingOnline
			: state.kind === "found"
				? copy.offCount(state.drafts.length)
				: undefined;
	return (
		<View testID="off-section" style={styles.section}>
			<LogFoodSectionHeader title={copy.onlineResults} detail={detail} />
			{state.kind === "loading" ? (
				<SkeletonGroup label={copy.searchingOnline}>
					<View style={styles.skeleton}>
						{[0, 1, 2].map((key) => (
							<SkeletonBlock key={key} height={44} />
						))}
					</View>
				</SkeletonGroup>
			) : null}
			{state.kind === "found" ? (
				<>
					<View style={styles.card}>
						{(showAll ? state.drafts : state.drafts.slice(0, OFF_PREVIEW)).map(
							(draft, index) => (
								<FoodRowLayout
									// biome-ignore lint/suspicious/noArrayIndexKey: products without a barcode have no other identity
									key={`${draft.provenance.barcode ?? "off"}:${index}`}
									leading={
										<LogFoodMediaSlot
											imageUrl={draft.provenance.imageUrl}
											label={draft.name[locale]}
											symbol={{
												ios: "globe",
												android: "public",
												web: "public",
											}}
										/>
									}
									title={draft.name[locale]}
									// Design: "Campina · 1 L · 38 kcal/100 ml" — the brand
									// and pack, then the figure; the section names the source.
									caption={[
										draft.provenance.brand,
										draft.provenance.quantity,
										compactEnergyPer100(draft, copy.servingWord),
									]
										.filter(Boolean)
										.join(" · ")}
									position={index === 0 ? "first" : "middle"}
									inset={false}
									onPress={() => onReview(draft)}
									chevron
								/>
							),
						)}
						{!showAll && state.drafts.length > OFF_PREVIEW ? (
							<Pressable
								accessibilityRole="button"
								onPress={() => setShowAll(true)}
								style={[styles.showAll, styles.divided]}
							>
								<AppText style={styles.accent}>
									{copy.offShowAll(state.drafts.length)}
								</AppText>
							</Pressable>
						) : null}
					</View>
					<AppText variant="caption" style={styles.note}>
						{copy.offImportHint}
					</AppText>
				</>
			) : null}
			{state.kind === "none" ? (
				<AppText variant="caption" style={styles.note}>
					{copy.offNone(term)}
				</AppText>
			) : null}
			{state.kind === "failed" ? (
				<AppText
					testID="off-search-feedback"
					accessibilityRole="alert"
					variant="caption"
					style={styles.note}
				>
					{offFailureMessage(state.reason, messages.foodImport, true)}
				</AppText>
			) : null}
			{state.kind === "failed" ? (
				<ManualSearch term={term} copy={copy} onCommit={onCommit} />
			) : null}
			{state.kind === "cooling" ? (
				<View style={styles.card}>
					<Countdown until={state.until} copy={copy} />
					<Pressable
						accessibilityRole="button"
						onPress={onScan}
						style={[styles.showAll, styles.divided]}
					>
						<AppText style={styles.accent}>{copy.scanInstead}</AppText>
					</Pressable>
				</View>
			) : null}
		</View>
	);
}

/** Asks Open Food Facts now, for a term that has not been (or could not be) asked. */
function ManualSearch({
	term,
	copy,
	onCommit,
}: {
	term: string;
	copy: LogFoodCopy;
	onCommit: () => void;
}) {
	const styles = useThemedStyles(createStyles);
	return (
		<View style={styles.card}>
			<Pressable
				accessibilityRole="button"
				onPress={onCommit}
				style={styles.manual}
			>
				<LogFoodMediaSlot
					symbol={{ ios: "globe", android: "public", web: "public" }}
				/>
				<View style={styles.flex}>
					<AppText style={styles.accent}>
						{copy.searchOnlineQuery(term)}
					</AppText>
					<AppText variant="caption">{copy.searchOnlineHint}</AppText>
				</View>
			</Pressable>
		</View>
	);
}

/** The seconds left on a rate limit, ticking down once a second. */
function Countdown({ until, copy }: { until: number; copy: LogFoodCopy }) {
	const [now, setNow] = useState(Date.now);
	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(timer);
	}, []);
	const seconds = Math.max(0, Math.ceil((until - now) / 1000));
	return <Notice symbol="timer" text={copy.offCooling(seconds)} live bare />;
}

function Notice({
	symbol,
	text,
	live = false,
	bare = false,
}: {
	symbol: "wifi.slash" | "timer";
	text: string;
	live?: boolean;
	bare?: boolean;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	return (
		<View
			accessibilityLiveRegion={live ? "polite" : undefined}
			style={[styles.notice, !bare && styles.card]}
		>
			<SymbolView
				name={{
					ios: symbol,
					android: symbol === "timer" ? "timer" : "wifi_off",
					web: symbol === "timer" ? "timer" : "wifi_off",
				}}
				size={18}
				tintColor={colors.textMuted}
			/>
			<AppText variant="caption" style={styles.flex}>
				{text}
			</AppText>
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		section: { paddingBottom: spacing.sm },
		flex: { flex: 1 },
		card: {
			marginHorizontal: spacing.md,
			marginTop: spacing.sm,
			borderRadius: radius.contentCard,
			backgroundColor: colors.surface,
			overflow: "hidden",
		},
		manual: {
			minHeight: 64,
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
			paddingHorizontal: spacing.md,
			paddingVertical: 10,
		},
		accent: { color: colors.accentInk, fontWeight: "600" },
		skeleton: { gap: spacing.sm, paddingHorizontal: spacing.md },
		showAll: {
			minHeight: 48,
			alignItems: "center",
			justifyContent: "center",
			paddingHorizontal: spacing.md,
		},
		divided: {
			borderTopWidth: StyleSheet.hairlineWidth,
			borderTopColor: colors.separator,
		},
		note: { marginHorizontal: 20, marginTop: 7 },
		notice: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
			padding: spacing.md,
		},
	});
