import { useForm, useStore } from "@tanstack/react-form";
import type { PersonalFood, ServingOption } from "@workouts/core/nutrition";
import { withPersonalMeasures } from "@workouts/core/nutrition";
import { useConvexConnectionState, useMutation } from "convex/react";
import { useRef, useState } from "react";
import {
	InputAccessoryView,
	Keyboard,
	KeyboardAvoidingView,
	Platform,
	Pressable,
	TextInput,
	View,
} from "react-native";
import { z } from "zod";
import { api } from "../../../convex/api";
import { useNutritionOperations } from "../../../data/nutrition-operation-service";
import { usePersonalFoods } from "../../../data/personal-foods";
import { usePersonalMeasureActions } from "../../../data/personal-measures";
import type { useSupplementaryServings } from "../../../data/supplementary-servings";
import { fmt, useI18n } from "../../../i18n";
import { radius, spacing, type, useTokens } from "../../../theme";
import { GlassSurface } from "../../../ui/glass-surface";
import { Segmented } from "../../../ui/segmented";
import { AppText } from "../../../ui/text";

export function DiaryEntryServingPopup({
	food,
	name,
	unit,
	additions,
	onAdded,
	onCancel,
	onBusyChange,
}: {
	food?: PersonalFood | { id: string };
	name: string;
	unit: "g" | "ml" | "serving";
	additions: ReturnType<typeof useSupplementaryServings>;
	onAdded: (option: ServingOption) => void;
	onCancel: () => void;
	onBusyChange: (busy: boolean) => void;
}) {
	const { t } = useI18n();
	const copy = t.diaryEntry;
	const colors = useTokens();
	const foods = usePersonalFoods();
	const measures = usePersonalMeasureActions();
	const operations = useNutritionOperations();
	const createMeasure = useMutation(api.personalMeasures.create);
	const connected = useConvexConnectionState().isWebSocketConnected;
	const nameRef = useRef<TextInput>(null);
	const amountRef = useRef<TextInput>(null);
	const lock = useRef(false);
	const [error, setError] = useState<string>();
	const [active, setActive] = useState<"name" | "amount">("name");
	const [pending, setPending] = useState(false);
	const form = useForm({
		defaultValues: { name: "", amount: "250", scope: food ? "food" : "own" },
		onSubmit: async ({ value }) => {
			if (lock.current) return;
			const result = z
				.object({
					name: z.string().trim().min(1).max(40),
					amount: z.number().positive().max(10000),
				})
				.safeParse({
					name: value.name,
					amount: Number(value.amount.replace(",", ".")),
				});
			if (!result.success) {
				setError(copy.invalidServing);
				return;
			}
			const { name: servingName, amount } = result.data;
			if (
				value.scope === "own" &&
				Math.abs(amount * 10 - Math.round(amount * 10)) > 1e-9
			) {
				setError(copy.invalidMeasure);
				return;
			}
			const personal = food && "provenance" in food;
			if ((value.scope === "own" || !personal) && !connected) {
				setError(copy.offline);
				return;
			}
			lock.current = true;
			setPending(true);
			onBusyChange(true);
			setError(undefined);
			const subject = operations.getSubject();
			try {
				let option: ServingOption;
				if (value.scope === "own" && unit !== "serving") {
					const measure = await createMeasure({
						name: servingName,
						amount,
						unit,
					});
					if (operations.getSubject() !== subject) return;
					measures.markCreated(measure);
					if (subject)
						operations.cachePersonalMeasures(subject, [
							...measures.measures.filter((item) => item.id !== measure.id),
							measure,
						]);
					option = withPersonalMeasures([], unit, [measure])[0];
				} else if (food && personal) {
					const current = foods.find(food.id);
					if (!current || current.baseUnit !== unit)
						throw new Error("unavailable");
					const next = { label: { en: servingName, nl: servingName }, amount };
					const updated = foods.update(current.id, {
						...current,
						servings: [...current.servings, next],
					});
					option = {
						kind: "authored",
						index: updated.servings.length - 1,
						...next,
					};
				} else if (food && unit !== "serving") {
					const saved = await additions.add({
						name: servingName,
						amount,
						unit,
					});
					if (operations.getSubject() !== subject) return;
					option = {
						kind: "supplementary",
						id: saved.id,
						label: { en: servingName, nl: servingName },
						amount,
						unit,
					};
				} else {
					throw new Error("unavailable");
				}
				Keyboard.dismiss();
				onAdded(option);
			} catch {
				setError(copy.addFailure);
			} finally {
				lock.current = false;
				setPending(false);
				onBusyChange(false);
			}
		},
	});
	const values = useStore(form.store, (state) => state.values);
	const inputStyle = { ...type.row, color: colors.text, minHeight: 48 };
	const fields = (
		<>
			<TextInput
				ref={nameRef}
				accessibilityLabel={copy.name}
				autoFocus
				value={values.name}
				onChangeText={(value) => form.setFieldValue("name", value)}
				editable={!pending}
				placeholder={copy.namePlaceholder}
				returnKeyType="next"
				submitBehavior="submit"
				onSubmitEditing={() => amountRef.current?.focus()}
				inputAccessoryViewID="entry-serving"
				onFocus={() => setActive("name")}
				style={
					Platform.OS === "ios"
						? { position: "absolute", width: 1, height: 1, opacity: 0.01 }
						: inputStyle
				}
			/>
			<TextInput
				ref={amountRef}
				accessibilityLabel={copy.amount}
				value={values.amount}
				onChangeText={(value) => form.setFieldValue("amount", value)}
				editable={!pending}
				keyboardType="decimal-pad"
				inputAccessoryViewID="entry-serving"
				onFocus={() => setActive("amount")}
				style={
					Platform.OS === "ios"
						? { position: "absolute", width: 1, height: 1, opacity: 0.01 }
						: inputStyle
				}
			/>
		</>
	);
	const card = (
		<GlassSurface
			style={{ margin: spacing.sm, padding: spacing.md, gap: spacing.sm }}
		>
			<View
				style={{
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					gap: spacing.sm,
				}}
			>
				<Pressable
					disabled={pending}
					accessibilityRole="button"
					accessibilityLabel={copy.cancel}
					onPress={() => {
						Keyboard.dismiss();
						onCancel();
					}}
					style={{ minWidth: 44, minHeight: 44, justifyContent: "center" }}
				>
					<AppText variant="title">×</AppText>
				</Pressable>
				<AppText variant="navTitle" style={{ flex: 1 }}>
					{copy.newServing}
				</AppText>
				<Pressable
					disabled={pending}
					accessibilityRole="button"
					onPress={() => form.handleSubmit()}
					style={{ minHeight: 44, justifyContent: "center" }}
				>
					<AppText style={{ color: colors.accent, fontWeight: "700" }}>
						{pending ? t.nutrition.entryEditor.saving : copy.add}
					</AppText>
				</Pressable>
			</View>
			{Platform.OS === "ios" ? (
				<View style={{ flexDirection: "row", gap: spacing.sm }}>
					{(["name", "amount"] as const).map((key) => (
						<Pressable
							key={key}
							accessibilityRole="button"
							accessibilityLabel={`${key === "name" ? copy.name : copy.amount}: ${values[key]}`}
							onPress={() =>
								(key === "name" ? nameRef : amountRef).current?.focus()
							}
							style={{
								flex: key === "name" ? 1.5 : 1,
								minHeight: 64,
								padding: spacing.sm,
								borderRadius: radius.lg,
								backgroundColor: colors.surface,
								borderWidth: 1,
								borderColor: active === key ? colors.accent : colors.border,
							}}
						>
							<AppText variant="caption">
								{key === "name" ? copy.name : copy.amount}
							</AppText>
							<AppText variant="row">
								{values[key] || copy.namePlaceholder}
								{key === "amount" ? ` ${unit}` : ""}
							</AppText>
						</Pressable>
					))}
				</View>
			) : (
				fields
			)}
			<Segmented
				options={[
					...(food ? [{ value: "food", label: name }] : []),
					...(unit !== "serving"
						? [{ value: "own", label: copy.ownScope }]
						: []),
				]}
				value={values.scope}
				onChange={(value) => {
					if (!pending) form.setFieldValue("scope", value);
				}}
			/>
			<AppText variant="caption">
				{values.scope === "food" ? copy.foodHelp : fmt(copy.ownHelp, { unit })}
			</AppText>
			<AppText variant="caption">{copy.savedSeparately}</AppText>
			{error && (
				<AppText accessibilityRole="alert" style={{ color: colors.danger }}>
					{error}
				</AppText>
			)}
		</GlassSurface>
	);
	return Platform.OS === "ios" ? (
		<>
			{fields}
			<InputAccessoryView nativeID="entry-serving">{card}</InputAccessoryView>
		</>
	) : (
		<KeyboardAvoidingView behavior="padding">{card}</KeyboardAvoidingView>
	);
}
