const ACCENT = "#1DB954";
const DIM = "#2a2a2a";
const STROKE = "#444";

interface Props {
	muscleGroups: string[];
	size?: "sm" | "md";
}

const DIMS = {
	sm: { w: 72, h: 140, vb: "0 0 72 140" },
	md: { w: 100, h: 195, vb: "0 0 72 140" },
};

function hit(groups: string[], ...targets: string[]) {
	return (
		groups.includes("full body") || targets.some((t) => groups.includes(t))
	);
}

function fp(active: boolean) {
	return active
		? { fill: ACCENT, opacity: 0.85 as number }
		: { fill: DIM, stroke: STROKE, strokeWidth: 1 as number };
}

function FrontSVG({
	g,
	dims,
}: { g: string[]; dims: (typeof DIMS)[keyof typeof DIMS] }) {
	return (
		<svg
			width={dims.w}
			height={dims.h}
			viewBox={dims.vb}
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<ellipse cx="36" cy="10" rx="9" ry="10" fill={DIM} stroke={STROKE} strokeWidth={1} />
			<rect x="32" y="19" width="8" height="6" fill={DIM} stroke={STROKE} strokeWidth={1} />
			<ellipse cx="18" cy="29" rx="9" ry="7" {...fp(hit(g, "shoulders", "front delts", "side delts"))} />
			<ellipse cx="54" cy="29" rx="9" ry="7" {...fp(hit(g, "shoulders", "front delts", "side delts"))} />
			<path d="M25 25 Q36 22 47 25 L49 42 Q36 46 23 42 Z" {...fp(hit(g, "chest"))} />
			<rect x="27" y="43" width="18" height="22" rx="4" {...fp(hit(g, "core"))} />
			<rect x="9" y="27" width="8" height="22" rx="4" {...fp(hit(g, "biceps"))} />
			<rect x="55" y="27" width="8" height="22" rx="4" {...fp(hit(g, "biceps"))} />
			<rect x="7" y="50" width="7" height="18" rx="3" {...fp(hit(g, "forearms"))} />
			<rect x="58" y="50" width="7" height="18" rx="3" {...fp(hit(g, "forearms"))} />
			<path d="M26 65 Q36 62 46 65 L48 76 Q36 78 24 76 Z" fill={DIM} stroke={STROKE} strokeWidth={1} />
			<rect x="26" y="76" width="17" height="34" rx="6" {...fp(hit(g, "quads"))} />
			<rect x="29" y="76" width="17" height="34" rx="6" {...fp(hit(g, "quads"))} />
			<ellipse cx="31" cy="112" rx="6" ry="4" fill={DIM} stroke={STROKE} strokeWidth={1} />
			<ellipse cx="41" cy="112" rx="6" ry="4" fill={DIM} stroke={STROKE} strokeWidth={1} />
			<rect x="26" y="116" width="11" height="20" rx="5" {...fp(hit(g, "calves"))} />
			<rect x="35" y="116" width="11" height="20" rx="5" {...fp(hit(g, "calves"))} />
		</svg>
	);
}

function BackSVG({
	g,
	dims,
}: { g: string[]; dims: (typeof DIMS)[keyof typeof DIMS] }) {
	return (
		<svg
			width={dims.w}
			height={dims.h}
			viewBox={dims.vb}
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<ellipse cx="36" cy="10" rx="9" ry="10" fill={DIM} stroke={STROKE} strokeWidth={1} />
			<rect x="32" y="19" width="8" height="6" fill={DIM} stroke={STROKE} strokeWidth={1} />
			<path d="M27 22 Q36 19 45 22 L50 30 Q36 28 22 30 Z" {...fp(hit(g, "traps"))} />
			<ellipse cx="18" cy="30" rx="9" ry="7" {...fp(hit(g, "shoulders", "rear delts"))} />
			<ellipse cx="54" cy="30" rx="9" ry="7" {...fp(hit(g, "shoulders", "rear delts"))} />
			<path d="M23 30 Q36 27 49 30 L51 55 Q36 59 21 55 Z" {...fp(hit(g, "back", "lats"))} />
			<rect x="9" y="27" width="8" height="22" rx="4" {...fp(hit(g, "triceps"))} />
			<rect x="55" y="27" width="8" height="22" rx="4" {...fp(hit(g, "triceps"))} />
			<rect x="7" y="50" width="7" height="18" rx="3" {...fp(hit(g, "forearms"))} />
			<rect x="58" y="50" width="7" height="18" rx="3" {...fp(hit(g, "forearms"))} />
			<rect x="28" y="55" width="16" height="14" rx="3" fill={DIM} stroke={STROKE} strokeWidth={1} />
			<path d="M24 68 Q36 64 48 68 L50 82 Q36 86 22 82 Z" {...fp(hit(g, "glutes"))} />
			<rect x="24" y="80" width="16" height="30" rx="6" {...fp(hit(g, "hamstrings"))} />
			<rect x="32" y="80" width="16" height="30" rx="6" {...fp(hit(g, "hamstrings"))} />
			<ellipse cx="30" cy="112" rx="6" ry="4" fill={DIM} stroke={STROKE} strokeWidth={1} />
			<ellipse cx="42" cy="112" rx="6" ry="4" fill={DIM} stroke={STROKE} strokeWidth={1} />
			<rect x="25" y="116" width="11" height="20" rx="5" {...fp(hit(g, "calves"))} />
			<rect x="36" y="116" width="11" height="20" rx="5" {...fp(hit(g, "calves"))} />
		</svg>
	);
}

export function MuscleMap({ muscleGroups, size = "sm" }: Props) {
	const dims = DIMS[size];
	return (
		<div className="flex gap-5 justify-center items-end">
			<div className="flex flex-col items-center gap-1">
				<FrontSVG g={muscleGroups} dims={dims} />
				<span className="text-[9px] tracking-widest text-[var(--text-muted)] uppercase">
					Front
				</span>
			</div>
			<div className="flex flex-col items-center gap-1">
				<BackSVG g={muscleGroups} dims={dims} />
				<span className="text-[9px] tracking-widest text-[var(--text-muted)] uppercase">
					Back
				</span>
			</div>
		</div>
	);
}
