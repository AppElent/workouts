// Default exercise library shipped with the app.
// Source for instruction text: paraphrased from the open Everkinetic dataset
// (CC0). Keep instructions concise (3–5 short steps).

export type DefaultExercise = {
	name: string
	muscleGroups: string[]
	category: 'compound' | 'isolation'
	equipment:
		| 'barbell'
		| 'dumbbell'
		| 'cable'
		| 'bodyweight'
		| 'machine'
		| 'kettlebell'
		| 'band'
		| 'other'
	weightIncrement?: number
	notes?: string
	instructions: string[]
}

export const DEFAULT_EXERCISES: DefaultExercise[] = [
	// ─── Existing 15 (instructions backfilled) ─────────────────────────────────
	{
		name: 'Barbell Back Squat',
		muscleGroups: ['quadriceps', 'glutes', 'hamstrings'],
		category: 'compound',
		equipment: 'barbell',
		weightIncrement: 2.5,
		instructions: [
			'Set the bar at upper-chest height in a rack and step under it so it rests on your upper traps or rear delts.',
			'Unrack with both feet, walk back, and stand with feet shoulder-width apart, toes slightly out.',
			'Brace your core, break at the hips and knees together, and descend until your hip crease is below the knee.',
			'Drive through mid-foot and stand back up, keeping the chest tall and knees tracking over the toes.',
		],
	},
	{
		name: 'Barbell Bench Press',
		muscleGroups: ['chest', 'triceps', 'shoulders'],
		category: 'compound',
		equipment: 'barbell',
		weightIncrement: 2.5,
		instructions: [
			'Lie on a flat bench with eyes under the bar; grip slightly wider than shoulder width.',
			'Plant your feet, arch slightly, and pull your shoulder blades down and back into the bench.',
			'Unrack and lower the bar under control to the lower chest, keeping elbows at roughly 45–70°.',
			'Press the bar back up and slightly toward the rack until the elbows are locked out.',
		],
	},
	{
		name: 'Barbell Deadlift',
		muscleGroups: ['hamstrings', 'glutes', 'back', 'traps'],
		category: 'compound',
		equipment: 'barbell',
		weightIncrement: 2.5,
		instructions: [
			'Stand with mid-foot under the bar, feet about hip-width apart.',
			'Hinge at the hips, bend the knees, and grip the bar just outside your shins.',
			'Set your back flat, brace your core, and pull the slack out of the bar.',
			'Drive the floor away with your legs, keeping the bar against your body, until you stand fully upright.',
			'Lower the bar by pushing the hips back first, then bending the knees once it passes them.',
		],
	},
	{
		name: 'Barbell Overhead Press',
		muscleGroups: ['shoulders', 'triceps'],
		category: 'compound',
		equipment: 'barbell',
		weightIncrement: 1.25,
		instructions: [
			'Stand tall with the bar racked on the front delts, hands just outside shoulder width.',
			'Brace the core and squeeze the glutes; tuck the chin so the bar can travel straight up.',
			'Press the bar overhead, moving your head through once it clears your face.',
			'Lock out with the bar over mid-foot, then lower under control back to the front rack.',
		],
	},
	{
		name: 'Barbell Row',
		muscleGroups: ['back', 'biceps', 'rear delts'],
		category: 'compound',
		equipment: 'barbell',
		weightIncrement: 2.5,
		instructions: [
			'Stand over the bar, hinge at the hips with a flat back, knees softly bent, torso about 45°.',
			'Grip the bar slightly wider than shoulder width with an overhand grip.',
			'Pull the bar to your lower ribs by driving the elbows back and squeezing the shoulder blades.',
			'Lower under control to a full stretch without rounding the lower back.',
		],
	},
	{
		name: 'Pull-Up',
		muscleGroups: ['back', 'biceps'],
		category: 'compound',
		equipment: 'bodyweight',
		instructions: [
			'Hang from a pull-up bar with an overhand grip slightly wider than shoulder width.',
			'Pull your shoulder blades down and back, then drive the elbows down to the floor.',
			'Pull until your chin clears the bar; avoid kipping or swinging.',
			'Lower under control to a full hang and repeat.',
		],
	},
	{
		name: 'Dumbbell Curl',
		muscleGroups: ['biceps'],
		category: 'isolation',
		equipment: 'dumbbell',
		weightIncrement: 2,
		instructions: [
			'Stand with a dumbbell in each hand, arms extended, palms facing forward.',
			'Keep elbows pinned to your sides and curl the weights toward your shoulders.',
			'Squeeze the biceps at the top, then lower under control back to full extension.',
		],
	},
	{
		name: 'Tricep Pushdown',
		muscleGroups: ['triceps'],
		category: 'isolation',
		equipment: 'cable',
		weightIncrement: 2.5,
		instructions: [
			'Attach a rope or straight bar to a high pulley.',
			'Stand close, elbows pinned to your sides, forearms roughly parallel to the floor.',
			'Press the handle down by extending the elbows until your arms are straight.',
			'Squeeze the triceps briefly, then return under control without letting the elbows flare.',
		],
	},
	{
		name: 'Leg Press',
		muscleGroups: ['quadriceps', 'glutes'],
		category: 'compound',
		equipment: 'machine',
		weightIncrement: 5,
		instructions: [
			'Sit in the machine with feet shoulder-width on the platform, back flat against the pad.',
			'Release the safety stops and lower the platform until knees are roughly 90° (avoid losing low-back contact).',
			'Press through your mid-foot and heel to extend the legs, stopping just short of locking out.',
			'Re-engage the safety stops at the end of the set.',
		],
	},
	{
		name: 'Romanian Deadlift',
		muscleGroups: ['hamstrings', 'glutes'],
		category: 'compound',
		equipment: 'barbell',
		weightIncrement: 2.5,
		instructions: [
			'Stand holding a barbell at arm length, feet hip-width apart, slight knee bend.',
			'Push your hips back and slide the bar down your thighs, keeping the back flat.',
			'Stop when you feel a strong stretch in the hamstrings (usually mid-shin).',
			'Drive the hips forward to return to standing, squeezing the glutes at the top.',
		],
	},
	{
		name: 'Dumbbell Lateral Raise',
		muscleGroups: ['shoulders'],
		category: 'isolation',
		equipment: 'dumbbell',
		weightIncrement: 2,
		instructions: [
			'Stand with a dumbbell in each hand, arms at your sides, slight elbow bend.',
			'Raise the weights out to your sides until the upper arms are parallel to the floor.',
			'Lead with the elbows, not the hands, and keep the wrists neutral.',
			'Lower under control without letting the dumbbells crash into your sides.',
		],
	},
	{
		name: 'Cable Row',
		muscleGroups: ['back', 'biceps'],
		category: 'compound',
		equipment: 'cable',
		weightIncrement: 2.5,
		instructions: [
			'Sit on the bench with feet on the platform, knees slightly bent, grip the handle.',
			'Sit tall with arms extended and a slight forward lean for the stretch.',
			'Pull the handle to your lower ribs, driving the elbows back and squeezing the shoulder blades.',
			'Return under control to a full stretch without rounding the lower back.',
		],
	},
	{
		name: 'Dumbbell Bench Press',
		muscleGroups: ['chest', 'triceps', 'shoulders'],
		category: 'compound',
		equipment: 'dumbbell',
		weightIncrement: 2,
		instructions: [
			'Sit on a flat bench with a dumbbell on each thigh, then lie back, kicking the weights to shoulder level.',
			'Set your shoulder blades down and back; press both dumbbells up over the chest.',
			'Lower the weights to chest level with elbows around 45–70°.',
			'Press back up and slightly together at the top without locking out hard.',
		],
	},
	{
		name: 'Incline Barbell Press',
		muscleGroups: ['chest', 'shoulders', 'triceps'],
		category: 'compound',
		equipment: 'barbell',
		weightIncrement: 2.5,
		instructions: [
			'Set the bench to about 30°. Lie back and grip the bar slightly wider than shoulder width.',
			'Pull the shoulder blades down and back, plant the feet, and unrack.',
			'Lower the bar to the upper chest under control.',
			'Press the bar up and slightly back over the shoulder joint until the elbows lock out.',
		],
	},
	{
		name: 'Kettlebell Swing',
		muscleGroups: ['glutes', 'hamstrings', 'core'],
		category: 'compound',
		equipment: 'kettlebell',
		weightIncrement: 4,
		instructions: [
			'Stand with feet shoulder-width apart, kettlebell about a foot in front of you.',
			'Hinge at the hips, hike the kettlebell back between your thighs.',
			'Drive the hips forward explosively to swing the bell up to chest height — this is a hip hinge, not a squat or front raise.',
			'Let the bell fall back into the next hinge and continue for reps.',
		],
	},

	// ─── Chest (5 new) ─────────────────────────────────────────────────────────
	{
		name: 'Push-Up',
		muscleGroups: ['chest', 'triceps', 'shoulders', 'core'],
		category: 'compound',
		equipment: 'bodyweight',
		instructions: [
			'Set hands slightly wider than shoulders, body in a straight line from head to heels.',
			'Brace the core and squeeze the glutes to keep the hips level.',
			'Lower your chest to within an inch of the floor with elbows tracking back at ~45°.',
			'Press back up to full elbow extension without flaring the elbows or sagging the hips.',
		],
	},
	{
		name: 'Dumbbell Fly',
		muscleGroups: ['chest'],
		category: 'isolation',
		equipment: 'dumbbell',
		weightIncrement: 2,
		instructions: [
			'Lie on a flat bench holding two dumbbells over your chest, palms facing each other, slight elbow bend.',
			'Lower the weights in a wide arc until you feel a strong stretch in the chest.',
			'Keep the elbow angle fixed — think “hugging a tree.”',
			'Squeeze the chest to bring the dumbbells back up along the same arc.',
		],
	},
	{
		name: 'Cable Fly',
		muscleGroups: ['chest'],
		category: 'isolation',
		equipment: 'cable',
		weightIncrement: 2.5,
		instructions: [
			'Set both pulleys at chest height (or high for a low-to-high variation) with single handles.',
			'Stand between the stacks with one foot forward, slight elbow bend, palms forward.',
			'Bring the handles together in front of your chest in a wide arc, squeezing the pecs.',
			'Resist the stretch on the way back without letting the hands travel behind your shoulders.',
		],
	},
	{
		name: 'Decline Barbell Press',
		muscleGroups: ['chest', 'triceps'],
		category: 'compound',
		equipment: 'barbell',
		weightIncrement: 2.5,
		instructions: [
			'Secure your feet on a decline bench and lie back; grip the bar slightly wider than shoulder width.',
			'Unrack and hold the bar over the lower chest with arms locked.',
			'Lower the bar under control to the lower pec line.',
			'Press up and slightly back toward the rack until the elbows lock out.',
		],
	},
	{
		name: 'Close-Grip Bench Press',
		muscleGroups: ['triceps', 'chest', 'shoulders'],
		category: 'compound',
		equipment: 'barbell',
		weightIncrement: 2.5,
		instructions: [
			'Lie on a flat bench and grip the bar at roughly shoulder-width, no narrower than that to spare the wrists.',
			'Unrack and lower the bar to the lower chest with elbows tucked close to the torso.',
			'Press the bar straight up by extending the elbows.',
			'Lock out at the top, focusing on a strong triceps contraction.',
		],
	},

	// ─── Back (8 new) ──────────────────────────────────────────────────────────
	{
		name: 'Lat Pulldown',
		muscleGroups: ['lats', 'back', 'biceps'],
		category: 'compound',
		equipment: 'cable',
		weightIncrement: 2.5,
		instructions: [
			'Sit at a lat pulldown machine, knees pinned under the pad, grip the bar slightly wider than shoulders.',
			'Sit tall with a slight backward lean and pull the shoulder blades down.',
			'Drive the elbows down and back to pull the bar to the upper chest.',
			'Control the bar back up to a full stretch overhead.',
		],
	},
	{
		name: 'T-Bar Row',
		muscleGroups: ['back', 'lats', 'biceps'],
		category: 'compound',
		equipment: 'other',
		weightIncrement: 2.5,
		instructions: [
			'Straddle the loaded bar (landmine or T-bar machine) and grip the handle with a neutral grip.',
			'Hinge at the hips with a flat back and slight knee bend; let the bar hang at arm length.',
			'Pull the handle to your sternum, driving the elbows back and squeezing the shoulder blades.',
			'Lower under control to a full stretch without rounding the back.',
		],
	},
	{
		name: 'Single-Arm Dumbbell Row',
		muscleGroups: ['back', 'lats', 'biceps'],
		category: 'compound',
		equipment: 'dumbbell',
		weightIncrement: 2,
		instructions: [
			'Place one knee and same-side hand on a flat bench; opposite foot on the floor.',
			'Hold a dumbbell in the free hand at arm length with a flat back.',
			'Row the dumbbell to your hip by driving the elbow up and back.',
			'Lower under control to a full stretch and repeat for reps before switching sides.',
		],
	},
	{
		name: 'Pendlay Row',
		muscleGroups: ['back', 'lats', 'rear delts'],
		category: 'compound',
		equipment: 'barbell',
		weightIncrement: 2.5,
		instructions: [
			'Set the bar on the floor and stand with feet hip-width apart.',
			'Hinge until the torso is parallel to the floor, grip slightly wider than shoulder width.',
			'Pull the bar explosively to the lower chest, keeping the torso flat the whole time.',
			'Return the bar to the floor for a full reset between every rep.',
		],
	},
	{
		name: 'Face Pull',
		muscleGroups: ['rear delts', 'traps', 'shoulders'],
		category: 'isolation',
		equipment: 'cable',
		weightIncrement: 2.5,
		instructions: [
			'Attach a rope to a high pulley (eye level or slightly above).',
			'Grip the rope with palms facing each other and step back to create tension.',
			'Pull the rope toward your face, separating the ends and externally rotating so the hands end up beside the ears.',
			'Squeeze the rear delts and upper back, then return under control.',
		],
	},
	{
		name: 'Chin-Up',
		muscleGroups: ['back', 'biceps', 'lats'],
		category: 'compound',
		equipment: 'bodyweight',
		instructions: [
			'Hang from a bar with an underhand grip, hands about shoulder-width apart.',
			'Pull the shoulder blades down, then drive the elbows toward the floor.',
			'Pull until your chin is over the bar.',
			'Lower under control to a full hang.',
		],
	},
	{
		name: 'Hyperextension',
		muscleGroups: ['back', 'glutes', 'hamstrings'],
		category: 'isolation',
		equipment: 'bodyweight',
		instructions: [
			'Set up on a 45° or 90° back-extension bench with hips on the pad and feet anchored.',
			'Cross your arms or hold a plate at your chest; start with the torso hanging.',
			'Extend the hips and back until your body forms a straight line — do not hyperextend.',
			'Lower under control to the start.',
		],
	},
	{
		name: 'Barbell Shrug',
		muscleGroups: ['traps'],
		category: 'isolation',
		equipment: 'barbell',
		weightIncrement: 2.5,
		instructions: [
			'Hold a barbell at arm length with an overhand grip, hands about shoulder-width.',
			'Stand tall, brace the core, and lift the shoulders straight up toward the ears.',
			'Pause briefly at the top — avoid rolling the shoulders.',
			'Lower under control to a full stretch.',
		],
	},

	// ─── Legs (11 new) ─────────────────────────────────────────────────────────
	{
		name: 'Front Squat',
		muscleGroups: ['quadriceps', 'glutes', 'core'],
		category: 'compound',
		equipment: 'barbell',
		weightIncrement: 2.5,
		instructions: [
			'Set the bar in a front-rack position across the front delts and collarbone, elbows high.',
			'Unrack with both feet and step back into a stance about shoulder-width.',
			'Brace hard and squat down with a tall torso, keeping the elbows up the whole time.',
			'Drive through mid-foot to stand back up, maintaining the rack position.',
		],
	},
	{
		name: 'Bulgarian Split Squat',
		muscleGroups: ['quadriceps', 'glutes', 'hamstrings'],
		category: 'compound',
		equipment: 'dumbbell',
		weightIncrement: 2,
		instructions: [
			'Stand a stride length in front of a bench; place the top of the rear foot on it.',
			'Hold dumbbells at your sides, torso upright.',
			'Lower until the front thigh is roughly parallel to the floor and the rear knee is just above it.',
			'Drive through the front mid-foot to return to the start. Finish all reps before switching sides.',
		],
	},
	{
		name: 'Walking Lunge',
		muscleGroups: ['quadriceps', 'glutes', 'hamstrings'],
		category: 'compound',
		equipment: 'dumbbell',
		weightIncrement: 2,
		instructions: [
			'Hold a dumbbell in each hand at your sides and stand tall.',
			'Step forward into a lunge, lowering until the back knee is just above the floor.',
			'Drive through the front foot and bring the back leg through into the next step.',
			'Continue alternating legs for the prescribed distance or reps.',
		],
	},
	{
		name: 'Hip Thrust',
		muscleGroups: ['glutes', 'hamstrings'],
		category: 'compound',
		equipment: 'barbell',
		weightIncrement: 2.5,
		instructions: [
			'Sit on the floor with your upper back against a bench, barbell over your hips (use a pad).',
			'Plant your feet flat, knees bent ~90° at the top of the rep.',
			'Drive through the heels to lift the hips until torso and thighs form a straight line.',
			'Squeeze the glutes hard at the top, then lower under control.',
		],
	},
	{
		name: 'Goblet Squat',
		muscleGroups: ['quadriceps', 'glutes', 'core'],
		category: 'compound',
		equipment: 'kettlebell',
		weightIncrement: 4,
		instructions: [
			'Hold a kettlebell (or dumbbell) close to your chest with both hands, elbows under it.',
			'Stand with feet roughly shoulder-width, toes slightly out.',
			'Squat down between your knees, keeping the chest tall and elbows inside the knees.',
			'Drive through mid-foot to stand back up.',
		],
	},
	{
		name: 'Lying Leg Curl',
		muscleGroups: ['hamstrings'],
		category: 'isolation',
		equipment: 'machine',
		weightIncrement: 2.5,
		instructions: [
			'Lie face-down on the machine with the pad just above your heels and knees just off the bench.',
			'Grip the handles and curl the heels toward your glutes by flexing the hamstrings.',
			'Squeeze briefly at the top, then lower under control to a full stretch.',
		],
	},
	{
		name: 'Leg Extension',
		muscleGroups: ['quadriceps'],
		category: 'isolation',
		equipment: 'machine',
		weightIncrement: 2.5,
		instructions: [
			'Sit in the machine with the pad on top of the lower shins, knees aligned with the pivot.',
			'Grip the handles and extend the knees until the legs are nearly straight.',
			'Squeeze the quads at the top, then lower under control without letting the stack rest.',
		],
	},
	{
		name: 'Standing Calf Raise',
		muscleGroups: ['calves'],
		category: 'isolation',
		equipment: 'machine',
		weightIncrement: 2.5,
		instructions: [
			'Position the shoulder pads of a standing calf machine on your shoulders, balls of the feet on the platform.',
			'Let the heels drop below the platform for a full stretch.',
			'Press through the balls of the feet to rise as high as possible onto the toes.',
			'Squeeze briefly, then lower under control back to the stretch.',
		],
	},
	{
		name: 'Seated Calf Raise',
		muscleGroups: ['calves'],
		category: 'isolation',
		equipment: 'machine',
		weightIncrement: 2.5,
		instructions: [
			'Sit with the pad on the lower thighs and the balls of the feet on the platform.',
			'Release the safety lever and let the heels drop for a stretch.',
			'Press up onto the toes as high as possible, squeezing the calves.',
			'Lower under control.',
		],
	},
	{
		name: 'Sumo Deadlift',
		muscleGroups: ['glutes', 'quadriceps', 'hamstrings', 'back'],
		category: 'compound',
		equipment: 'barbell',
		weightIncrement: 2.5,
		instructions: [
			'Stand with a wide stance, toes pointed out, shins close to the bar.',
			'Reach down inside your knees and grip the bar with arms vertical.',
			'Set the back flat, push the knees out, and pull the slack out of the bar.',
			'Drive the floor away with the legs and squeeze the glutes through to lockout.',
			'Lower the bar by hinging back, keeping the bar close to the body.',
		],
	},
	{
		name: 'Good Morning',
		muscleGroups: ['hamstrings', 'glutes', 'back'],
		category: 'compound',
		equipment: 'barbell',
		weightIncrement: 2.5,
		instructions: [
			'Set the bar on your upper back as for a back squat, feet hip- to shoulder-width apart.',
			'With a slight knee bend, push your hips back and lower the torso toward parallel.',
			'Keep the back flat and the bar locked against the upper back the whole way.',
			'Drive the hips forward to return to standing.',
		],
	},

	// ─── Shoulders (4 new) ─────────────────────────────────────────────────────
	{
		name: 'Dumbbell Shoulder Press',
		muscleGroups: ['shoulders', 'triceps'],
		category: 'compound',
		equipment: 'dumbbell',
		weightIncrement: 2,
		instructions: [
			'Sit on a bench with back support, dumbbells held at shoulder height, palms forward.',
			'Brace the core and press both weights overhead until the elbows are nearly locked.',
			'Lower under control to shoulder level without flaring the elbows excessively.',
		],
	},
	{
		name: 'Arnold Press',
		muscleGroups: ['shoulders', 'triceps'],
		category: 'compound',
		equipment: 'dumbbell',
		weightIncrement: 2,
		instructions: [
			'Sit on a bench, dumbbells held in front of the shoulders with palms facing you.',
			'Press up while rotating the wrists so the palms face forward at lockout.',
			'Reverse the motion on the way down, ending with palms facing you again.',
		],
	},
	{
		name: 'Cable Lateral Raise',
		muscleGroups: ['shoulders'],
		category: 'isolation',
		equipment: 'cable',
		weightIncrement: 2.5,
		instructions: [
			'Stand sideways to a low cable pulley with a single-handle attachment in the far hand.',
			'Keep a slight elbow bend and raise the arm out to the side until parallel to the floor.',
			'Lead with the elbow and lower under control without letting the cable yank the arm.',
		],
	},
	{
		name: 'Dumbbell Reverse Fly',
		muscleGroups: ['rear delts', 'traps'],
		category: 'isolation',
		equipment: 'dumbbell',
		weightIncrement: 2,
		instructions: [
			'Hinge at the hips with a flat back, dumbbells hanging below the chest, slight elbow bend.',
			'Raise the weights out to the sides until the upper arms are roughly parallel to the floor.',
			'Squeeze the rear delts and upper back, then lower under control.',
		],
	},

	// ─── Arms (6 new) ──────────────────────────────────────────────────────────
	{
		name: 'Hammer Curl',
		muscleGroups: ['biceps', 'forearms'],
		category: 'isolation',
		equipment: 'dumbbell',
		weightIncrement: 2,
		instructions: [
			'Stand with a dumbbell in each hand, palms facing each other (neutral grip).',
			'Keep elbows pinned and curl the weights toward your shoulders without rotating the wrists.',
			'Squeeze briefly at the top, then lower under control to full extension.',
		],
	},
	{
		name: 'EZ-Bar Curl',
		muscleGroups: ['biceps'],
		category: 'isolation',
		equipment: 'barbell',
		weightIncrement: 1.25,
		instructions: [
			'Hold an EZ-curl bar at arm length, hands on the inner-angled grips, palms slightly turned in.',
			'Keep elbows pinned to your sides and curl the bar to shoulder level.',
			'Squeeze briefly at the top, then lower under control to a full stretch.',
		],
	},
	{
		name: 'Preacher Curl',
		muscleGroups: ['biceps'],
		category: 'isolation',
		equipment: 'barbell',
		weightIncrement: 1.25,
		instructions: [
			'Sit at a preacher bench, upper arms flat on the pad, holding an EZ-bar with an underhand grip.',
			'Curl the bar by flexing the elbows; do not let the upper arms come off the pad.',
			'Lower under control without fully locking out the elbows at the bottom.',
		],
	},
	{
		name: 'Skull Crusher',
		muscleGroups: ['triceps'],
		category: 'isolation',
		equipment: 'barbell',
		weightIncrement: 1.25,
		instructions: [
			'Lie on a flat bench holding an EZ-bar over the chest with arms straight.',
			'Keeping the upper arms vertical, bend the elbows to lower the bar toward the forehead or just behind it.',
			'Extend the elbows to drive the bar back to the start, squeezing the triceps.',
		],
	},
	{
		name: 'Overhead Tricep Extension',
		muscleGroups: ['triceps'],
		category: 'isolation',
		equipment: 'dumbbell',
		weightIncrement: 2,
		instructions: [
			'Stand or sit holding a single dumbbell overhead with both hands cupping the inner head.',
			'Keep the upper arms close to the head and lower the weight behind the head by bending the elbows.',
			'Extend the elbows to press the weight back overhead.',
		],
	},
	{
		name: 'Dip',
		muscleGroups: ['triceps', 'chest', 'shoulders'],
		category: 'compound',
		equipment: 'bodyweight',
		instructions: [
			'Support yourself on parallel bars with arms locked, shoulders down and back.',
			'Lean slightly forward for chest emphasis or stay upright for triceps emphasis.',
			'Lower until the upper arms are roughly parallel to the floor.',
			'Press back up to lockout without shrugging.',
		],
	},

	// ─── Core (5 new) ──────────────────────────────────────────────────────────
	{
		name: 'Plank',
		muscleGroups: ['core'],
		category: 'isolation',
		equipment: 'bodyweight',
		instructions: [
			'Set up on your forearms and toes, elbows under the shoulders, body in a straight line.',
			'Brace the core hard and squeeze the glutes — no sagging hips, no hiking up.',
			'Hold for the prescribed time while breathing normally.',
		],
	},
	{
		name: 'Hanging Leg Raise',
		muscleGroups: ['core'],
		category: 'isolation',
		equipment: 'bodyweight',
		instructions: [
			'Hang from a pull-up bar with arms straight, shoulders engaged.',
			'Keeping the legs straight (or knees bent for an easier version), raise them until the thighs are at least parallel to the floor.',
			'Lower under control without swinging.',
		],
	},
	{
		name: 'Cable Crunch',
		muscleGroups: ['core'],
		category: 'isolation',
		equipment: 'cable',
		weightIncrement: 2.5,
		instructions: [
			'Attach a rope to a high pulley and kneel below it, holding the rope at the sides of your head.',
			'Keep the hips fixed and crunch the torso down by flexing the spine — round the upper back toward the floor.',
			'Squeeze the abs at the bottom, then return under control without letting the hips do the work.',
		],
	},
	{
		name: 'Ab Wheel Rollout',
		muscleGroups: ['core'],
		category: 'compound',
		equipment: 'other',
		instructions: [
			'Kneel with the ab wheel under your shoulders, arms straight.',
			'Brace the core and roll the wheel forward, extending the body as far as you can without the hips sagging.',
			'Pull the wheel back to the start by contracting the abs and hip flexors.',
		],
	},
	{
		name: 'Russian Twist',
		muscleGroups: ['core'],
		category: 'isolation',
		equipment: 'bodyweight',
		instructions: [
			'Sit on the floor with knees bent, heels lightly touching the ground (or feet lifted for harder).',
			'Lean back slightly to engage the core, hands clasped or holding a weight in front of the chest.',
			'Rotate the torso to tap the floor on one side, then the other. Move from the ribcage, not the arms.',
		],
	},
]
