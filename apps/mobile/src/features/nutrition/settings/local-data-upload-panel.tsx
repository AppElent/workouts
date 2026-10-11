import { useConvexConnectionState } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { useNutritionDrafts } from "../../../data/nutrition-drafts";
import {
	useNutritionOperations,
	useNutritionOperationVersion,
} from "../../../data/nutrition-operation-service";
import { usePersonalFoods } from "../../../data/personal-foods";
import { useI18n } from "../../../i18n";
import { spacing } from "../../../theme";
import { PrimaryButton } from "../../../ui/button";
import { GroupedSurface } from "../../../ui/form";
import { AppText } from "../../../ui/text";

const copy = {
	en: {
		title: "Local data",
		help: "Upload saved Foods, Combos, notes and pending diary changes from this device to your signed-in account. Already uploaded records are skipped. Originals stay on this device.",
		device: "This device has a library that can be added to your account.",
		pending: (library: number, notes: number, diary: number) =>
			`${library} library changes · ${notes} saved notes · ${diary} diary changes waiting to upload`,
		upload: "Upload local data",
		uploading: "Uploading local data…",
		done: "All eligible local data has been acknowledged by your account. There are no remaining uploads.",
		failure:
			"Some data could not be uploaded. Originals are still on this device. Reconnect and retry.",
		offline: "Connect to upload local data.",
		limits:
			"Training and other saved account data are already online. Device preferences, Food photos and unfinished editor input stay on this device.",
	},
	nl: {
		title: "Lokale gegevens",
		help: "Upload opgeslagen voedingsmiddelen, Combo's, notities en wachtende dagboekwijzigingen van dit apparaat naar je ingelogde account. Al geüploade gegevens worden overgeslagen. Originelen blijven op dit apparaat.",
		device:
			"Dit apparaat heeft een bibliotheek die aan je account kan worden toegevoegd.",
		pending: (library: number, notes: number, diary: number) =>
			`${library} bibliotheekwijzigingen · ${notes} opgeslagen notities · ${diary} dagboekwijzigingen wachten op upload`,
		upload: "Lokale gegevens uploaden",
		uploading: "Lokale gegevens uploaden…",
		done: "Alle uploadbare lokale gegevens zijn door je account bevestigd. Er zijn geen resterende uploads.",
		failure:
			"Sommige gegevens konden niet worden geüpload. Originelen staan nog op dit apparaat. Herstel de verbinding en probeer opnieuw.",
		offline: "Maak verbinding om lokale gegevens te uploaden.",
		limits:
			"Trainingen en andere opgeslagen accountgegevens staan al online. Apparaatvoorkeuren, voedingsfoto's en onafgemaakte invoer blijven op dit apparaat.",
	},
};

export function LocalDataUploadPanel() {
	const { locale } = useI18n();
	const c = copy[locale];
	const foods = usePersonalFoods();
	const drafts = useNutritionDrafts();
	const operations = useNutritionOperations();
	useNutritionOperationVersion();
	const subject = foods.account.subject;
	const online = useConvexConnectionState().isWebSocketConnected;
	const [busy, setBusy] = useState(false);
	const [result, setResult] = useState<"done" | "failed">();
	const [error, setError] = useState<string>();
	const pending = useRef(false);
	const mounted = useRef(true);
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
		};
	}, []);
	const diary = subject
		? operations
				.getOperations(subject)
				.filter((operation) => operation.status !== "acknowledged").length
		: 0;
	const remaining =
		foods.account.operations.length + drafts.pendingMigrationCount + diary;
	async function upload() {
		if (pending.current || !online || !subject) return;
		pending.current = true;
		setBusy(true);
		setResult(undefined);
		setError(undefined);
		try {
			const uploadLibrary = async () => {
				if (foods.account.hasLegacy) foods.account.importLegacy();
				await foods.account.uploadPending();
			};
			const results = await Promise.allSettled([
				uploadLibrary(),
				drafts.uploadPending(),
				operations.uploadPending(subject),
			]);
			if (!mounted.current || operations.getSubject() !== subject) return;
			const failed = results.find((entry) => entry.status === "rejected");
			if (failed?.status === "rejected") throw failed.reason;
			setResult("done");
		} catch (error) {
			if (mounted.current) {
				setResult("failed");
				setError(error instanceof Error ? error.message : String(error));
			}
		} finally {
			pending.current = false;
			if (mounted.current) setBusy(false);
		}
	}
	return (
		<GroupedSurface style={{ gap: spacing.sm }}>
			<AppText variant="heading">{c.title}</AppText>
			<AppText variant="caption">{c.help}</AppText>
			{foods.account.hasLegacy ? <AppText>{c.device}</AppText> : null}
			<View accessibilityLiveRegion="polite" style={{ gap: spacing.xs }}>
				<AppText variant="caption">
					{c.pending(
						foods.account.operations.length,
						drafts.pendingMigrationCount,
						diary,
					)}
				</AppText>
				{result === "done" && !remaining && !foods.account.hasLegacy ? (
					<AppText>{c.done}</AppText>
				) : null}
				{result === "failed" ? (
					<>
						<AppText>{c.failure}</AppText>
						<AppText selectable variant="caption">
							{error}
						</AppText>
					</>
				) : null}
			</View>
			{!online ? <AppText>{c.offline}</AppText> : null}
			<PrimaryButton
				label={busy ? c.uploading : c.upload}
				loading={busy}
				disabled={!online || !subject}
				onPress={() => void upload()}
			/>
			<AppText variant="caption">{c.limits}</AppText>
		</GroupedSurface>
	);
}
