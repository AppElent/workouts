/**
 * The Start Activity picker — the app's primary CTA per ADR-0002, a type
 * picker rather than a privileged "Start Workout" button. Laid out from
 * `designs/shell/index.html#flows`.
 *
 * Only Strength goes anywhere; it is the only type with a logging screen. The
 * other three stay visible so the picker reads as multi-sport, but pressing one
 * says so in a caption rather than faking navigation to a screen that does not
 * exist. `sportMeta[key].implemented` is the single switch.
 *
 * Both real paths — a free session and a routine — create the session *here*
 * and push the log screen with its id, mirroring `src/routes/log/index.tsx`.
 * The log screen never creates anything, so there is exactly one place a
 * session can come into existence.
 */
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
import { colors, type SportKey, sportMeta } from "../theme";
import { Eyebrow, SportIcon } from "../ui/coach";
import { convexErrorMessage } from "../ui/confirm-dialog";
import { AppText } from "../ui/text";
import { useToast } from "../ui/toast";

export function StartActivityScreen() {
	const router = useRouter();
	const routines = useRoutines();
	const toast = useToast();
	const createSession = useMutation(api.workoutSessions.create);
	const startFromRoutine = useMutation(api.routines.startSession);

	const [pickedStub, setPickedStub] = useState<SportKey | null>(null);
	const [name, setName] = useState("");
	/** Which button is mid-flight, so only that one shows a pending state. */
	const [busy, setBusy] = useState<string | null>(null);

	const pick = (key: SportKey) => {
		if (sportMeta[key].implemented) {
			void startFree();
			return;
		}
		// WOD is a half-case: there is no WOD *activity type* — no envelope, no
		// logging screen — but the WOD library and its scores are real, and that
		// is what someone tapping this tile is after. Sending them there beats a
		// note explaining that the thing they can see elsewhere doesn't exist.
		if (key === "wod") {
			router.push("/wods");
			return;
		}
		setPickedStub(key);
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
			style={styles.root}
			contentContainerStyle={styles.content}
			showsVerticalScrollIndicator={false}
			keyboardShouldPersistTaps="handled"
		>
			<View style={styles.header}>
				<Pressable
					onPress={() => router.back()}
					hitSlop={12}
					style={styles.back}
					accessibilityRole="button"
					accessibilityLabel="Go back"
				>
					<AppText style={styles.backText}>‹</AppText>
				</Pressable>
				<AppText style={styles.h1}>Start activity</AppText>
			</View>

			<View style={styles.grid}>
				{(Object.keys(sportMeta) as SportKey[]).map((key) => (
					<Pressable
						key={key}
						onPress={() => pick(key)}
						disabled={busy !== null}
						style={[
							styles.tile,
							{ backgroundColor: sportMeta[key].dim },
							busy !== null && styles.dimmed,
						]}
					>
						<SportIcon sport={key} size={32} />
						<AppText style={styles.tileLabel}>{sportMeta[key].label}</AppText>
						<AppText style={styles.tileSub}>
							{key === "strength" ? "Log sets & reps" : "Distance & pace"}
						</AppText>
					</Pressable>
				))}
			</View>

			{pickedStub ? (
				<View style={styles.stubNote}>
					<AppText style={styles.stubNoteText}>
						{sportMeta[pickedStub].label} logging doesn't exist yet — strength
						is the only activity type with a backend so far (ADR-0002). The
						picker is built for four so adding one is a screen, not a redesign.
					</AppText>
				</View>
			) : null}

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

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	content: { padding: 20, paddingTop: 12, gap: 14, paddingBottom: 80 },
	header: { flexDirection: "row", alignItems: "center", gap: 10 },
	back: {
		width: 32,
		height: 32,
		borderRadius: 9999,
		backgroundColor: "rgba(255,255,255,0.08)",
		alignItems: "center",
		justifyContent: "center",
	},
	backText: { fontSize: 18, fontWeight: "800", color: colors.text },
	h1: { fontSize: 17, fontWeight: "800", color: colors.text },
	grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
	tile: { width: "48%", borderRadius: 14, padding: 12, gap: 6 },
	tileLabel: { fontSize: 15, fontWeight: "800", color: colors.text },
	tileSub: { fontSize: 10, color: colors.textMuted },
	stubNote: {
		backgroundColor: colors.surface2,
		borderRadius: 12,
		padding: 12,
	},
	stubNoteText: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
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
