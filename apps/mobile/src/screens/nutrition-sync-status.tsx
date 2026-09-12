import { View } from "react-native";
import {
	useNutritionOperations,
	useNutritionOperationVersion,
} from "../data/nutrition-operation-service";
import { useI18n } from "../i18n";
import { GhostButton } from "../ui/button";
import { AppText } from "../ui/text";

export function NutritionSyncStatus() {
	const service = useNutritionOperations();
	useNutritionOperationVersion();
	const { locale } = useI18n();
	const subject = service.getSubject();
	const operations = subject
		? service
				.getOperations(subject)
				.filter((operation) => operation.status !== "acknowledged")
		: [];
	if (!subject || !operations.length) return null;
	const failed = operations.filter(
		(operation) => operation.status === "needs-attention",
	);
	return (
		<View accessibilityLiveRegion="polite">
			<AppText variant="caption">
				{locale === "nl"
					? `${operations.length} wijzigingen op dit apparaat; wachten op synchronisatie.`
					: `${operations.length} changes saved on this device; waiting to sync.`}
			</AppText>
			{failed.length > 0 ? (
				<>
					<AppText variant="caption">
						{locale === "nl"
							? "Sommige wijzigingen hebben aandacht nodig. Je gegevens blijven op dit apparaat."
							: "Some changes need attention. Your data remains on this device."}
					</AppText>
					{failed.map((operation) => (
						<AppText key={operation.operationId} variant="caption">
							{operation.lastError}
						</AppText>
					))}
				</>
			) : null}
			<GhostButton
				label={
					locale === "nl" ? "Synchronisatie opnieuw proberen" : "Retry sync"
				}
				onPress={() => {
					for (const operation of operations)
						if (operation.status !== "sending")
							service.retry(subject, operation.operationId);
				}}
			/>
		</View>
	);
}
