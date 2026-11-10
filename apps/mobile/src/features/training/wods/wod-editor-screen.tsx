/**
 * Create or edit a WOD.
 *
 * The type drives which fields matter: a time cap belongs to For Time, a
 * duration to AMRAP and EMOM, and neither to a Load workout. Rather than grey
 * out irrelevant inputs, the form only renders the ones the chosen type uses.
 *
 * Movements are free text plus optional reps. The schema allows weight,
 * distance and units per movement too; those are omitted here because the
 * mobile entry cost outweighs their use mid-class — the description field
 * carries anything more elaborate.
 */
import { WOD_TYPES, type WodType } from "@foundry/core";
import { useMutation } from "convex/react";
import { useRef, useState } from "react";
import {
	Pressable,
	ScrollView,
	StyleSheet,
	TextInput,
	View,
} from "react-native";
import { api, type Doc, type Id } from "../../../convex/api";
import { useQuery } from "../../../convex/query-cache";
import { fmt, useI18n } from "../../../i18n";
import { convexErrorMessage } from "../../../i18n/errors";
import {
	opacity,
	radius,
	spacing,
	type Tokens,
	type,
	useThemedStyles,
	useTokens,
} from "../../../theme";
import { Chip, Eyebrow } from "../../../ui/coach";
import { AppText } from "../../../ui/text";
import { useToast } from "../../../ui/toast";
import { EditorStatus } from "../components/editor-status";

/** `key` is a client-only row id; it never reaches the server. */
type Movement = { key: number; name: string; reps: string };

/** Minutes in the form, seconds in the schema. */
function minutesToSeconds(raw: string) {
	const parsed = Number.parseFloat(raw.trim());
	if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
	return Math.round(parsed * 60);
}

/** Omit `wodId` to create; pass one to edit it in place. */
export function WodEditorScreen({
	wodId,
	onClose,
}: {
	wodId?: Id<"wods">;
	onClose: () => void;
}) {
	const copy = useI18n().t.wods;
	const wod = useQuery(api.wods.getById, wodId ? { id: wodId } : "skip");
	if (wodId && wod === undefined)
		return <EditorStatus label={copy.loadingWod} />;
	if (wodId && !wod) return <EditorStatus label={copy.notFound} />;
	return <WodEditorForm wod={wod ?? null} onClose={onClose} />;
}

