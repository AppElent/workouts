import {
	FoodRowLayout,
	type FoodRowPosition,
} from "../../components/food-row-layout";
import { LogFoodMediaSlot } from "./log-food-media-slot";

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
	position: FoodRowPosition;
	detailLabel: string;
	onDetail: () => void;
	logLabel: string;
	onLog: () => void;
}) {
	return (
		<FoodRowLayout
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
