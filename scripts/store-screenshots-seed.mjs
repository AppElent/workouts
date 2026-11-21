#!/usr/bin/env node
// Demo data for the App Store screenshots (APP-559): four weeks of strength
// training, a few runs and rides, body weight, nutrition goals and a week of
// diary days, written through the app's own public Convex functions as the
// test user (`convex run --identity`).
//
//   CONVEX_AGENT_MODE=anonymous node scripts/store-screenshots-seed.mjs --user user_...
//
// Run it only against a local or disposable dev deployment (`.env.local` points
// at it). It first clears that account's personal data (`seed:clearUserData`),
// so it replaces whatever the account holds. It refuses a production
// deployment. Foods are shipped foods; no Personal Foods and no "Test:" names.

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { servingOptions } from "@foundry/core";
import { SHIPPED_EXERCISES } from "@foundry/core/exercises";
import { foodSnapshot, getShippedFood } from "@foundry/core/shipped-foods";

const DAY = 86_400_000;
const root = resolve(import.meta.dirname, "..");

const userIndex = process.argv.indexOf("--user");
const user = userIndex > 0 ? process.argv[userIndex + 1] : undefined;
if (!user?.startsWith("user_")) {
	console.error("usage: store-screenshots-seed.mjs --user <Clerk user id>");
	process.exit(2);
}

const envFile = readFileSync(resolve(root, ".env.local"), "utf8");
const deployment = /^CONVEX_DEPLOYMENT=(.*)$/m.exec(envFile)?.[1] ?? "";
if (!/^(local|anonymous)[:-]/.test(deployment) && !/^dev:/.test(deployment)) {
	console.error(
		`Refusing to seed: CONVEX_DEPLOYMENT is not a local or dev deployment (${deployment.split(":")[0] || "unset"}).`,
	);
	process.exit(2);
}

function run(args) {
	return new Promise((done, fail) => {
		const child = spawn("pnpm", ["exec", "convex", "run", ...args], {
			cwd: root,
			env: { ...process.env, CONVEX_AGENT_MODE: "anonymous" },
		});
		let out = "";
		let err = "";
		child.stdout.on("data", (chunk) => {
			out += chunk;
		});
		child.stderr.on("data", (chunk) => {
			err += chunk;
		});
		child.on("close", (code) =>
			code === 0
				? done(out.trim())
				: fail(new Error(`convex run ${args[0]} failed: ${err || out}`)),
		);
	});
}

const identity = JSON.stringify({ subject: user });
const call = (fn, args) =>
	run(["--identity", identity, fn, JSON.stringify(args)]);
const parseId = (out) => JSON.parse(out.split("\n").at(-1));

async function pool(tasks, size) {
	const queue = [...tasks];
	await Promise.all(
		Array.from({ length: size }, async () => {
			for (let task = queue.shift(); task; task = queue.shift()) await task();
		}),
	);
}

// ---------------------------------------------------------------------------
// Dates: the device's calendar day, at 18:00 for sessions.

