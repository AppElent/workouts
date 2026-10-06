import { LogFoodMediaSlot } from "./log-food-media-slot";
import {
	LogFoodRowLayout,
	type LogFoodRowPosition,
} from "./log-food-row-layout";

/** A Combo, on the same grid as a food: tile, name over parts, kcal, round +. */
export function LogFoodComboRow({
	name,
	caption,
	energy,
	portion,
	position,
	detailLabel,
	onDetail,
	logLabel,
	onLog,
}: {
	name: string;
	caption: string;
	energy?: string;
	portion?: string;
	position: LogFoodRowPosition;
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
			value={energy}
			portion={portion}
			position={position}
			rowLabel={detailLabel}
			onPress={onDetail}
			add={{ label: `${logLabel} ${name}`, onPress: onLog }}
		/>
	);
}
