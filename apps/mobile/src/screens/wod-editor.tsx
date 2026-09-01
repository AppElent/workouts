/**
 * Create or edit a WOD. Ported from the web's
 * `src/components/wods/CreateWodForm.tsx`.
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
import { useMutation } from "convex/react";
import { useState } from "react";
import {
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	TextInput,
	View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, type Doc } from "../convex/api";
import { colors, radius, spacing } from "../theme";
import { Chip, Eyebrow } from "../ui/coach";
import { convexErrorMessage } from "../ui/confirm-dialog";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";
import { WOD_TYPE_LABEL } from "./wods-list";

const TYPES = ["forTime", "amrap", "emom", "load"] as const;
type WodType = (typeof TYPES)[number];

type Movement = { name: string; reps: string };

/** Minutes in the form, seconds in the schema. */
function minutesToSeconds(raw: string) {
	const parsed = Number.parseFloat(raw.trim());
	if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
	return Math.round(parsed * 60);
}

export function WodEditor({
	visible,
	wod,
	onClose,
}: {
	visible: boolean;
	/** Omit to create; pass one to edit it in place. */
	wod?: Doc<"wods"> | null;
	onClose: () => void;
}) {
	const toast = useToast();
	const insets = useSafeAreaInsets();
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
	const [movements, setMovements] = useState<Movement[]>(
		() =>
			wod?.movements.map((m) => ({
				name: m.name,
				reps: m.reps !== undefined ? String(m.reps) : "",
			})) ?? [{ name: "", reps: "" }],
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
			toast.error(convexErrorMessage(error, "Could not save the WOD."));
		} finally {
			setBusy(false);
		}
	};

	const canSave = name.trim() !== "" && !busy;

	return (
		<Modal visible={visible} animationType="slide" onRequestClose={onClose}>
			<View style={[styles.root, { paddingTop: insets.top + spacing.sm }]}>
				<View style={styles.header}>
					<AppText variant="heading">{wod ? "Edit WOD" : "New WOD"}</AppText>
					<Pressable
						onPress={onClose}
						hitSlop={12}
						accessibilityRole="button"
						accessibilityLabel="Cancel"
					>
						<AppText variant="body" style={styles.cancel}>
							Cancel
						</AppText>
					</Pressable>
				</View>

				<ScrollView
					contentContainerStyle={styles.content}
					keyboardShouldPersistTaps="handled"
					showsVerticalScrollIndicator={false}
				>
					<Eyebrow>Name</Eyebrow>
					<TextInput
						value={name}
						onChangeText={setName}
						placeholder="Fran"
						placeholderTextColor={colors.textFaint}
						style={styles.input}
						autoFocus
					/>

					<Eyebrow>Type</Eyebrow>
					<View style={styles.chipWrap}>
						{TYPES.map((t) => (
							<Pressable key={t} onPress={() => setType(t)}>
								<Chip label={WOD_TYPE_LABEL[t]} active={type === t} />
							</Pressable>
						))}
					</View>

					{type === "forTime" ? (
						<>
							<Eyebrow>Time cap (minutes)</Eyebrow>
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
							<Eyebrow>Duration (minutes)</Eyebrow>
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

					<Eyebrow>Rep scheme</Eyebrow>
					<TextInput
						value={repScheme}
						onChangeText={setRepScheme}
						placeholder="21-15-9"
						placeholderTextColor={colors.textFaint}
						style={styles.input}
					/>

					<Eyebrow>Movements</Eyebrow>
					{movements.map((m, index) => (
						<View
							// Movement rows have no id and can hold identical text while
							// being typed; position is the only thing that distinguishes
							// them, and rows are only ever appended or removed at the end.
							// biome-ignore lint/suspicious/noArrayIndexKey: positional rows, no stable id
							key={index}
							style={styles.movementRow}
						>
							<TextInput
								value={m.name}
								onChangeText={(v) => patchMovement(index, { name: v })}
								placeholder="Thruster"
								placeholderTextColor={colors.textFaint}
								style={[styles.input, styles.flex]}
							/>
							<TextInput
								value={m.reps}
								onChangeText={(v) => patchMovement(index, { reps: v })}
								placeholder="reps"
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
									accessibilityLabel={`Remove movement ${index + 1}`}
								>
									<AppText style={styles.remove}>✕</AppText>
								</Pressable>
							) : null}
						</View>
					))}
					<Pressable
						onPress={() =>
							setMovements((prev) => [...prev, { name: "", reps: "" }])
						}
						style={styles.addBtn}
					>
						<AppText style={styles.addBtnText}>+ Add movement</AppText>
					</Pressable>

					<Eyebrow>Description (optional)</Eyebrow>
					<TextInput
						value={description}
						onChangeText={setDescription}
						placeholder="Scaling notes, standards, anything else"
						placeholderTextColor={colors.textFaint}
						style={[styles.input, styles.multiline]}
						multiline
					/>

					<Pressable
						onPress={() => void submit()}
						disabled={!canSave}
						style={[styles.submit, !canSave && styles.dimmed]}
					>
						<AppText style={styles.submitText}>
							{busy ? "Saving…" : wod ? "Save changes" : "Create WOD"}
						</AppText>
					</Pressable>
				</ScrollView>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: spacing.md },
	header: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		minHeight: 44,
	},
	cancel: { color: colors.accent, fontWeight: "700" },
	content: { gap: spacing.sm, paddingBottom: spacing.xxl },
	input: {
		minHeight: 48,
		borderRadius: radius.lg,
		paddingHorizontal: spacing.md,
		backgroundColor: colors.surface,
		borderWidth: 1,
		borderColor: colors.border,
		color: colors.text,
		fontSize: 15,
	},
	multiline: {
		minHeight: 88,
		paddingTop: spacing.sm,
		textAlignVertical: "top",
	},
	chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs + 2 },
	movementRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
	flex: { flex: 1 },
	repsInput: { width: 76, textAlign: "center" },
	removeBtn: {
		width: 32,
		height: 44,
		alignItems: "center",
		justifyContent: "center",
	},
	remove: { fontSize: 14, fontWeight: "800", color: colors.textMuted },
	addBtn: {
		minHeight: 44,
		borderRadius: radius.pill,
		borderWidth: 1,
		borderColor: colors.borderStrong,
		alignItems: "center",
		justifyContent: "center",
	},
	addBtnText: { fontSize: 13, fontWeight: "700", color: colors.text },
	submit: {
		height: 48,
		marginTop: spacing.sm,
		borderRadius: radius.pill,
		backgroundColor: colors.accent,
		alignItems: "center",
		justifyContent: "center",
	},
	submitText: { fontSize: 15, fontWeight: "800", color: colors.onAccent },
	dimmed: { opacity: 0.5 },
});
