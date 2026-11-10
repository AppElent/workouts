import { Show } from "@clerk/react";
import { api } from "@convex/_generated/api";
import {
	EQUIPMENT,
	type Equipment,
	EXERCISE_CATEGORIES,
	type ExerciseCategory,
	filterExercises,
	MUSCLE_GROUP_KEYS,
	type MuscleGroup,
} from "@foundry/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { CreateExerciseModal } from "#/components/exercises/CreateExerciseModal";
import { Select } from "#/components/ui/Select";
import { useExercises } from "#/lib/exercises";
import { cn } from "#/lib/utils";

const GROUP_LABELS: Record<MuscleGroup, string> = {
	chest: "Chest",
	back: "Back",
	legs: "Legs",
	shoulders: "Shoulders",
	arms: "Arms",
	core: "Core",
};

const capitalized = (value: string) =>
	value.charAt(0).toUpperCase() + value.slice(1);

export const Route = createFileRoute("/_app/exercises/")({
	component: ExercisesPage,
});

function ExercisesPage() {
	const exercises = useExercises();
	const removeExercise = useMutation(api.exercises.remove);

	const [search, setSearch] = useState("");
	const [group, setGroup] = useState<MuscleGroup | null>(null);
	const [category, setCategory] = useState<ExerciseCategory | "">("");
	const [equipment, setEquipment] = useState<Equipment | "">("");
	const [modalOpen, setModalOpen] = useState(false);

	const filtered = useMemo(
		() =>
			filterExercises(exercises, {
				query: search,
				groups: group ? [group] : [],
				equipment: equipment ? [equipment] : [],
				category: category || undefined,
			}),
		[exercises, search, group, category, equipment],
	);

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

			<div className="flex gap-1.5 overflow-x-auto pb-1 mb-3 scrollbar-none">
				{([null, ...MUSCLE_GROUP_KEYS] as const).map((key) => {
					const isActive = group === key;
					return (
						<button
							key={key ?? "all"}
							type="button"
							onClick={() => setGroup(isActive ? null : key)}
							className={cn(
								"shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold whitespace-nowrap transition-colors",
								isActive
									? "bg-[var(--accent)] text-black"
									: "bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] hover:text-white",
							)}
						>
							{key ? GROUP_LABELS[key] : "All"}
							{isActive && key && <span className="ml-1 opacity-70">✕</span>}
						</button>
					);
				})}
			</div>

			<div className="flex gap-2 mb-4">
				<Select
					aria-label="Filter by category"
					className="flex-1"
					value={category}
					onValueChange={(value) => setCategory(value as ExerciseCategory | "")}
					placeholder="Category"
					allLabel="All categories"
					options={EXERCISE_CATEGORIES.map((value) => ({
						value,
						label: capitalized(value),
					}))}
				/>
				<Select
					aria-label="Filter by equipment"
					className="flex-1"
					value={equipment}
					onValueChange={(value) => setEquipment(value as Equipment | "")}
					placeholder="Equipment"
					allLabel="All equipment"
					options={EQUIPMENT.map((value) => ({
						value,
						label: capitalized(value),
					}))}
				/>
			</div>

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
									<Show when="signed-in">
										<button
											type="button"
											onClick={(e) => {
												e.preventDefault();
												void removeExercise({ id: ex._id });
											}}
											className="p-0.5 text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors shrink-0"
											aria-label={`Delete ${ex.name}`}
										>
											<Trash2 size={12} />
										</button>
									</Show>
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

			<Show when="signed-in">
				<button
					type="button"
					onClick={() => setModalOpen(true)}
					className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-30 w-[52px] h-[52px] rounded-full bg-[var(--accent)] text-black flex items-center justify-center shadow-lg hover:bg-[var(--accent-hover)] transition-colors"
					aria-label="Add exercise"
				>
					<Plus size={24} strokeWidth={2.5} />
				</button>

				<CreateExerciseModal open={modalOpen} onOpenChange={setModalOpen} />
			</Show>
		</div>
	);
}
