import { formatQuantity, type PersonalMeasure } from "@workouts/core/nutrition";
import { useConvexConnectionState, useMutation } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { api } from "../convex/api";
import { useNutritionOperations } from "../data/nutrition-operation-service";
import {
	usePersonalMeasureActions,
	usePersonalMeasures,
} from "../data/personal-measures";
import { useI18n } from "../i18n";
import { metrics, spacing, type Tokens, useThemedStyles } from "../theme";
import { convexErrorMessage, useConfirm } from "../ui/confirm-dialog";
import { EmptyState } from "../ui/empty-state";
import {
	EditableValueRow,
	FormScreen,
	FormSection,
	FormTextField,
	InlineActionRow,
	InlineNumberFieldRow,
	TextAction,
} from "../ui/form";
import { ScreenHeader } from "../ui/screen-header";
import { Segmented } from "../ui/segmented";
import { SkeletonBlock, SkeletonGroup } from "../ui/skeleton";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";

export function PersonalMeasuresScreen() {
	const styles = useThemedStyles(createStyles);
	const { t, locale } = useI18n();
	const copy = t.nutrition.personalMeasures;
	const router = useRouter();
	const params = useLocalSearchParams<{
		returnTo?: string;
		baseUnit?: string;
	}>();
	const measures = usePersonalMeasures();
	const measureActions = usePersonalMeasureActions();
	const operations = useNutritionOperations();
	const { isWebSocketConnected } = useConvexConnectionState();
	const createMeasure = useMutation(api.personalMeasures.create);
	const updateMeasure = useMutation(api.personalMeasures.update);
	const removeMeasure = useMutation(api.personalMeasures.remove);
	const reorderMeasures = useMutation(api.personalMeasures.reorder);
	const confirm = useConfirm();
	const toast = useToast();
	const [localMeasures, setLocalMeasures] = useState<PersonalMeasure[]>(() => [
		...measures,
	]);
	const [editing, setEditing] = useState<PersonalMeasure | "new">();
	const [name, setName] = useState("");
	const [amount, setAmount] = useState("");
	const [unit, setUnit] = useState<"g" | "ml">("g");
	const [error, setError] = useState<string>();
	const [pending, setPending] = useState(false);

	useEffect(() => {
		setLocalMeasures([...measures]);
	}, [measures]);

	function beginEdit(measure?: PersonalMeasure) {
		setEditing(measure ?? "new");
		setName(measure?.name ?? "");
		setAmount(measure ? formatQuantity(measure.amount, locale) : "");
		setUnit(measure?.unit ?? "g");
		setError(undefined);
	}

	function cache(next: PersonalMeasure[]) {
		setLocalMeasures(next);
		const subject = operations.getSubject();
		if (subject) operations.cachePersonalMeasures(subject, next);
	}

	async function save() {
		if (!isWebSocketConnected) return;
		const parsed = Number(amount.replace(",", "."));
		const trimmed = name.trim();
		if (
			trimmed.length < 1 ||
			trimmed.length > 40 ||
			!Number.isFinite(parsed) ||
			parsed <= 0 ||
			parsed > 10_000 ||
			Math.abs(parsed * 10 - Math.round(parsed * 10)) > 1e-9
		) {
			setError(copy.validation);
			return;
		}
		setPending(true);
		try {
			if (editing === "new") {
				const created = await createMeasure({
					name: trimmed,
					amount: parsed,
					unit,
				});
				cache([...localMeasures, created]);
				if (params.returnTo === "picker") {
					if (params.baseUnit === created.unit) {
						measureActions.markCreated(created);
					} else {
						toast.error(copy.incompatibleReturn);
					}
					router.back();
				}
			} else if (editing) {
				const updated = await updateMeasure({
					id: editing.id as never,
					name: trimmed,
					amount: parsed,
					unit,
				});
				cache(
					localMeasures.map((item) =>
						item.id === updated.id ? updated : item,
					),
				);
			}
			setEditing(undefined);
		} catch (saveError) {
			toast.error(convexErrorMessage(saveError, copy.saveFailure));
		} finally {
			setPending(false);
		}
	}

	async function remove(measure: PersonalMeasure) {
		if (pending) return;
		if (
			!(await confirm({
				title: copy.deleteTitle,
				message: copy.deleteBody,
				confirmLabel: copy.delete,
				cancelLabel: copy.cancel,
				destructive: true,
			}))
		)
			return;
		setPending(true);
		try {
			await removeMeasure({ id: measure.id as never });
			cache(localMeasures.filter((item) => item.id !== measure.id));
		} catch (removeError) {
			toast.error(convexErrorMessage(removeError, copy.deleteFailure));
		} finally {
			setPending(false);
		}
	}

	async function move(index: number, direction: -1 | 1) {
		if (pending) return;
		const target = index + direction;
		if (target < 0 || target >= localMeasures.length) return;
		const next = [...localMeasures];
		[next[index], next[target]] = [next[target], next[index]];
		const ordered = next.map((measure, order) => ({ ...measure, order }));
		cache(ordered);
		setPending(true);
		try {
			await reorderMeasures({
				ids: ordered.map((measure) => measure.id as never),
			});
		} catch (reorderError) {
			cache(localMeasures);
			toast.error(convexErrorMessage(reorderError, copy.reorderFailure));
		} finally {
			setPending(false);
		}
	}

	async function changeUnit(next: "g" | "ml") {
		if (next === unit) return;
		if (
			editing &&
			editing !== "new" &&
			next !== editing.unit &&
			!(await confirm({
				title: copy.unitChangeTitle,
				message: copy.unitChangeBody,
				confirmLabel: copy.unitChangeConfirm,
				cancelLabel: copy.cancel,
			}))
		)
			return;
		setUnit(next);
	}

	if (editing) {
		return (
			<FormScreen
				primaryAction={{
					label: copy.save,
					onPress: save,
					loading: pending,
					disabled: pending || !isWebSocketConnected,
				}}
			>
				<ScreenHeader title={editing === "new" ? copy.add : copy.edit} />
				{!isWebSocketConnected ? (
					<FormSection>
						<AppText variant="heading">{copy.offlineTitle}</AppText>
						<AppText variant="caption">{copy.offlineBody}</AppText>
					</FormSection>
				) : null}
				<FormSection footer={copy.formHelp}>
					<FormTextField
						label={copy.name}
						value={name}
						onChangeText={setName}
						maxLength={40}
						error={error}
					/>
					<InlineNumberFieldRow
						label={copy.amount}
						accessibilityLabel={copy.amount}
						value={amount}
						onChangeText={setAmount}
						keyboardType="decimal-pad"
						suffix={unit}
					/>
				</FormSection>
				<FormSection title={copy.unit}>
					<View style={styles.segmented}>
						<Segmented
							options={[
								{ value: "g", label: copy.grams },
								{ value: "ml", label: copy.millilitres },
							]}
							value={unit}
							onChange={(next) => void changeUnit(next as "g" | "ml")}
						/>
					</View>
				</FormSection>
				<TextAction
					label={copy.cancel}
					onPress={() => setEditing(undefined)}
					disabled={pending}
				/>
			</FormScreen>
		);
	}

	return (
		<ScrollView
			style={styles.root}
			contentContainerStyle={styles.content}
			contentInsetAdjustmentBehavior="automatic"
		>
			<ScreenHeader title={copy.title} />
			{!isWebSocketConnected ? (
				<View style={styles.offline}>
					<AppText variant="heading">{copy.offlineTitle}</AppText>
					<AppText variant="caption">{copy.offlineBody}</AppText>
				</View>
			) : null}
			{measureActions.loading && isWebSocketConnected ? (
				<SkeletonGroup label={copy.loading}>
					<SkeletonBlock height={64} />
					<SkeletonBlock height={64} />
				</SkeletonGroup>
			) : localMeasures.length === 0 ? (
				<EmptyState
					title={copy.emptyTitle}
					body={copy.emptyBody}
					action={
						isWebSocketConnected
							? { label: copy.add, onPress: () => beginEdit() }
							: undefined
					}
				/>
			) : (
				<FormSection footer={copy.compatibilityHelp}>
					{localMeasures.map((measure, index) => (
						<View key={measure.id}>
							<EditableValueRow
								label={measure.name}
								value={`${formatQuantity(measure.amount, locale)} ${measure.unit}`}
								deleteLabel={isWebSocketConnected ? copy.delete : undefined}
								deleteAccessibilityLabel={`${copy.delete} ${measure.name}`}
								disabled={pending || !isWebSocketConnected}
								onPress={() => beginEdit(measure)}
								onDelete={
									isWebSocketConnected ? () => remove(measure) : undefined
								}
							/>
							{isWebSocketConnected && localMeasures.length > 1 ? (
								<InlineActionRow>
									<TextAction
										label={copy.moveUp}
										disabled={pending || index === 0}
										onPress={() => move(index, -1)}
									/>
									<TextAction
										label={copy.moveDown}
										disabled={pending || index === localMeasures.length - 1}
										onPress={() => move(index, 1)}
									/>
								</InlineActionRow>
							) : null}
						</View>
					))}
				</FormSection>
			)}
			{isWebSocketConnected && localMeasures.length > 0 ? (
				<TextAction
					label={copy.add}
					onPress={() => beginEdit()}
					disabled={pending}
				/>
			) : null}
		</ScrollView>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		root: { flex: 1, backgroundColor: colors.bg },
		content: {
			alignSelf: "center",
			width: "100%",
			maxWidth: 640,
			padding: metrics.screenGutter,
			gap: metrics.sectionGap,
		},
		offline: { gap: spacing.xs },
		segmented: { padding: spacing.md },
	});
