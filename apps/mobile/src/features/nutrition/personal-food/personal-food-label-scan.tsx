import { NUTRIENT_KEYS, type NutrientKey } from "@foundry/core/nutrition";
import { SymbolView } from "expo-symbols";
import { useEffect, useRef, useState } from "react";
import {
	ActivityIndicator,
	Modal,
	Pressable,
	ScrollView,
	View,
} from "react-native";
import {
	type LabelCheck,
	labelChecks,
	prepareImage,
} from "../../../data/nutrition-ai";
import {
	modalAnimation,
	useReduceMotion,
} from "../../../feedback/reduce-motion";
import { fmt, localizeDecimal, plural, useI18n } from "../../../i18n";
import { spacing, useTokens } from "../../../theme";
import { AppText } from "../../../ui/text";
import { useToast } from "../../../ui/toast";
import { FoodFormCard } from "../components/food-form-section";
import { FoodPhotoCamera } from "../components/food-photo-camera";
import { NutritionAiConsent } from "../components/nutrition-ai-consent";
import { nutritionAiFailure, useNutritionAi } from "../use-nutrition-ai";
import type { PersonalFoodDraftState } from "./use-personal-food-draft";

type Outcome = {
	readonly filled: readonly NutrientKey[];
	readonly differences: readonly { key: NutrientKey; label: number }[];
	readonly checks: readonly LabelCheck[];
};

/**
 * "Etiket scannen" in the food editor: one full-width row above Voedingswaarde
 * (designs/nutrition/ai-entry_final.html). `missing` serves an incomplete
 * provider product: only absent values are filled.
 */
export function PersonalFoodLabelScan({
	draft,
	mode,
	openOnMount = false,
}: {
	draft: PersonalFoodDraftState;
	mode: "fill" | "missing";
	openOnMount?: boolean;
}) {
	const { t, locale } = useI18n();
	const copy = t.nutrition.assistance;
	const colors = useTokens();
	const toast = useToast();
	const reduceMotion = useReduceMotion();
	const ai = useNutritionAi();
	const [stage, setStage] = useState<"idle" | "consent" | "camera" | "reading">(
		"idle",
	);
	const [outcome, setOutcome] = useState<Outcome>();
	const opened = useRef(false);

	const start = () => setStage(ai.consented ? "camera" : "consent");
	// biome-ignore lint/correctness/useExhaustiveDependencies: once, on arrival
	useEffect(() => {
		if (!openOnMount || opened.current) return;
		opened.current = true;
		start();
	}, []);

	async function read(uri: string) {
		setStage("reading");
		try {
			if (!ai.online) throw new Error("offline");
			const image = await prepareImage(uri);
			const reading = await ai.readLabel({ image, locale });
			if (!reading.isLabel) {
				toast.error(copy.notALabel);
				return;
			}
			const applied = draft.applyLabel(reading, mode);
			setOutcome({ ...applied, checks: labelChecks(reading) });
		} catch (error) {
			const failure =
				error instanceof Error && error.message === "offline"
					? "offline"
					: nutritionAiFailure(error);
			toast.error(
				failure === "offline"
					? copy.offlineHelpBody
					: failure === "limit"
						? fmt(copy.limitTitle, { count: 50 })
						: copy[failure],
			);
		} finally {
			setStage("idle");
		}
	}

	const missing = NUTRIENT_KEYS.filter(
		(key) => draft.nutrients[key].kind === "absent",
	).length;
	const reading = stage === "reading";
	const label = reading
		? copy.scanningLabel
		: outcome
			? copy.rescanLabel
			: copy.scanLabel;
	const warnings = outcome
		? [
				...outcome.checks.map((check) => copy[check]),
				...(outcome.differences.length
					? [
							fmt(copy.differs, {
								list: outcome.differences
									.map((d) =>
										fmt(copy.labelValue, {
											nutrient: t.nutrition.nutrients[d.key],
											value: localizeDecimal(String(d.label), locale),
										}),
									)
									.join(", "),
							}),
						]
					: []),
			]
		: [];

	return (
		<View style={{ gap: spacing.xs, marginTop: spacing.md }}>
			{mode === "missing" && !outcome && missing > 0 ? (
				<Notice
					tone="warn"
					title={plural(locale, missing, copy.missingTitle)}
					body={copy.missingBody}
				/>
			) : null}
			{outcome ? (
				<Notice
					tone={warnings.length ? "warn" : "ok"}
					title={
						mode === "missing"
							? plural(locale, outcome.filled.length, copy.filledMissing)
							: warnings.length
								? copy.checksTitle
								: copy.labelFilledTitle
					}
					body={warnings.length ? warnings.join(" ") : copy.labelFilledBody}
				/>
			) : null}
			<FoodFormCard>
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={label}
					accessibilityState={{ busy: reading, disabled: reading }}
					disabled={reading}
					onPress={start}
					style={{
						minHeight: 50,
						flexDirection: "row",
						alignItems: "center",
						justifyContent: "center",
						gap: spacing.sm,
					}}
				>
					{reading ? (
						<ActivityIndicator color={colors.accent} />
					) : (
						<SymbolView
							name={{
								ios: "camera",
								android: "photo_camera",
								web: "photo_camera",
							}}
							size={17}
							tintColor={colors.accent}
						/>
					)}
					<AppText
						variant="secondary"
						style={{ color: colors.accent, fontWeight: "600" }}
					>
						{label}
					</AppText>
				</Pressable>
			</FoodFormCard>
			<Modal
				visible={stage === "consent"}
				presentationStyle="formSheet"
				animationType={modalAnimation(reduceMotion, "slide")}
				onRequestClose={() => setStage("idle")}
			>
				<ScrollView
					style={{ backgroundColor: colors.bg }}
					contentContainerStyle={{ padding: spacing.md }}
				>
					<NutritionAiConsent
						onContinue={() => {
							ai.grantConsent();
							setStage("camera");
						}}
						onDecline={() => setStage("idle")}
					/>
				</ScrollView>
			</Modal>
			<Modal
				visible={stage === "camera"}
				presentationStyle="fullScreen"
				animationType={modalAnimation(reduceMotion, "slide")}
				onRequestClose={() => setStage("idle")}
			>
				<FoodPhotoCamera
					mode="label"
					onPhoto={(uri) => void read(uri)}
					onCancel={() => setStage("idle")}
				/>
			</Modal>
		</View>
	);
}

export function Notice({
	tone,
	title,
	body,
}: {
	tone: "ok" | "warn";
	title: string;
	body?: string;
}) {
	const colors = useTokens();
	return (
		<View
			accessibilityRole={tone === "warn" ? "alert" : undefined}
			style={{
				flexDirection: "row",
				gap: spacing.sm,
				padding: spacing.md,
				borderRadius: 14,
				backgroundColor: tone === "warn" ? colors.warnSoft : colors.accentDim,
			}}
		>
			<SymbolView
				name={
					tone === "warn"
						? {
								ios: "exclamationmark.triangle",
								android: "warning",
								web: "warning",
							}
						: {
								ios: "checkmark.circle",
								android: "check_circle",
								web: "check_circle",
							}
				}
				size={17}
				tintColor={tone === "warn" ? colors.warn : colors.accent}
			/>
			<View style={{ flex: 1, gap: 2 }}>
				<AppText
					variant="secondary"
					style={{ color: colors.text, fontWeight: "600" }}
				>
					{title}
				</AppText>
				{body ? <AppText variant="caption">{body}</AppText> : null}
			</View>
		</View>
	);
}
