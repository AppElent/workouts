import { type Muscle, muscleKey } from "@foundry/core";
import { fmt, useMessages } from "#/lib/i18n";

export const MUSCLE_ICON_KEYS = [
	"abs",
	"arms",
	"back",
	"calves",
	"chest",
	"forearms",
	"fullBody",
	"glutes",
	"hamstrings",
	"lowerBack",
	"neck",
	"quadriceps",
	"serratus",
	"shoulders",
	"traps",
] as const;
export type MuscleIconKey = (typeof MUSCLE_ICON_KEYS)[number];

interface Props {
	muscleGroups: string[];
	size?: "sm" | "md";
}

type MuscleIcon = {
	key: MuscleIconKey;
	src: string;
};

const DIMS = {
	sm: { tile: 86, image: 76 },
	md: { tile: 118, image: 108 },
};

const ICONS: Record<string, MuscleIcon> = {
	abs: { key: "abs", src: "/muscle-icons/abs.png" },
	arms: { key: "arms", src: "/muscle-icons/arms.png" },
	back: { key: "back", src: "/muscle-icons/back.png" },
	calves: { key: "calves", src: "/muscle-icons/calves.png" },
	chest: { key: "chest", src: "/muscle-icons/chest.png" },
	forearms: {
		key: "forearms",
		src: "/muscle-icons/forearms.png",
	},
	"full body": {
		key: "fullBody",
		src: "/muscle-icons/full-body.png",
	},
	glutes: { key: "glutes", src: "/muscle-icons/glutes.png" },
	hamstrings: {
		key: "hamstrings",
		src: "/muscle-icons/hamstrings.png",
	},
	"lower back": {
		key: "lowerBack",
		src: "/muscle-icons/lower-back.png",
	},
	neck: { key: "neck", src: "/muscle-icons/neck.png" },
	quadriceps: {
		key: "quadriceps",
		src: "/muscle-icons/quadriceps.png",
	},
	serratus: {
		key: "serratus",
		src: "/muscle-icons/serratus.png",
	},
	shoulders: {
		key: "shoulders",
		src: "/muscle-icons/shoulders.png",
	},
	traps: { key: "traps", src: "/muscle-icons/traps.png" },
};

/** The icon for each muscle of the catalog vocabulary. */
const MUSCLE_TO_ICON: Record<Muscle, string> = {
	abductors: "glutes",
	abs: "abs",
	adductors: "quadriceps",
	arms: "arms",
	back: "back",
	biceps: "arms",
	calves: "calves",
	chest: "chest",
	core: "abs",
	forearms: "forearms",
	frontDelts: "shoulders",
	fullBody: "full body",
	glutes: "glutes",
	hamstrings: "hamstrings",
	lats: "back",
	lowerBack: "lower back",
	neck: "neck",
	obliques: "abs",
	quadriceps: "quadriceps",
	rearDelts: "shoulders",
	serratus: "serratus",
	shoulders: "shoulders",
	sideDelts: "shoulders",
	traps: "traps",
	triceps: "arms",
};

function resolveIcons(muscleGroups: string[]) {
	const keys = muscleGroups
		.map((group) => muscleKey(group))
		.filter((muscle) => muscle !== undefined)
		.map((muscle) => MUSCLE_TO_ICON[muscle]);

	const resolved = keys.includes("full body") ? ["full body"] : keys;
	const unique = [...new Set(resolved)];
	return unique.map((key) => ICONS[key]).filter(Boolean);
}

export function MuscleMap({ muscleGroups, size = "sm" }: Props) {
	const t = useMessages().exercise.muscleMap;
	const dims = DIMS[size];
	const icons = resolveIcons(muscleGroups);
	const visibleIcons = icons.length > 0 ? icons : [ICONS["full body"]];

	return (
		<fieldset className="flex flex-wrap justify-center gap-3 border-0 p-0">
			<legend className="sr-only">{t.legend}</legend>
			{visibleIcons.map((icon) => {
				const label = t.muscles[icon.key];
				return (
					<div key={icon.key} className="flex flex-col items-center gap-1.5">
						<div
							className="flex items-center justify-center rounded-lg border border-border bg-surface-2 shadow-card"
							style={{ width: dims.tile, height: dims.tile }}
						>
							<img
								src={icon.src}
								alt={fmt(t.alt, { muscle: label })}
								width={dims.image}
								height={dims.image}
								className="block object-contain"
								loading="lazy"
								decoding="async"
							/>
						</div>
						<span className="text-micro tracking-widest text-text-muted uppercase">
							{label}
						</span>
					</div>
				);
			})}
		</fieldset>
	);
}
