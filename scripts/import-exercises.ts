// Run with pnpm exec tsx scripts/import-exercises.ts /path/to/exercises.json
import { execFileSync } from "node:child_process";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
	CURATED_EXERCISES,
	type DefaultExercise,
} from "../packages/core/src/exercises/exercises";

const ids: Record<string, string> = JSON.parse(
	await readFile(
		new URL("../packages/core/src/exercises/ids.json", import.meta.url),
		"utf8",
	),
);

const revision = "5994bea047eee4d39a2c0872be3dd8fdd258ba31";
const source = process.argv[2];
if (!source) throw new Error("Pass a local checkout of wrkout/exercises.json");
if (
	execFileSync("git", ["-C", source, "rev-parse", "HEAD"], {
		encoding: "utf8",
	}).trim() !== revision
) {
	throw new Error(`Expected upstream revision ${revision}`);
}

// Alternate upstream names for movements already in the curated library.
// Keep curated names stable: sessions and routines reference their existing IDs.
const aliases: Record<string, string> = {
	"Ab Roller": "Ab Wheel Rollout",
	"Arnold Dumbbell Press": "Arnold Press",
	"Barbell Bench Press - Medium Grip": "Barbell Bench Press",
	"Barbell Squat": "Barbell Back Squat",
	"Barbell Hip Thrust": "Hip Thrust",
	"Barbell Incline Bench Press - Medium Grip": "Incline Barbell Press",
	"Standing Military Press": "Barbell Overhead Press",
	"Bent Over Barbell Row": "Barbell Row",
	"Cable Crossover": "Cable Fly",
	"Close-Grip Barbell Bench Press": "Close-Grip Bench Press",
	"Decline Barbell Bench Press": "Decline Barbell Press",
	"Dips - Chest Version": "Dip",
	"Dips - Triceps Version": "Dip",
	"Parallel Bar Dip": "Dip",
	"Dumbbell Bicep Curl": "Dumbbell Curl",
	"Dumbbell Flyes": "Dumbbell Fly",
	"EZ-Bar Skullcrusher": "Skull Crusher",
	"Front Barbell Squat": "Front Squat",
	"Hammer Curls": "Hammer Curl",
	"Hyperextensions (Back Extensions)": "Hyperextension",
	"Leg Extensions": "Leg Extension",
	"Lying Leg Curls": "Lying Leg Curl",
	"One-Arm Dumbbell Row": "Single-Arm Dumbbell Row",
	Pullups: "Pull-Up",
	Pushups: "Push-Up",
	"Reverse Flyes": "Dumbbell Reverse Fly",
	"Seated Cable Rows": "Cable Row",
	"Side Lateral Raise": "Dumbbell Lateral Raise",
	"Standing Calf Raises": "Standing Calf Raise",
	"Standing Dumbbell Triceps Extension": "Overhead Tricep Extension",
	"Standing Low-Pulley Deltoid Raise": "Cable Lateral Raise",
	"T-Bar Row with Handle": "T-Bar Row",
	"Triceps Pushdown": "Tricep Pushdown",
	"Wide-Grip Lat Pulldown": "Lat Pulldown",
};
const equipment: Record<string, DefaultExercise["equipment"]> = {
	barbell: "barbell",
	dumbbell: "dumbbell",
	cable: "cable",
	machine: "machine",
	"body only": "bodyweight",
	kettlebells: "kettlebell",
	bands: "band",
	"e-z curl bar": "barbell",
	"medicine ball": "other",
	"exercise ball": "other",
	"foam roll": "other",
	other: "other",
};
const muscles: Record<string, string> = {
	abdominals: "core",
	lats: "back",
	"middle back": "back",
};
const mechanics: Record<string, DefaultExercise["category"]> = {
	"Double Kettlebell Windmill": "compound",
	"Kettlebell Figure 8": "compound",
	"Reverse Hyperextension": "isolation",
};
const categories = new Set([
	"strength",
	"powerlifting",
	"olympic weightlifting",
	"strongman",
]);
const normalize = (name: string) =>
	name.toLowerCase().replace(/[^a-z0-9]/g, "");
const seen = new Set(CURATED_EXERCISES.map(({ name }) => normalize(name)));
for (const target of Object.values(aliases)) {
	if (!seen.has(normalize(target)))
		throw new Error(`Unknown alias target: ${target}`);
}
const exercises: DefaultExercise[] = [];
let scanned = 0;
for (const directory of (await readdir(resolve(source, "exercises"))).sort()) {
	const exercise = JSON.parse(
		await readFile(
			resolve(source, "exercises", directory, "exercise.json"),
			"utf8",
		),
	);
	scanned++;
	if (!categories.has(exercise.category) || !exercise.instructions.length)
		continue;
	const name = exercise.name.trim();
	const key = normalize(aliases[name] ?? name);
	if (seen.has(key)) continue;
	const category = exercise.mechanic ?? mechanics[name];
	const mappedEquipment =
		exercise.equipment === null ? "other" : equipment[exercise.equipment];
	if (!["compound", "isolation"].includes(category) || !mappedEquipment) {
		throw new Error(`Unmapped metadata: ${name}`);
	}
	const instructions: string[] = exercise.instructions
		.map((step: string) => step.trim())
		.filter(Boolean);
	const muscleGroups = [
		...new Set<string>(
			[...exercise.primaryMuscles, ...exercise.secondaryMuscles].map(
				(muscle: string) => muscles[muscle] ?? muscle,
			),
		),
	];
	if (!instructions.length || !muscleGroups.length)
		throw new Error(`Incomplete exercise: ${name}`);
	if (!ids[name])
		throw new Error(`Assign a permanent ID in ids.json for ${name}`);
	exercises.push({
		_id: ids[name],
		name,
		muscleGroups,
		category,
		equipment: mappedEquipment,
		instructions,
	});
	seen.add(key);
}
await writeFile(
	new URL("../packages/core/src/exercises/wrkoutExercises.ts", import.meta.url),
	`// Generated by scripts/import-exercises.ts. Do not edit manually.\n// Source: https://github.com/wrkout/exercises.json/tree/${revision}\n// Public domain (Unlicense); see wrkout-LICENSE.txt and README.md.\nimport type { DefaultExercise } from "./exercises";\n\nexport const WRKOUT_EXERCISES: DefaultExercise[] = ${JSON.stringify(exercises, null, "\t")};\n`,
);
execFileSync("pnpm", [
	"exec",
	"biome",
	"format",
	"--write",
	"packages/core/src/exercises/wrkoutExercises.ts",
]);
console.log(
	`Scanned ${scanned}; imported ${exercises.length}; total ${seen.size}.`,
);
