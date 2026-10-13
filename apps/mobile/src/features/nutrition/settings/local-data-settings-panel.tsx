import { useConvexConnectionState } from "convex/react";
import { useState } from "react";
import { usePersonalFoods } from "../../../data/personal-foods";
import { plural, useI18n } from "../../../i18n";
import { spacing } from "../../../theme";
import { PrimaryButton } from "../../../ui/button";
import { GroupedSurface, TextAction } from "../../../ui/form";
import { AppText } from "../../../ui/text";
import { useLocalDataCleanup } from "../../local-data/account-data-maintenance-provider";

export function LocalDataSettingsPanel() {
	const { locale, t } = useI18n();
	const copy = t.localData.settings;
	const foods = usePersonalFoods();
	const clearCache = useLocalDataCleanup();
	const online = useConvexConnectionState().isWebSocketConnected;
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string>();

	return (
		<GroupedSurface style={{ gap: spacing.sm }}>
			<AppText variant="heading">{copy.title}</AppText>
			<AppText variant="caption">{copy.body}</AppText>
			{foods.account.devicePhotoCount > 0 ? (
				<>
					<AppText>
						{plural(locale, foods.account.devicePhotoCount, copy.pendingPhotos)}
					</AppText>
					<PrimaryButton
						label={copy.uploadPhotos}
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
				label={copy.clearCache}
				disabled={!online || busy || foods.account.devicePhotoCount > 0}
				onPress={clearCache}
			/>
			<AppText variant="caption">{copy.clearCacheNote}</AppText>
		</GroupedSurface>
	);
}
