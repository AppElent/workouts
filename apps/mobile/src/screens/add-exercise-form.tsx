import type { Exercise } from "@workouts/core/exercises";
import { useMutation } from "convex/react";
import { Stack } from "expo-router";
import { useState } from "react";
import { Modal, Platform } from "react-native";
import { api } from "../convex/api";
import { modalAnimation, useReduceMotion } from "../feedback/reduce-motion";
import { useI18n } from "../i18n";
import { useTokens } from "../theme";
import { convexErrorMessage } from "../ui/confirm-dialog";
import {
	DisclosureRow,
	FormChoiceRow,
	FormScreen,
	FormSection,
	FormSegmentedRow,
	FormTextField,
	InlineNumberFieldRow,
} from "../ui/form";
import { MuscleIcon } from "../ui/muscle-icon";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";
import {
	EQUIPMENT,
	type Equipment,
	GROUP_KEYS,
	type Group,
	toggleChoice,
} from "./exercise-library/model";

export function AddExerciseForm({
	visible = true,
	presentation = "modal",
	onClose,
	exercise,
	mode = "new",
}: {
	exercise?: Exercise;
	mode?: "new" | "edit" | "clone";
	visible?: boolean;
	presentation?: "modal" | "screen";
	onClose: (createdName?: string) => void;
}) {
	const { t } = useI18n();
	const c = t.exercises;
	const colors = useTokens();
	const nativeHeader = presentation === "screen" && Platform.OS === "ios";
	const toast = useToast();
	const reduceMotion = useReduceMotion();
	const create = useMutation(api.exercises.create);
	const update = useMutation(api.exercises.update);
	const title =
		mode === "edit" ? c.editTitle : mode === "clone" ? c.cloneTitle : c.new;
	const [name, setName] = useState(
		mode === "clone" && exercise
			? c.copyName.replace("{name}", exercise.name)
			: (exercise?.name ?? ""),
	);
	const [groups, setGroups] = useState<Group[]>(() =>
		GROUP_KEYS.filter((g) =>
			exercise?.muscleGroups.includes(g === "legs" ? "quads" : g),
		),
	);
	const [groupsOpen, setGroupsOpen] = useState(false);
	const [additionalGroups, setAdditionalGroups] = useState(
		() =>
			exercise?.muscleGroups
				.filter(
					(m) => !GROUP_KEYS.some((g) => m === (g === "legs" ? "quads" : g)),
				)
				.join(", ") ?? "",
	);
	const [category, setCategory] = useState<"compound" | "isolation">(
		exercise?.category ?? "compound",
	);
	const [equipment, setEquipment] = useState<Equipment>(
		exercise?.equipment ?? "barbell",
	);
	const [increment, setIncrement] = useState(
		exercise?.weightIncrement?.toString() ?? "",
	);
	const [notes, setNotes] = useState(exercise?.notes ?? "");
	const [busy, setBusy] = useState(false);
	const loaded = equipment !== "bodyweight" && equipment !== "band";
	const parsed = Number(increment.replace(",", "."));
	const invalid =
		loaded &&
		increment.trim() !== "" &&
		(!Number.isFinite(parsed) || parsed <= 0);
	const close = () => {
		if (!busy) {
			setName("");
			setGroups([]);
			setGroupsOpen(false);
			setAdditionalGroups("");
			setCategory("compound");
			setEquipment("barbell");
			setIncrement("");
			setNotes("");
			onClose();
		}
	};
	const submit = async () => {
		if (busy || !name.trim() || invalid) return;
		setBusy(true);
		try {
			const selectedMuscles = [
				...new Set([
					...groups.map((g) => (g === "legs" ? "quads" : g)),
					...additionalGroups
						.split(",")
						.map((g) => g.trim().toLowerCase())
						.filter(Boolean),
				]),
			];
			const values = {
				name: name.trim(),
				// Keep primary-muscle order when editing or copying an existing exercise.
				muscleGroups: exercise
					? [
							...exercise.muscleGroups.filter((m) =>
								selectedMuscles.includes(m),
							),
							...selectedMuscles.filter(
								(m) => !exercise.muscleGroups.includes(m),
							),
						]
					: selectedMuscles,
				category,
				equipment,
				notes: notes.trim() || undefined,
				weightIncrement: loaded && increment.trim() ? parsed : undefined,
			};
			if (mode === "edit") {
				if (!exercise || exercise.isDefault) throw new Error(c.updateError);
				await update({ id: exercise._id, ...values });
			} else {
				await create({ ...values, instructions: exercise?.instructions });
			}
			setName("");
			setGroups([]);
			setGroupsOpen(false);
			setAdditionalGroups("");
			setNotes("");
			setIncrement("");
			onClose(name.trim());
		} catch (error) {
			toast.error(
				convexErrorMessage(
					error,
					mode === "edit" ? c.updateError : c.createError,
				),
			);
		} finally {
			setBusy(false);
		}
	};
	const content = (
		<FormScreen
			title={nativeHeader ? undefined : title}
			nativeSheet={nativeHeader}
			primaryActionPlacement="header"
			cancelLabel={c.cancel}
			onCancel={close}
			primaryAction={
				nativeHeader
					? undefined
					: {
							label: busy ? c.saving : c.save,
							onPress: () => void submit(),
							loading: busy,
							disabled: !name.trim() || invalid,
						}
			}
		>
			<FormSection title={c.essentials}>
				<FormTextField
					label={c.name}
					appearance="plain"
					placeholder={c.namePlaceholder}
					value={name}
					onChangeText={setName}
					editable={!busy}
					autoCapitalize="words"
				/>
				<DisclosureRow
					label={c.groups}
					value={[
						...groups.map((g) => c.groupNames[g]),
						...additionalGroups
							.split(",")
							.map((m) => m.trim())
							.filter(Boolean),
					].join(", ")}
					expanded={groupsOpen}
					onPress={() => setGroupsOpen(!groupsOpen)}
				/>
				{groupsOpen ? (
					<>
						{GROUP_KEYS.map((group) => (
							<FormChoiceRow
								key={group}
								label={c.groupNames[group]}
								leading={<MuscleIcon group={group} size={36} />}
								selected={groups.includes(group)}
								onPress={() => {
									if (!busy) setGroups(toggleChoice(groups, group));
								}}
							/>
						))}
						<FormTextField
							label={c.additionalGroups}
							placeholder={c.additionalGroupsPlaceholder}
							value={additionalGroups}
							onChangeText={setAdditionalGroups}
							editable={!busy}
							autoCapitalize="none"
						/>
					</>
				) : null}
				<FormSegmentedRow
					label={c.equipment}
					value={equipment}
					onChange={(value) => {
						if (!busy) setEquipment(value);
					}}
					options={EQUIPMENT.map((value) => ({
						value,
						label: c.equipmentNames[value],
					}))}
				/>
			</FormSection>
			<FormSection
				title={c.trainingDetails}
				footer={loaded ? c.stepHelp : undefined}
			>
				<FormSegmentedRow
					value={category}
					onChange={(value) => {
						if (!busy) setCategory(value);
					}}
					options={[
						{ value: "compound", label: c.compound },
						{ value: "isolation", label: c.isolation },
					]}
				/>
				{loaded ? (
					<InlineNumberFieldRow
						label={c.step}
						suffix=""
						value={increment}
						onChangeText={setIncrement}
						editable={!busy}
						placeholder="2.5"
						keyboardType="decimal-pad"
					/>
				) : null}
				{invalid ? (
					<AppText
						accessibilityRole="alert"
						style={{ color: colors.danger, padding: 16 }}
					>
						{c.invalidStep}
					</AppText>
				) : null}
				<FormTextField
					label={c.notes}
					appearance="plain"
					value={notes}
					onChangeText={setNotes}
					editable={!busy}
					placeholder={c.notesPlaceholder}
					multiline
					style={{ minHeight: 64, textAlignVertical: "top" }}
				/>
			</FormSection>
		</FormScreen>
	);
	if (presentation === "screen")
		return (
			<>
				{content}
				<Stack.Screen
					options={{
						title,
						headerShown: nativeHeader,
						headerTitleStyle: { color: colors.text },
						gestureEnabled: !busy,
						sheetGrabberVisible: true,
						sheetAllowedDetents: [0.75, 1],
						sheetExpandsWhenScrolledToEdge: false,
					}}
				/>
				{Platform.OS === "ios" ? (
					<>
						<Stack.Toolbar placement="left">
							<Stack.Toolbar.Button
								hidesSharedBackground
								tintColor={colors.textMuted}
								disabled={busy}
								onPress={close}
							>
								{c.cancel}
							</Stack.Toolbar.Button>
						</Stack.Toolbar>
						<Stack.Toolbar placement="right">
							<Stack.Toolbar.Button
								hidesSharedBackground
								tintColor={colors.accent}
								disabled={busy || !name.trim() || invalid}
								onPress={() => void submit()}
							>
								{busy ? c.saving : c.save}
							</Stack.Toolbar.Button>
						</Stack.Toolbar>
					</>
				) : null}
			</>
		);
	return (
		<Modal
			visible={visible}
			presentationStyle="pageSheet"
			allowSwipeDismissal={!busy}
			animationType={modalAnimation(reduceMotion, "slide")}
			onRequestClose={close}
		>
			{content}
		</Modal>
	);
}