const now = Date.now();
// Operation receipts survive a clear, so every run uses its own ids.
const runId = now.toString(36);
const localDate = (ms) =>
	new Intl.DateTimeFormat("en-CA", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(ms);
const at = (daysAgo, hour, minute = 0) => {
	const day = new Date(now - daysAgo * DAY);
	day.setHours(hour, minute, 0, 0);
	return Math.min(day.getTime(), now - 60_000);
};

// ---------------------------------------------------------------------------
// Strength: two upper-body and two lower-body sessions a week for four weeks.

const exercise = (slug) => {
	const found = SHIPPED_EXERCISES.find(
		(item) => item._id === `shipped:exercise:${slug}`,
	);
	if (!found) throw new Error(`Shipped exercise ${slug} not found`);
	return found._id;
};
const BENCH = exercise("barbell-bench-press");
const PRESS = exercise("barbell-overhead-press");
const ROW = exercise("barbell-row");
const SQUAT = exercise("barbell-back-squat");
const RDL = exercise("romanian-deadlift");

// [days ago, name, [exercise, working kg, working reps]]
const SESSIONS = [
	[
		27,
		"Upper body",
		[
			[BENCH, 70, 5],
			[ROW, 60, 8],
			[PRESS, 40, 6],
		],
	],
	[
		25,
		"Lower body",
		[
			[SQUAT, 90, 5],
			[RDL, 70, 8],
		],
	],
	[
		22,
		"Upper body",
		[
			[BENCH, 72.5, 5],
			[ROW, 62.5, 8],
			[PRESS, 40, 6],
		],
	],
	[
		20,
		"Lower body",
		[
			[SQUAT, 92.5, 5],
			[RDL, 72.5, 8],
		],
	],
	[
		18,
		"Upper body",
		[
			[BENCH, 75, 5],
			[ROW, 65, 8],
			[PRESS, 42.5, 6],
		],
	],
	[
		15,
		"Lower body",
		[
			[SQUAT, 95, 5],
			[RDL, 75, 8],
		],
	],
	[
		13,
		"Upper body",
		[
			[BENCH, 77.5, 5],
			[ROW, 65, 8],
			[PRESS, 42.5, 6],
		],
	],
	[
		11,
		"Lower body",
		[
			[SQUAT, 100, 5],
			[RDL, 80, 8],
		],
	],
	[
		8,
		"Upper body",
		[
			[BENCH, 80, 5],
			[ROW, 67.5, 8],
			[PRESS, 45, 6],
		],
	],
	[
		6,
		"Lower body",
		[
			[SQUAT, 102.5, 5],
			[RDL, 82.5, 8],
		],
	],
	[
		4,
		"Upper body",
		[
			[BENCH, 82.5, 5],
			[ROW, 70, 8],
			[PRESS, 45, 6],
		],
	],
	[
		2,
		"Lower body",
		[
			[SQUAT, 105, 5],
			[RDL, 85, 8],
		],
	],
];

async function seedSession([daysAgo, name, lifts], index) {
	const startTime = at(daysAgo, 18);
	const sessionId = parseId(
		await call("workoutSessions:create", { name, startTime }),
	);
	let minute = 5;
	let setNumber = 0;
	for (const [exerciseId, kg, reps] of lifts) {
		const sets = [
			["warmup", Math.round((kg * 0.6) / 2.5) * 2.5, reps + 3],
			["working", kg, reps],
			["working", kg, reps],
			["working", kg, reps - (index % 3 === 0 ? 1 : 0)],
		];
		for (const [setType, weight, setReps] of sets) {
			setNumber += 1;
			await call("sets:add", {
				operationId: `store-${runId}-${daysAgo}-${exerciseId}-${setNumber}`,
				sessionId,
				exerciseId,
				setNumber,
				reps: setReps,
				weight,
				unit: "kg",
				setType,
				loggedAt: Math.min(startTime + minute * 60_000, now - 30_000),
			});
			minute += 4;
		}
		setNumber = 0;
	}
	await call("workoutSessions:finish", {
		id: sessionId,
		endTime: Math.min(startTime + (minute + 6) * 60_000, now - 10_000),
	});
}

// ---------------------------------------------------------------------------
// Nutrition

const food = (id) => {
	const found = getShippedFood(id);
	if (!found) throw new Error(`Shipped food ${id} not found`);
	return found;
};
/** One diary part: `quantity` of the food's authored serving `serving`, or grams. */
const part = (id, serving, quantity, index) => {
	const item = food(id);
	const options = servingOptions(item);
	const option = serving === "g" ? options.at(-1) : options[serving];
	return {
		...foodSnapshot({ kind: "shipped", food: item }, option, quantity),
		clientEntryId: `store-${runId}-food-${index}`,
	};
};

const BREAKFAST = [
	[
		["shipped:oat-flakes", 1, 1],
		["shipped:banana", 0, 1],
		["shipped:quark-low-fat", 0, 1],
		["shipped:almonds-blanched-unsalted", 0, 1],
	],
	[
		["shipped:wheat-bread-wholemeal-av-fine-and-coarse", 1, 1.5],
		["shipped:cheese-cottage", 0, 1],
		["shipped:tomatoes-classic-round-raw", 0, 1],
		["shipped:coffee-prepared", 1, 1],
	],
];
const LUNCH = [
	[
		["shipped:pasta-white-av-boiled", 0, 1.5],
		["shipped:chicken-fillet-prepared", 0, 1.5],
		["shipped:broccoli-boiled", 0, 1],
		["shipped:oil-olive", 0, 1],
	],
	[
		["shipped:wheat-bread-wholemeal-av-fine-and-coarse", 0, 3],
		["shipped:cheese-cottage", 0, 1.5],
		["shipped:avocado", 0, 1],
		["shipped:cucumber-w-skin-raw", 1, 1],
	],
];
const DINNER = [
	[
		["shipped:rice-white-boiled", 0, 1.5],
		["shipped:salmon-farmed-raw", 0, 1],
		["shipped:spinach-boiled", 0, 1],
	],
	[
		["shipped:potatoes-raw", "g", 300],
		["shipped:minced-beef-raw", 0, 1.5],
		["shipped:broccoli-boiled", 0, 1.5],
	],
];
const SNACK = [
	[
		["shipped:peanuts-unsalted", 0, 1],
		["shipped:banana", 0, 1],
	],
	[
		["shipped:quark-low-fat", 0, 1],
		["shipped:banana", 1, 1],
	],
];

let entrySequence = 0;
async function seedDiaryDay(daysAgo) {
	const date = localDate(now - daysAgo * DAY);
	const meals = [
		["breakfast", BREAKFAST[daysAgo % 2]],
		["lunch", LUNCH[(daysAgo + 1) % 2]],
		["snacks", SNACK[daysAgo % 2]],
		// Today ends at the afternoon snack; the evening is still to come.
		...(daysAgo > 0 ? [["dinner", DINNER[daysAgo % 2]]] : []),
	];
	for (const [meal, items] of meals) {
		const entries = items.map(([id, serving, quantity]) => {
			entrySequence += 1;
			return part(id, serving, quantity, `${date}-${entrySequence}`);
		});
		await call("nutritionDiary:applyOperation", {
			operationId: `store-${runId}-diary-${date}-${meal}`,
			expectedSubject: user,
			operation: { kind: "createBatch", date, meal, entries },
		});
	}
}

// ---------------------------------------------------------------------------

console.log(`Seeding ${deployment.split(":")[0]} deployment…`);
await run(["seed:clearUserData", JSON.stringify({ userId: user })]);

await pool(
	// One active session at a time: each session is finished before the next.
	SESSIONS.map((session, index) => () => seedSession(session, index)),
	1,
);
console.log("strength sessions done");

for (const [name, lifts] of [
	[
		"Upper body",
		[
			[BENCH, 3, 5, 82.5],
			[ROW, 3, 8, 70],
			[PRESS, 3, 6, 45],
		],
	],
	[
		"Lower body",
		[
			[SQUAT, 3, 5, 105],
			[RDL, 3, 8, 85],
		],
	],
])
	await call("routines:create", {
		name,
		exercises: lifts.map(
			([exerciseId, defaultSets, defaultReps, defaultWeight]) => ({
				exerciseId,
				defaultSets,
				defaultReps,
				defaultWeight,
			}),
		),
	});

for (const [exerciseId, value, daysAgo] of [
	[BENCH, 86, 28],
	[SQUAT, 112, 28],
	[BENCH, 89, 21],
	[SQUAT, 116, 21],
	[BENCH, 92, 14],
	[SQUAT, 120, 14],
	[BENCH, 95, 6],
	[SQUAT, 125, 7],
])
	await call("oneRepMaxes:addManual", {
		exerciseId,
		value,
		unit: "kg",
		date: at(daysAgo, 12),
	});

const activities = [
	["running", 3, "Morning run", 1710, 5200, 130],
	["cycling", 1, "Weekend ride", 4500, 42_000, 238],
	["running", 9, "Easy run", 2520, 7400, 120],
	["running", 16, "Tempo run", 1890, 6000, 150],
	["cycling", 14, "Ride to the coast", 5400, 51_000, 310],
	["running", 23, "Easy run", 1980, 5600, 118],
];
for (const [
	sport,
	daysAgo,
	title,
	durationSeconds,
	distanceMeters,
	elevation,
] of activities)
	await call("enduranceActivities:create", {
		clientEntryId: `store-${runId}-${sport}-${daysAgo}`,
		sport,
		occurredAt: at(daysAgo, 8),
		durationSeconds,
		distanceMeters,
		title,
		environment: "outdoor",
		elevationGainMeters: elevation,
		effort: 6,
	});
console.log("activities done");

for (const [daysAgo, weight, bodyFatPct] of [
	[28, 82.6, 19.4],
	[21, 82.1, 19.0],
	[14, 81.8, 18.7],
	[7, 81.3, 18.3],
	[1, 80.9, 18.0],
])
	await call("bodyMetrics:add", {
		date: at(daysAgo, 7, 30),
		weight,
		unit: "kg",
		bodyFatPct,
	});

await call("nutritionGoals:replace", {
	effectiveFrom: localDate(now - 40 * DAY),
	goals: [
		{ nutrient: "energy", direction: "max", target: 2600 },
		{ nutrient: "protein", direction: "min", target: 90 },
		{ nutrient: "carbs", direction: "max", target: 300 },
		{ nutrient: "fat", direction: "max", target: 85 },
		{ nutrient: "fibre", direction: "min", target: 15 },
	],
});

await pool(
	[0, 1, 2, 3, 4, 5, 6].map((daysAgo) => () => seedDiaryDay(daysAgo)),
	3,
);
console.log("diary done");