function WodEditorForm({
	wod,
	onClose,
}: {
	wod: Doc<"wods"> | null;
	onClose: () => void;
}) {
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const toast = useToast();
	const copy = useI18n().t.wods;
	const createWod = useMutation(api.wods.create);
	const updateWod = useMutation(api.wods.update);

	const [name, setName] = useState(wod?.name ?? "");
	const [type, setType] = useState<WodType>(wod?.type ?? "forTime");
	const [description, setDescription] = useState(wod?.description ?? "");
	const [repScheme, setRepScheme] = useState(wod?.repScheme ?? "");
	const [cap, setCap] = useState(
		wod?.timeCapSeconds ? String(wod.timeCapSeconds / 60) : "",
	);
	const [duration, setDuration] = useState(
		wod?.durationSeconds ? String(wod.durationSeconds / 60) : "",
	);
	const nextMovementKey = useRef(0);
	const blankMovement = (): Movement => ({
		key: nextMovementKey.current++,
		name: "",
		reps: "",
	});
	const [movements, setMovements] = useState<Movement[]>(
		() =>
			wod?.movements.map((m) => ({
				...blankMovement(),
				name: m.name,
				reps: m.reps !== undefined ? String(m.reps) : "",
			})) ?? [blankMovement()],
	);
	const [busy, setBusy] = useState(false);

	const patchMovement = (index: number, changes: Partial<Movement>) => {
		setMovements((prev) =>
			prev.map((m, i) => (i === index ? { ...m, ...changes } : m)),
		);
	};

	const submit = async () => {
		const trimmed = name.trim();
		if (trimmed === "" || busy) return;

		const cleaned = movements
			.map((m) => ({
				name: m.name.trim(),
				reps: Number.parseInt(m.reps.trim(), 10),
			}))
			.filter((m) => m.name !== "")
			.map((m) => ({
				name: m.name,
				reps: Number.isFinite(m.reps) && m.reps > 0 ? m.reps : undefined,
			}));

		const fields = {
			name: trimmed,
			type,
			description: description.trim() === "" ? undefined : description.trim(),
			repScheme: repScheme.trim() === "" ? undefined : repScheme.trim(),
			timeCapSeconds: type === "forTime" ? minutesToSeconds(cap) : undefined,
			durationSeconds:
				type === "amrap" || type === "emom"
					? minutesToSeconds(duration)
					: undefined,
			movements: cleaned,
		};

		setBusy(true);
		try {
			if (wod) {
				await updateWod({ id: wod._id, ...fields });
			} else {
				await createWod(fields);
			}
			onClose();
		} catch (error) {
			toast.error(convexErrorMessage(error, copy.editor.saveError));
		} finally {
			setBusy(false);
		}
	};

	const canSave = name.trim() !== "" && !busy;

	return (
		<View style={styles.root}>
			<ScrollView
				contentInsetAdjustmentBehavior="automatic"
				automaticallyAdjustKeyboardInsets
				keyboardDismissMode="interactive"
				contentContainerStyle={styles.content}
				keyboardShouldPersistTaps="handled"
				showsVerticalScrollIndicator={false}
			>
				<Eyebrow>{copy.editor.name}</Eyebrow>
				<TextInput
					value={name}
					onChangeText={setName}
					placeholder={copy.editor.namePlaceholder}
					placeholderTextColor={colors.textFaint}
					style={styles.input}
					autoFocus
				/>

				<Eyebrow>{copy.editor.type}</Eyebrow>
				<View style={styles.chipWrap}>
					{WOD_TYPES.map((t) => (
						<Chip
							key={t}
							label={copy.types[t]}
							active={type === t}
							onPress={() => setType(t)}
						/>
					))}
				</View>

				{type === "forTime" ? (
					<>
						<Eyebrow>{copy.editor.timeCap}</Eyebrow>
						<TextInput
							value={cap}
							onChangeText={setCap}
							placeholder="12"
							placeholderTextColor={colors.textFaint}
							style={styles.input}
							keyboardType="decimal-pad"
						/>
					</>
				) : null}

				{type === "amrap" || type === "emom" ? (
					<>
						<Eyebrow>{copy.editor.duration}</Eyebrow>
						<TextInput
							value={duration}
							onChangeText={setDuration}
							placeholder="20"
							placeholderTextColor={colors.textFaint}
							style={styles.input}
							keyboardType="decimal-pad"
						/>
					</>
				) : null}

				<Eyebrow>{copy.editor.repScheme}</Eyebrow>
				<TextInput
					value={repScheme}
					onChangeText={setRepScheme}
					placeholder="21-15-9"
					placeholderTextColor={colors.textFaint}
					style={styles.input}
				/>

				<Eyebrow>{copy.editor.movements}</Eyebrow>
				{movements.map((m, index) => (
					<View key={m.key} style={styles.movementRow}>
						<TextInput
							value={m.name}
							onChangeText={(v) => patchMovement(index, { name: v })}
							placeholder={copy.editor.movementPlaceholder}
							placeholderTextColor={colors.textFaint}
							style={[styles.input, styles.flex]}
						/>
						<TextInput
							value={m.reps}
							onChangeText={(v) => patchMovement(index, { reps: v })}
							placeholder={copy.editor.repsPlaceholder}
							placeholderTextColor={colors.textFaint}
							style={[styles.input, styles.repsInput]}
							keyboardType="number-pad"
						/>
						{movements.length > 1 ? (
							<Pressable
								onPress={() =>
									setMovements((prev) => prev.filter((_, i) => i !== index))
								}
								hitSlop={8}
								style={styles.removeBtn}
								accessibilityRole="button"
								accessibilityLabel={fmt(copy.editor.removeMovement, {
									number: index + 1,
								})}
							>
								<AppText style={styles.remove}>✕</AppText>
							</Pressable>
						) : null}
					</View>
				))}
				<Pressable
					accessibilityRole="button"
					onPress={() => setMovements((prev) => [...prev, blankMovement()])}
					style={styles.addBtn}
				>
					<AppText style={styles.addBtnText}>{copy.editor.addMovement}</AppText>
				</Pressable>

				<Eyebrow>{copy.editor.description}</Eyebrow>
				<TextInput
					value={description}
					onChangeText={setDescription}
					placeholder={copy.editor.descriptionPlaceholder}
					placeholderTextColor={colors.textFaint}
					style={[styles.input, styles.multiline]}
					multiline
				/>

				<Pressable
					accessibilityRole="button"
					accessibilityState={{ disabled: !canSave }}
					onPress={() => void submit()}
					disabled={!canSave}
					style={[styles.submit, !canSave && styles.dimmed]}
				>
					<AppText style={styles.submitText}>
						{busy
							? copy.editor.saving
							: wod
								? copy.editor.save
								: copy.editor.create}
					</AppText>
				</Pressable>
			</ScrollView>
		</View>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		root: {
			flex: 1,
			backgroundColor: colors.bg,
			paddingHorizontal: spacing.md,
		},
		content: { gap: spacing.sm, paddingBottom: spacing.xxl },
		input: {
			minHeight: 48,
			borderRadius: radius.lg,
			paddingHorizontal: spacing.md,
			backgroundColor: colors.surface,
			borderWidth: 1,
			borderColor: colors.border,
			color: colors.text,
			fontSize: type.body.fontSize,
		},
		multiline: {
			minHeight: 88,
			paddingTop: spacing.sm,
			textAlignVertical: "top",
		},
		chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs + 2 },
		movementRow: {
			flexDirection: "row",
			alignItems: "center",
			gap: spacing.xs,
		},
		flex: { flex: 1 },
		repsInput: { width: 76, textAlign: "center" },
		removeBtn: {
			width: 32,
			height: 44,
			alignItems: "center",
			justifyContent: "center",
		},
		remove: {
			fontSize: type.table.fontSize,
			fontWeight: "800",
			color: colors.textMuted,
		},
		addBtn: {
			minHeight: 44,
			borderRadius: radius.pill,
			borderWidth: 1,
			borderColor: colors.borderStrong,
			alignItems: "center",
			justifyContent: "center",
		},
		addBtnText: {
			fontSize: type.footnote.fontSize,
			fontWeight: "700",
			color: colors.text,
		},
		submit: {
			height: 48,
			marginTop: spacing.sm,
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
	});
