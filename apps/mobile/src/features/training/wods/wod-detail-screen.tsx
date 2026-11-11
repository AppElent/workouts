/** One WOD: what it is, what you have scored on it, and a form to add another. */
import { formatMovement, formatScore, prImprovement } from "@foundry/core";
import { useMutation } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { api, type Doc, type Id } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import { formatSessionDate } from "../../../data/session-data";
import { fmt, useI18n } from "../../../i18n";
import {
	opacity,
	radius,
	spacing,
	type Tokens,
	type,
	useThemedStyles,
} from "../../../theme";
import { Card, Chip, Eyebrow } from "../../../ui/coach";
import { useConfirm } from "../../../ui/confirm-dialog";
import { ScreenHeader } from "../../../ui/screen-header";
import { AppText } from "../../../ui/text";
import { useToast } from "../../../ui/toast";
import { useWriteFailureMessage } from "../../../ui/use-screen-write";
import { useWodScoreDraft, WodScoreFields } from "./wod-score-fields";

export function WodDetailScreen({
	onEdit,
}: {
	onEdit: (id: Id<"wods">) => void;
}) {
	const errorMessage = useWriteFailureMessage();
	const styles = useThemedStyles(createStyles);
	const router = useRouter();
	const toast = useToast();
	const confirm = useConfirm();
	const { locale, t } = useI18n();
	const copy = t.wods;
	const params = useLocalSearchParams<{ id?: string }>();
	const wodId = params.id as Id<"wods"> | undefined;

	const wod = useQuery(api.wods.getById, wodId ? { id: wodId } : "skip");
	const results = useQuery(
		api.wodResults.listForWod,
		wodId ? { wodId } : "skip",
	);
	const best = useQuery(api.wodResults.getBest, wodId ? { wodId } : "skip");

	const removeWod = useMutation(api.wods.remove);
	const removeResult = useMutation(api.wodResults.remove);

	const deleteWod = async () => {
		if (!wodId) return;
		const confirmed = await confirm({
			title: fmt(copy.deleteWodTitle, { name: wod?.name ?? copy.thisWod }),
			message: copy.deleteWodMessage,
			confirmLabel: copy.deleteWod,
			destructive: true,
		});
		if (!confirmed) return;
		try {
			await removeWod({ id: wodId });
			router.back();
		} catch (error) {
			toast.error(errorMessage(error, copy.deleteWodError));
		}
	};

	const deleteResult = async (id: Id<"wodResults">) => {
		const confirmed = await confirm({
			title: copy.deleteResultTitle,
			confirmLabel: copy.deleteResult,
			destructive: true,
		});
		if (!confirmed) return;
		try {
			await removeResult({ id });
		} catch (error) {
			toast.error(errorMessage(error, copy.deleteResultError));
		}
	};

	if (wod === undefined) {
		return (
			<View style={[styles.root, styles.centered]}>
				<AppText variant="caption">{copy.loading}</AppText>
			</View>
		);
	}

	if (wod === null) {
		return (
			<View style={[styles.root, styles.centered]}>
				<AppText variant="heading">{copy.notFound}</AppText>
			</View>
		);
	}

	return (
		<ScrollView
			contentInsetAdjustmentBehavior="automatic"
			automaticallyAdjustKeyboardInsets
			keyboardDismissMode="interactive"
			style={styles.root}
			contentContainerStyle={styles.content}
			showsVerticalScrollIndicator={false}
			keyboardShouldPersistTaps="handled"
		>
			<View style={styles.header}>
				<View style={styles.flex}>
					<ScreenHeader title={wod.name} />
					<AppText variant="caption">
						{copy.types[wod.type]}
						{wod.isDefault ? ` · ${copy.benchmark}` : ""}
					</AppText>
				</View>
			</View>

			<Card style={styles.detailCard}>
				{wod.repScheme ? (
					<AppText variant="body" style={styles.scheme}>
						{wod.repScheme}
					</AppText>
				) : null}
				{wod.movements.map((movement, index) => (
					<AppText
						// biome-ignore lint/suspicious/noArrayIndexKey: movements may repeat and have no id
						key={index}
						variant="body"
						style={styles.movement}
					>
						{formatMovement(movement)}
					</AppText>
				))}
				{wod.timeCapSeconds ? (
					<AppText variant="caption">
						{fmt(copy.timeCap, {
							minutes: Math.round(wod.timeCapSeconds / 60),
						})}
					</AppText>
				) : null}
				{wod.durationSeconds ? (
					<AppText variant="caption">
						{fmt(copy.minutes, {
							minutes: Math.round(wod.durationSeconds / 60),
						})}
					</AppText>
				) : null}
				{wod.description ? (
					<AppText variant="caption">{wod.description}</AppText>
				) : null}
			</Card>

			{best ? (
				<Card style={styles.bestCard}>
					<Eyebrow>{copy.best}</Eyebrow>
					<AppText style={styles.bestValue}>
						{formatScore(wod.type, best)}
					</AppText>
					<AppText variant="caption">
						{best.rxScaled === "rx" ? copy.rx : copy.scaled} ·{" "}
						{formatSessionDate(best.date, locale)}
					</AppText>
				</Card>
			) : null}

			<LogResultForm wod={wod} best={best ?? null} />

			<Eyebrow>{copy.history}</Eyebrow>
			{results === undefined ? (
				<AppText style={styles.muted}>{copy.loading}</AppText>
			) : results.length === 0 ? (
				<AppText style={styles.muted}>{copy.nothingLogged}</AppText>
			) : (
				<View style={styles.list}>
					{[...results].reverse().map((r) => (
						<View key={r._id} style={styles.row}>
							<View style={styles.flex}>
								<AppText variant="body" style={styles.rowTitle}>
									{formatScore(wod.type, r)}
								</AppText>
								<AppText variant="caption">
									{r.rxScaled === "rx" ? copy.rx : copy.scaled} ·{" "}
									{formatSessionDate(r.date, locale)}
									{r.notes ? ` · ${r.notes}` : ""}
								</AppText>
							</View>
							<Pressable
								onPress={() => void deleteResult(r._id)}
								hitSlop={12}
								accessibilityRole="button"
								accessibilityLabel={copy.deleteResult}
							>
								<AppText variant="caption" style={styles.delete}>
									{copy.delete}
								</AppText>
							</Pressable>
						</View>
					))}
				</View>
			)}

			{wod.isDefault ? null : (
				<View style={styles.actions}>
					<Pressable
						accessibilityRole="button"
						onPress={() => onEdit(wod._id)}
						style={styles.ghostBtn}
					>
						<AppText style={styles.ghostText}>{copy.edit}</AppText>
					</Pressable>
					<Pressable
						accessibilityRole="button"
						onPress={() => void deleteWod()}
						style={styles.ghostBtn}
					>
						<AppText style={styles.deleteText}>{copy.deleteWod}</AppText>
					</Pressable>
				</View>
			)}
		</ScrollView>
	);
}

