interface Props {
	muscleGroups: string[];
	size?: "sm" | "md";
}

type MuscleIcon = {
	key: string;
	label: string;
	src: string;
};

const DIMS = {
	sm: { tile: 86, image: 76 },
	md: { tile: 118, image: 108 },
};

const ICONS: Record<string, MuscleIcon> = {
	abs: { key: "abs", label: "Abs", src: "/muscle-icons/abs.png" },
	arms: { key: "arms", label: "Arms", src: "/muscle-icons/arms.png" },
	back: { key: "back", label: "Back", src: "/muscle-icons/back.png" },
	calves: { key: "calves", label: "Calves", src: "/muscle-icons/calves.png" },
	chest: { key: "chest", label: "Chest", src: "/muscle-icons/chest.png" },
	forearms: {
		key: "forearms",
		label: "Forearms",
		src: "/muscle-icons/forearms.png",
	},
	"full body": {
		key: "full-body",
		label: "Full body",
		src: "/muscle-icons/full-body.png",
	},
	glutes: { key: "glutes", label: "Glutes", src: "/muscle-icons/glutes.png" },
	hamstrings: {
		key: "hamstrings",
		label: "Hamstrings",
		src: "/muscle-icons/hamstrings.png",
	},
	"lower back": {
		key: "lower-back",
		label: "Lower back",
		src: "/muscle-icons/lower-back.png",
	},
	neck: { key: "neck", label: "Neck", src: "/muscle-icons/neck.png" },
	quadriceps: {
		key: "quadriceps",
		label: "Quadriceps",
		src: "/muscle-icons/quadriceps.png",
	},
	serratus: {
		key: "serratus",
		label: "Serratus",
		src: "/muscle-icons/serratus.png",
	},
	shoulders: {
		key: "shoulders",
		label: "Shoulders",
		src: "/muscle-icons/shoulders.png",
	},
	traps: { key: "traps", label: "Traps", src: "/muscle-icons/traps.png" },
};

const GROUP_TO_ICON: Record<string, string> = {
	abs: "abs",
	abdominals: "abs",
	back: "back",
	biceps: "arms",
	calves: "calves",
	chest: "chest",
	core: "abs",
	forearms: "forearms",
	"front delts": "shoulders",
	"full body": "full body",
	glutes: "glutes",
	hamstrings: "hamstrings",
	lats: "back",
	"lower back": "lower back",
	neck: "neck",
	quads: "quadriceps",
	quadriceps: "quadriceps",
	"rear delts": "shoulders",
	serratus: "serratus",
	shoulders: "shoulders",
	"side delts": "shoulders",
	traps: "traps",
	triceps: "arms",
};

function resolveIcons(muscleGroups: string[]) {
	const keys = muscleGroups
		.map((group) => GROUP_TO_ICON[group.trim().toLowerCase()])
		.filter(Boolean);

	const resolved = keys.includes("full body") ? ["full body"] : keys;
	const unique = [...new Set(resolved)];
	return unique.map((key) => ICONS[key]).filter(Boolean);
}

export function MuscleMap({ muscleGroups, size = "sm" }: Props) {
	const dims = DIMS[size];
	const icons = resolveIcons(muscleGroups);
	const visibleIcons = icons.length > 0 ? icons : [ICONS["full body"]];

	return (
		<fieldset className="flex flex-wrap justify-center gap-3 border-0 p-0">
			<legend className="sr-only">Targeted muscle groups</legend>
			{visibleIcons.map((icon) => (
				<div key={icon.key} className="flex flex-col items-center gap-1.5">
					<div
						className="flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-2)] shadow-[var(--shadow-card)]"
						style={{ width: dims.tile, height: dims.tile }}
					>
						<img
							src={icon.src}
							alt={`${icon.label} muscle group`}
							width={dims.image}
							height={dims.image}
							className="block object-contain"
							loading="lazy"
							decoding="async"
						/>
					</div>
					<span className="text-[9px] tracking-widest text-[var(--text-muted)] uppercase">
						{icon.label}
					</span>
				</div>
			))}
		</fieldset>
	);
}
