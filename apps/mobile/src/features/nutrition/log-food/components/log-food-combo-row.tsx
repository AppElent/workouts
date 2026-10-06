import { LogFoodMediaSlot } from "./log-food-media-slot";
import { LogFoodRowLayout } from "./log-food-row-layout";

/** A Combo, on the same grid as a food: media slot, three lines, round +. */
export function LogFoodComboRow({
	name,
	caption,
	energy,
	portion,
	detailLabel,
	onDetail,
	logLabel,
	onLog,
}: {
	name: string;
	caption: string;
	energy?: string;
	portion?: string;
	detailLabel: string;
	onDetail: () => void;
	logLabel: string;
	onLog: () => void;
}) {
	return (
		<LogFoodRowLayout
			leading={
				<LogFoodMediaSlot
					symbol={{
						ios: "square.stack.3d.up",
						android: "layers",
						web: "layers",
					}}
				/>
			}
			title={name}
			caption={caption}
			energy={energy}
			portion={portion}
			rowLabel={detailLabel}
			onPress={onDetail}
			add={{ label: `${logLabel} ${name}`, onPress: onLog }}
		/>
	);
}
