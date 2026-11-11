import { type ActivitySummary, formatClock } from "@foundry/core";
import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { dateLocale, useI18n } from "../../../i18n";
import { useTokens } from "../../../theme";
import { SportIcon } from "../../../ui/coach";
import { AppText } from "../../../ui/text";
import {
	formatEnduranceRate,
	formatKilometers,
} from "../endurance/endurance-format";

export function ActivityRow({ item }: { item: ActivitySummary }) {
	const router = useRouter();
	const colors = useTokens();
	const { locale, t } = useI18n();
	const copy = t.activity;
	const title =
		item.title ||
		(item.sport === "running"
			? copy.run
			: item.sport === "cycling"
				? copy.ride
				: copy.session);
	return (
		<Pressable
			accessibilityRole="button"
			onPress={() =>
				item.sport === "strength"
					? router.push({ pathname: "/summary", params: { id: item.id } })
					: router.push({
							pathname: "/endurance/[id]",
							params: { id: item.id },
						})
			}
			style={{
				flexDirection: "row",
				alignItems: "center",
				gap: 12,
				padding: 16,
				backgroundColor: colors.surface,
				borderRadius: 14,
				borderCurve: "continuous",
			}}
		>
			<SportIcon sport={item.sport} size={36} />
			<View style={{ flex: 1, gap: 4 }}>
				<AppText variant="heading">{title}</AppText>
				<AppText variant="caption">
					{new Date(item.occurredAt).toLocaleDateString(dateLocale(locale), {
						day: "numeric",
						month: "short",
						year: "numeric",
					})}{" "}
					· {formatClock(item.durationSeconds)}
				</AppText>
				{item.distanceMeters !== undefined ? (
					<AppText variant="caption">
						{formatKilometers(item.distanceMeters, locale)} km ·{" "}
						{formatEnduranceRate(
							item.sport,
							item.distanceMeters,
							item.durationSeconds,
							locale,
						)}
					</AppText>
				) : null}
			</View>
		</Pressable>
	);
}