function LogResultForm({
	wod,
	best,
}: {
	wod: Doc<"wods">;
	best: Doc<"wodResults"> | null;
}) {
	const errorMessage = useWriteFailureMessage();
	const styles = useThemedStyles(createStyles);
	const toast = useToast();
	const copy = useI18n().t.wods;
	const logResult = useMutation(api.wodResults.log);
	const draft = useWodScoreDraft(wod.type);
	const [rx, setRx] = useState(true);
	const [busy, setBusy] = useState(false);

	const submit = async () => {
		if (busy || !draft.complete) return;

		setBusy(true);
		try {
			await logResult({
				wodId: wod._id,
				rxScaled: rx ? "rx" : "scaled",
				notes: draft.notes,
				...draft.score,
			});
			const improvement = best
				? prImprovement(wod.type, draft.score, best)
				: null;
			if (improvement) toast.success(fmt(copy.newPr, { improvement }));
			draft.reset();
		} catch (error) {
			toast.error(errorMessage(error, copy.logError));
		} finally {
			setBusy(false);
		}
	};

	return (
		<>
			<Eyebrow>{copy.logResultHeading}</Eyebrow>

			<View style={styles.chipRow}>
				<Chip label={copy.rx} active={rx} onPress={() => setRx(true)} />
				<Chip label={copy.scaled} active={!rx} onPress={() => setRx(false)} />
			</View>

			<WodScoreFields draft={draft} />

			<Pressable
				accessibilityRole="button"
				accessibilityState={{ disabled: busy }}
				onPress={() => void submit()}
				disabled={busy || !draft.complete}
				style={[styles.submit, busy && styles.dimmed]}
			>
				<AppText style={styles.submitText}>
					{busy ? copy.logging : copy.logResult}
				</AppText>
			</Pressable>
		</>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		root: { flex: 1, backgroundColor: colors.bg },
		content: {
			padding: spacing.md,
			gap: spacing.sm,
			paddingBottom: spacing.xxl,
		},
		centered: {
			alignItems: "center",
			justifyContent: "center",
			gap: spacing.sm,
		},
		header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
		flex: { flex: 1, gap: 2 },
		detailCard: { gap: spacing.xs },
		scheme: { fontWeight: "800", color: colors.accent },
		movement: { color: colors.textMuted },
		bestCard: { gap: 2 },
		bestValue: {
			fontSize: type.metric.fontSize,
			fontWeight: "800",
			color: colors.text,
		},
		chipRow: { flexDirection: "row", gap: spacing.xs + 2 },
		submit: {
			height: 48,
			borderRadius: radius.pill,
			backgroundColor: colors.accentFill,
			alignItems: "center",
			justifyContent: "center",
		},
		submitText: {
			fontSize: type.body.fontSize,
			fontWeight: "800",
			color: colors.onAccent,
		},
		dimmed: { opacity: opacity.disabled },
		muted: { fontSize: type.footnote.fontSize, color: colors.textMuted },
		list: { gap: spacing.sm },
		row: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.sm,
			backgroundColor: colors.surface,
			borderRadius: radius.lg,
			padding: spacing.md,
		},
		rowTitle: { fontWeight: "800" },
		delete: { color: colors.danger, fontWeight: "700" },
		actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
		ghostBtn: {
			flex: 1,
			minHeight: 44,
			borderRadius: radius.pill,
			borderWidth: 1,
			borderColor: colors.borderStrong,
			alignItems: "center",
			justifyContent: "center",
		},
		ghostText: {
			fontSize: type.footnote.fontSize,
			fontWeight: "800",
			color: colors.text,
		},
		deleteText: {
			fontSize: type.footnote.fontSize,
			fontWeight: "700",
			color: colors.danger,
		},
	});
