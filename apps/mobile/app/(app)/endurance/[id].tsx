import { Stack, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet } from "react-native";
import type { Id } from "../../../src/convex/api";
import { useI18n } from "../../../src/i18n";
import { enduranceCopy } from "../../../src/screens/endurance-copy";
import { EnduranceDetailScreen } from "../../../src/screens/endurance-detail";
import {
	metrics,
	spacing,
	type Tokens,
	useThemedStyles,
} from "../../../src/theme";
import { EmptyState } from "../../../src/ui/empty-state";
import { RouteError } from "../../../src/ui/route-error";

export default function EnduranceDetailRoute() {
	const { id } = useLocalSearchParams<{ id?: string }>();
	const { locale } = useI18n();
	const copy = enduranceCopy[locale];
	const styles = useThemedStyles(createStyles);
	return (
		<>
			<Stack.Screen options={{ title: copy.details }} />
			{id ? (
				<EnduranceDetailScreen id={id as Id<"activities">} />
			) : (
				<ScrollView
					style={styles.root}
					contentInsetAdjustmentBehavior="automatic"
					contentContainerStyle={styles.content}
				>
					<EmptyState title={copy.missing} body={copy.missingBody} />
				</ScrollView>
			)}
		</>
	);
}

export function ErrorBoundary({
	error,
	retry,
}: {
	error: Error;
	retry: () => Promise<void>;
}) {
	const { locale } = useI18n();
	const copy = enduranceCopy[locale];
	return (
		<RouteError
			title={copy.missing}
			body={copy.missingBody}
			retryLabel={locale === "nl" ? "Opnieuw proberen" : "Retry"}
			onRetry={() => void retry()}
			error={error}
		/>
	);
}

const createStyles = (colors: Tokens) =>
	StyleSheet.create({
		root: { flex: 1, backgroundColor: colors.bg },
		content: {
			paddingHorizontal: metrics.screenGutter,
			paddingVertical: spacing.lg,
		},
	});
