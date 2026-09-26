import { useMutation } from "convex/react";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
	Pressable,
	ScrollView,
	StyleSheet,
	TextInput,
	View,
} from "react-native";
import { api, type Id } from "../convex/api";
import { useRoutines } from "../data/session-data";
import { useI18n } from "../i18n";
import {
	type SportKey,
	type Tokens,
	useSportMeta,
	useThemedStyles,
	useTokens,
} from "../theme";
import { Eyebrow, SportIcon } from "../ui/coach";
import { convexErrorMessage } from "../ui/confirm-dialog";
import { ScreenHeader } from "../ui/screen-header";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";
import { activityCopy } from "./activity-copy";

export function StartActivityScreen() {
	const sportMeta = useSportMeta();
	const colors = useTokens();
	const styles = useThemedStyles(createStyles);
	const router = useRouter();
	const { locale } = useI18n();
	const copy = activityCopy(locale);
	const routines = useRoutines();
	const toast = useToast();
	const createSession = useMutation(api.workoutSessions.create);
	const startFromRoutine = useMutation(api.routines.startSession);

	const [name, setName] = useState("");
	/** Which button is mid-flight, so only that one shows a pending state. */
	const [busy, setBusy] = useState<string | null>(null);

	const pick = (key: SportKey) => {
		if (key === "strength") {
			void startFree();
			return;
		}
		if (key === "wod") {
			router.push("/wods");
			return;
		}
		router.push({ pathname: "/endurance-editor", params: { sport: key } });
	};

	/**
	 * The backend allows one active session at a time and throws otherwise. That
	 * is not an error worth a red toast — the user asked to start training and
	 * they already are — so land them on the session they forgot about.
	 */
	const handleStartError = (error: unknown) => {
		const message = convexErrorMessage(error, "Could not start the session.");
		if (message.toLowerCase().includes("already active")) {
			router.replace("/session");
			return;
		}
		toast.error(message);
	};

	const startFree = async () => {
		if (busy) return;
		setBusy("free");
		try {
			const id = await createSession({
				name: name.trim() === "" ? undefined : name.trim(),
			});
			setName("");
			router.replace({ pathname: "/session", params: { id } });
		} catch (error) {
			handleStartError(error);
		} finally {
			setBusy(null);
		}
	};

	const startRoutine = async (routineId: Id<"routines">) => {
		if (busy) return;
		setBusy(routineId);
		try {
			const id = await startFromRoutine({ routineId });
			router.replace({ pathname: "/session", params: { id } });
		} catch (error) {
			handleStartError(error);
		} finally {
			setBusy(null);
		}
	};

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
			<ScreenHeader title={copy.startActivity} />

			<View style={styles.grid}>
				{(Object.keys(sportMeta) as SportKey[]).map((key) => (
					<Pressable
						key={key}
						onPress={() => pick(key)}
						accessibilityRole="button"
						accessibilityLabel={
							key === "running"
								? copy.logRun
								: key === "cycling"
									? copy.logRide
									: sportMeta[key].label
						}
						disabled={busy !== null}
						style={[
							styles.tile,
							{ backgroundColor: sportMeta[key].dim },
							busy !== null && styles.dimmed,
						]}
					>
						<SportIcon sport={key} size={32} />
						<AppText style={styles.tileLabel}>
							{key === "wod" ? "WOD" : copy[key]}
						</AppText>
						<AppText style={styles.tileSub}>
							{key === "running"
								? copy.logRun
								: key === "cycling"
									? copy.logRide
									: key === "wod"
										? locale === "nl"
											? "WOD bekijken"
											: "Browse WODs"
										: locale === "nl"
											? "Sets en herhalingen"
											: "Log sets & reps"}
						</AppText>
					</Pressable>
				))}
			</View>

			<Eyebrow>Name this session (optional)</Eyebrow>
			<TextInput
				value={name}
				onChangeText={setName}
				placeholder="Push day"
				placeholderTextColor={colors.textFaint}
				style={styles.input}
				returnKeyType="go"
				onSubmitEditing={() => void startFree()}
			/>

			<Eyebrow>Routines</Eyebrow>
			{routines === undefined ? (
				<AppText style={styles.muted}>Loading…</AppText>
			) : routines.length === 0 ? (
				<AppText style={styles.muted}>
					No routines yet — a free session works fine without one.
				</AppText>
			) : (
				<View style={styles.list}>
					{routines.map((r) => (
						<Pressable
							key={r._id}
							onPress={() => void startRoutine(r._id)}
							disabled={busy !== null}
							style={[styles.row, busy !== null && styles.dimmed]}
						>
							<SportIcon sport="strength" size={40} />
							<View style={styles.flex}>
								<AppText style={styles.rowTitle}>{r.name}</AppText>
								<AppText style={styles.rowSub}>
									{busy === r._id
										? "Starting…"
										: `${r.exercises.length} exercise${r.exercises.length === 1 ? "" : "s"}`}
								</AppText>
							</View>
							<AppText style={styles.chevron}>›</AppText>
						</Pressable>
					))}
				</View>
			)}
		</ScrollView>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		root: { flex: 1, backgroundColor: colors.bg },
		content: { padding: 20, paddingTop: 12, gap: 14, paddingBottom: 80 },
		header: { flexDirection: "row", alignItems: "center", gap: 10 },
		back: {
			width: 32,
			height: 32,
			borderRadius: 9999,
			backgroundColor: colors.surface2,
			alignItems: "center",
			justifyContent: "center",
		},
		backText: { fontSize: 18, fontWeight: "800", color: colors.text },
		h1: { fontSize: 17, fontWeight: "800", color: colors.text },
		grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
		tile: { width: "48%", borderRadius: 14, padding: 12, gap: 6 },
		tileLabel: { fontSize: 15, fontWeight: "800", color: colors.text },
		tileSub: { fontSize: 10, color: colors.textMuted },
		dimmed: { opacity: 0.5 },
		input: {
			minHeight: 48,
			borderRadius: 14,
			paddingHorizontal: 14,
			backgroundColor: colors.surface,
			borderWidth: 1,
			borderColor: colors.border,
			color: colors.text,
			fontSize: 15,
		},
		muted: { fontSize: 13, color: colors.textMuted },
		list: { gap: 6 },
		flex: { flex: 1, gap: 2 },
		row: {
			flexDirection: "row",
			alignItems: "center",
			gap: 12,
			backgroundColor: colors.surface,
			borderRadius: 14,
			padding: 10,
		},
		rowTitle: { fontSize: 14, fontWeight: "700", color: colors.text },
		rowSub: { fontSize: 11, color: colors.textMuted },
		chevron: { fontSize: 18, color: colors.textFaint },
	});
