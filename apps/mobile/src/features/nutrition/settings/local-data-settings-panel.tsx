import { useState } from "react";
import { useOnline } from "../../../convex/online";
import { usePersonalFoods } from "../../../data/personal-foods";
import { plural, useI18n } from "../../../i18n";
import { spacing } from "../../../theme";
import { PrimaryButton } from "../../../ui/button";
import { GroupedSurface } from "../../../ui/form";
import { AppText } from "../../../ui/text";
import { useWriteFailureMessage } from "../../../ui/use-screen-write";

export function LocalDataSettingsPanel() {
	const { locale, t } = useI18n();
	const copy = t.localData.settings;
	const foods = usePersonalFoods();
	const writeFailureMessage = useWriteFailureMessage();
	const online = useOnline();
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
									setError(writeFailureMessage(e, copy.uploadFailure)),
								)
								.finally(() => setBusy(false));
						}}
					/>
				</>
			) : null}
			{error ? <AppText accessibilityRole="alert">{error}</AppText> : null}
		</GroupedSurface>
	);
}
