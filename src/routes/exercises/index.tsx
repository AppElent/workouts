import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/clerk-react";
import { api } from "@convex/_generated/api";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { AddExerciseModal } from "#/components/exercises/AddExerciseModal";
import { cn } from "#/lib/utils";

const CHIP_FILTERS = [
	{ label: "All", groups: null as string[] | null },
	{ label: "Chest", groups: ["chest"] },
	{ label: "Back", groups: ["back", "lats", "traps"] },
	{ label: "Legs", groups: ["quads", "hamstrings", "glutes", "calves"] },
	{
		label: "Shoulders",
		groups: ["shoulders", "front delts", "side delts", "rear delts", "traps"],
	},
	{ label: "Arms", groups: ["biceps", "triceps", "forearms"] },
	{ label: "Core", groups: ["core"] },
];

const CATEGORIES = ["compound", "isolation"] as const;
const EQUIPMENT = [
	"barbell",
	"dumbbell",
	"cable",
	"bodyweight",
	"machine",
	"kettlebell",
	"band",
	"other",
] as const;

export const Route = createFileRoute("/exercises/")({
	component: ExercisesPageGuarded,
});

function ExercisesPageGuarded() {
	return (
		<>
			<SignedIn>
				<ExercisesPage />
			</SignedIn>
			<SignedOut>
				<RedirectToSignIn />
			</SignedOut>
		</>
	);
}

function ExercisesPage() {
	const exercises = useQuery(api.exercises.list) ?? [];
	const removeExercise = useMutation(api.exercises.remove);

	const [search, setSearch] = useState("");
	const [activeChip, setActiveChip] = useState<string | null>(null);
	const [filterCategory, setFilterCategory] = useState("");
	const [filterEquipment, setFilterEquipment] = useState("");
	const [modalOpen, setModalOpen] = useState(false);

	const activeChipFilter = CHIP_FILTERS.find((c) => c.label === activeChip);

	const filtered = useMemo(() => {
		return exercises
			.filter((ex) => {
				if (search && !ex.name.toLowerCase().includes(search.toLowerCase()))
					return false;
				if (
					activeChipFilter?.groups &&
					!ex.muscleGroups.some((mg) => activeChipFilter.groups?.includes(mg))
				)
					return false;
				if (filterCategory && ex.category !== filterCategory) return false;
				if (filterEquipment && ex.equipment !== filterEquipment) return false;
				return true;
			})
			.sort((a, b) => a.name.localeCompare(b.name));
	}, [exercises, search, activeChipFilter, filterCategory, filterEquipment]);

	return (
		<div className="p-4 sm:p-6 max-w-5xl mx-auto pb-20 sm:pb-6">
			<div className="flex items-center justify-between mb-4">
				<h1 className="text-xl font-bold text-white tracking-tight">
					Exercise Library
				</h1>
				<span className="text-xs text-[var(--text-muted)]">
					{exercises.length} exercises
				</span>
			</div>

			{/* Search */}
			<div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 mb-3">
				<Search size={14} className="text-[var(--text-muted)] shrink-0" />
				<input
					type="search"
					placeholder="Search exercises..."
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					className="flex-1 bg-transparent text-sm text-white placeholder:text-[var(--text-muted)] focus:outline-none"
				/>
			</div>

			{/* Muscle group chips */}
			<div className="flex gap-1.5 overflow-x-auto pb-1 mb-3 scrollbar-none">
				{CHIP_FILTERS.map((chip) => {
					const isActive =
						activeChip === chip.label ||
						(chip.label === "All" && activeChip === null);
					return (
						<button
							key={chip.label}
							type="button"
							onClick={() =>
								setActiveChip(chip.label === "All" ? null : chip.label)
							}
							className={cn(
								"shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold whitespace-nowrap transition-colors",
								isActive
									? "bg-[var(--accent)] text-black"
									: "bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] hover:text-white",
							)}
						>
							{chip.label}
							{isActive && chip.label !== "All" && (
								<span className="ml-1 opacity-70">✕</span>
							)}
						</button>
					);
				})}
			</div>

			{/* Category + Equipment dropdowns */}
			<div className="flex gap-2 mb-4">
				<select
					value={filterCategory}
					onChange={(e) => setFilterCategory(e.target.value)}
					className="flex-1 h-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-[11px] text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
				>
					<option value="">Category</option>
					{CATEGORIES.map((c) => (
						<option key={c} value={c} className="capitalize">
							{c.charAt(0).toUpperCase() + c.slice(1)}
						</option>
					))}
				</select>
				<select
					value={filterEquipment}
					onChange={(e) => setFilterEquipment(e.target.value)}
					className="flex-1 h-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-[11px] text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
				>
					<option value="">Equipment</option>
					{EQUIPMENT.map((eq) => (
						<option key={eq} value={eq} className="capitalize">
							{eq.charAt(0).toUpperCase() + eq.slice(1)}
						</option>
					))}
				</select>
			</div>

			{/* Card grid */}
			{filtered.length === 0 ? (
				<p className="text-sm text-[var(--text-muted)] text-center py-12">
					No exercises match your filters.
				</p>
			) : (
				<div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
					{filtered.map((ex) => (
						<Link
							key={ex._id}
							to="/exercises/$id"
							params={{ id: ex._id }}
							className="group block rounded-xl bg-[var(--surface)] border border-[var(--border)] p-3 hover:border-[var(--border-strong)] transition-colors"
						>
							<div className="flex items-start justify-between gap-1 mb-1">
								<p className="text-[13px] font-bold text-white leading-snug group-hover:text-[var(--accent)] transition-colors">
									{ex.name}
								</p>
								{!ex.isDefault && (
									<button
										type="button"
										onClick={(e) => {
											e.preventDefault();
											void removeExercise({ id: ex._id });
										}}
										className="p-0.5 text-[var(--text-muted)] hover:text-red-400 transition-colors shrink-0"
										aria-label={`Delete ${ex.name}`}
									>
										<Trash2 size={12} />
									</button>
								)}
							</div>
							<p className="text-[10px] text-[var(--text-muted)] mb-2 capitalize">
								{ex.equipment} · {ex.category}
							</p>
							<div className="flex flex-wrap gap-1">
								{ex.muscleGroups.slice(0, 3).map((mg) => (
									<span
										key={mg}
										className="rounded px-1 py-0.5 text-[9px] bg-[var(--accent-dim)] text-[var(--accent)] capitalize"
									>
										{mg}
									</span>
								))}
								{ex.muscleGroups.length > 3 && (
									<span className="rounded px-1 py-0.5 text-[9px] text-[var(--text-muted)]">
										+{ex.muscleGroups.length - 3}
									</span>
								)}
							</div>
						</Link>
					))}
				</div>
			)}

			{/* FAB */}
			<button
				type="button"
				onClick={() => setModalOpen(true)}
				className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-30 w-[52px] h-[52px] rounded-full bg-[var(--accent)] text-black flex items-center justify-center shadow-lg hover:bg-[var(--accent-hover)] transition-colors"
				aria-label="Add exercise"
			>
				<Plus size={24} strokeWidth={2.5} />
			</button>

			<AddExerciseModal open={modalOpen} onOpenChange={setModalOpen} />
		</div>
	);
}
