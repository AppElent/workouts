import type {
	FoodVisual,
	FoodVisualPresetId,
	ShippedFood,
} from "@foundry/core";

const SHIPPED_EMOJI_VISUALS: Readonly<Record<string, FoodVisualPresetId>> = {
	"🍎": "fruit",
	"🍇": "fruit",
	"🍓": "fruit",
	"🍍": "fruit",
	"🍌": "fruit",
	"🫐": "fruit",
	"🍋": "fruit",
	"🍒": "fruit",
	"🍑": "fruit",
	"🍊": "fruit",
	"🥬": "vegetable",
	"🍄": "vegetable",
	"🍅": "vegetable",
	"🧅": "vegetable",
	"🥕": "vegetable",
	"🍞": "grains",
	"🍚": "grains",
	"🍝": "grains",
	"🥣": "grains",
	"🍘": "grains",
	"🥛": "dairy",
	"🍮": "dairy",
	"🥚": "egg",
	"🥩": "meat",
	"🍗": "meat",
	"🌭": "meat",
	"🐟": "fish",
	"🍣": "fish",
	"🍰": "snack",
	"🍩": "snack",
	"🎂": "snack",
	"🍪": "snack",
	"🍨": "snack",
	"☕": "drink",
	"🧃": "drink",
	"🧈": "condiment",
	"🌻": "condiment",
};

export function foodVisualForShippedFood(
	food: Pick<ShippedFood, "emoji">,
): FoodVisual | undefined {
	const preset = food.emoji ? SHIPPED_EMOJI_VISUALS[food.emoji] : undefined;
	return preset ? { kind: "icon", preset } : undefined;
}
