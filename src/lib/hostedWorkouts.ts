export type HostedLevel = "rx" | "l1" | "l2" | "l3";
export type HostedWodType = "forTime" | "amrap" | "emom" | "load";
export type LoadUnit = "kg" | "lbs";

export type HostedScore = {
	timeSeconds?: number;
	rounds?: number;
	reps?: number;
	timeCapped?: boolean;
	load?: number;
	loadUnit?: LoadUnit;
};

export type HostedLeaderboardRow = {
	id: string;
	name: string;
	level: HostedLevel;
	submittedAt: number;
	score: HostedScore;
};

export type ValidationResult =
	| { ok: true }
	| { ok: false; message: string };

const KG_PER_LB = 0.45359237;
const AMRAP_ROUND_SIZE = 100_000;

export function getHostedLevelLabel(level: HostedLevel) {
	const labels: Record<HostedLevel, string> = {
		rx: "Rx",
		l1: "L1",
		l2: "L2",
		l3: "L3",
	};
	return labels[level];
}

export function validateHostedScore(
	type: HostedWodType,
	score: HostedScore,
): ValidationResult {
	if (type === "forTime") {
		if (score.timeSeconds === undefined) {
			return { ok: false, message: "Time is required for this WOD." };
		}
		if (score.timeCapped && score.reps === undefined) {
			return { ok: false, message: "Reps are required for capped scores." };
		}
		return { ok: true };
	}
	if (type === "amrap") {
		if (score.rounds === undefined && score.reps === undefined) {
			return { ok: false, message: "Rounds or reps are required for this WOD." };
		}
		return { ok: true };
	}
	if (type === "emom") {
		if (score.reps === undefined && score.rounds === undefined) {
			return {
				ok: false,
				message: "Completed reps or rounds are required for this WOD.",
			};
		}
		return { ok: true };
	}
	if (score.load === undefined) {
		return { ok: false, message: "Load is required for this WOD." };
	}
	if (score.loadUnit === undefined) {
		return { ok: false, message: "Load unit is required for this WOD." };
	}
	return { ok: true };
}

export function formatHostedScore(type: HostedWodType, score: HostedScore) {
	if (type === "forTime") {
		if (score.timeCapped) return `CAP + ${score.reps ?? 0}`;
		return formatSeconds(score.timeSeconds ?? 0);
	}
	if (type === "amrap") return `${score.rounds ?? 0} + ${score.reps ?? 0}`;
	if (type === "emom") {
		if (score.reps !== undefined) return `${score.reps} reps`;
		if (score.rounds !== undefined) return `${score.rounds} rounds`;
		return "0 reps";
	}
	return `${score.load ?? 0} ${score.loadUnit ?? "kg"}`;
}

export function sortHostedLeaderboard(
	type: HostedWodType,
	rows: HostedLeaderboardRow[],
) {
	return [...rows].sort((a, b) => {
		const rankDiff = scoreRank(type, b.score) - scoreRank(type, a.score);
		if (rankDiff !== 0) return rankDiff;
		return a.submittedAt - b.submittedAt;
	});
}

export function scoreRank(type: HostedWodType, score: HostedScore) {
	if (type === "forTime") {
		if (score.timeCapped) return -1_000_000 + (score.reps ?? 0);
		return 1_000_000 - (score.timeSeconds ?? 86_400);
	}
	if (type === "amrap") {
		return (score.rounds ?? 0) * AMRAP_ROUND_SIZE + (score.reps ?? 0);
	}
	if (type === "emom") return score.reps ?? score.rounds ?? 0;
	const load = score.load ?? 0;
	return score.loadUnit === "lbs" ? load * KG_PER_LB : load;
}

function formatSeconds(totalSeconds: number) {
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = Math.floor(totalSeconds % 60);
	return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
