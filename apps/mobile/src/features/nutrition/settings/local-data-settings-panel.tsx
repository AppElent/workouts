import { useConvexConnectionState } from "convex/react";
import { useState } from "react";
import { usePersonalFoods } from "../../../data/personal-foods";
import { useI18n } from "../../../i18n";
import { spacing } from "../../../theme";
import { PrimaryButton } from "../../../ui/button";
import { GroupedSurface, TextAction } from "../../../ui/form";
import { AppText } from "../../../ui/text";
import { useLocalDataCleanup } from "../../local-data/account-data-maintenance-provider";

export function LocalDataSettingsPanel() {
	const { locale } = useI18n();
	const foods = usePersonalFoods();
	const clearCache = useLocalDataCleanup();
	const online = useConvexConnectionState().isWebSocketConnected;
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string>();
	const nl = locale === "nl";
	return (
		<GroupedSurface style={{ gap: spacing.sm }}>
			<AppText variant="heading">
				{nl ? "Foto’s en cache" : "Photos and cache"}
			</AppText>
			<AppText variant="caption">
				{nl
					? "Je opgeslagen gegevens staan in je account. Eigen foto’s staan in Convex; Open Food Facts-foto’s worden vanaf de bron geladen en op dit apparaat gecachet."
					: "Your saved data belongs to your account. Your own photos use Convex storage; Open Food Facts photos load from their source and are cached on this device."}
			</AppText>
			{foods.account.devicePhotoCount > 0 ? (
				<>
					<AppText>
						{nl
							? `${foods.account.devicePhotoCount} apparaatfoto’s moeten nog worden geüpload.`
							: `${foods.account.devicePhotoCount} device photos still need uploading.`}
					</AppText>
					<PrimaryButton
						label={nl ? "Apparaatfoto’s uploaden" : "Upload device photos"}
						loading={busy}
						disabled={!online || busy}
						onPress={() => {
							if (busy) return;
							setBusy(true);
							setError(undefined);
							void foods.account
								.uploadDevicePhotos()
								.catch((e: unknown) =>
									setError(e instanceof Error ? e.message : String(e)),
								)
								.finally(() => setBusy(false));
						}}
					/>
				</>
			) : null}
			{error ? <AppText accessibilityRole="alert">{error}</AppText> : null}
			<TextAction
				label={nl ? "Accountcache wissen" : "Clear cached account data"}
				disabled={!online || busy || foods.account.devicePhotoCount > 0}
				onPress={clearCache}
			/>
			<AppText variant="caption">
				{nl
					? "Voorkeuren, laatst gebruikte porties en onafgemaakte Setconcepten blijven bewaard. Accountgegevens worden opnieuw geladen."
					: "Preferences, last-used portions and unfinished Set Drafts remain. Account data reloads from Convex."}
			</AppText>
		</GroupedSurface>
	);
}
