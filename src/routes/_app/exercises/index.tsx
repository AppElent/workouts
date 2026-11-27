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
	plural,
} from "@foundry/core";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { ExerciseFormModal } from "#/components/exercises/ExerciseFormModal";
import { useConfirm } from "#/components/ui/confirm-dialog";
import { Select } from "#/components/ui/Select";
import { useToast } from "#/components/ui/toast";
import { useConvexErrorMessage } from "#/lib/convexError";
import { useExercises } from "#/lib/exercises";
import { fmt, useI18n } from "#/lib/i18n";
import { muscleLabel } from "#/lib/muscles";
import { cn } from "#/lib/utils";

export const Route = createFileRoute("/_app/exercises/")({
	component: ExercisesPage,
});

function ExercisesPage() {
	const exercises = useExercises();
	const removeExercise = useMutation(api.exercises.remove);
	const toast = useToast();
	const errorMessage = useConvexErrorMessage();
	const confirm = useConfirm();
	const { locale, messages } = useI18n();
	const t = messages.exercise;
	const lib = t.library;

	async function handleRemove(id: string, name: string) {
		const ok = await confirm({
			title: fmt(lib.confirmTitle, { name }),
			description: lib.confirmDescription,
			confirmLabel: lib.confirmLabel,
			destructive: true,
		});
		if (!ok) return;
		try {
			await removeExercise({ id });
		} catch (error) {
			toast.error(lib.deleteFailed, errorMessage(error, lib.tryAgain));
		}
	}

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
				<h1 className="text-xl font-bold text-text tracking-tight">
					{lib.title}
				</h1>
				<span className="text-xs text-text-muted">
					{plural(locale, exercises.length, lib.count)}
				</span>
			</div>

			<div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 mb-3">
				<Search size={14} className="text-text-muted shrink-0" />
				<input
					type="search"
					placeholder={lib.search}
					aria-label={lib.search}
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					className="flex-1 bg-transparent text-sm text-text placeholder:text-text-muted focus:outline-none"
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
								"shrink-0 rounded-full px-3 py-1 text-eyebrow font-semibold whitespace-nowrap transition-colors",
								isActive
									? "bg-accent-fill text-on-accent"
									: "bg-surface border border-border text-text-muted hover:text-text",
							)}
						>
							{key ? lib.groups[key] : lib.allGroups}
							{isActive && key && <span className="ml-1 opacity-70">✕</span>}
						</button>
					);
				})}
			</div>

			<div className="flex gap-2 mb-4">
				<Select
					aria-label={lib.categoryFilter}
					className="flex-1"
					value={category}
					onValueChange={(value) => setCategory(value as ExerciseCategory | "")}
					placeholder={t.form.category}
					allLabel={lib.allCategories}
					options={EXERCISE_CATEGORIES.map((value) => ({
						value,
						label: t.category[value],
					}))}
				/>
				<Select
					aria-label={lib.equipmentFilter}
					className="flex-1"
					value={equipment}
					onValueChange={(value) => setEquipment(value as Equipment | "")}
					placeholder={t.form.equipment}
					allLabel={lib.allEquipment}
					options={EQUIPMENT.map((value) => ({
						value,
						label: t.equipment[value],
					}))}
				/>
			</div>

			{filtered.length === 0 ? (
				<p className="text-sm text-text-muted text-center py-12">{lib.empty}</p>
			) : (
				<div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
					{filtered.map((ex) => (
						<Link
							key={ex._id}
							to="/exercises/$id"
							params={{ id: ex._id }}
							className="group block rounded-xl bg-surface border border-border p-3 hover:border-border-strong transition-colors"
						>
							<div className="flex items-start justify-between gap-1 mb-1">
								<p className="text-label font-bold text-text leading-snug group-hover:text-accent-ink transition-colors">
									{ex.name}
								</p>
								{!ex.isDefault && (
									<Show when="signed-in">
										<button
											type="button"
											onClick={(e) => {
												e.preventDefault();
												void handleRemove(ex._id, ex.name);
											}}
											className="p-0.5 text-text-muted hover:text-danger transition-colors shrink-0"
											aria-label={fmt(lib.delete, { name: ex.name })}
										>
											<Trash2 size={12} />
										</button>
									</Show>
								)}
							</div>
							<p className="text-micro text-text-muted mb-2">
								{t.equipment[ex.equipment]} · {t.category[ex.category]}
							</p>
							<div className="flex flex-wrap gap-1">
								{ex.muscleGroups.slice(0, 3).map((mg) => (
									<span
										key={mg}
										className="rounded px-1 py-0.5 text-micro bg-accent-dim text-accent-ink"
									>
										{muscleLabel(mg, t.muscles)}
									</span>
								))}
								{ex.muscleGroups.length > 3 && (
									<span className="rounded px-1 py-0.5 text-micro text-text-muted">
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
					className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-30 w-[52px] h-[52px] rounded-full bg-accent-fill text-on-accent flex items-center justify-center shadow-lg hover:bg-accent-pressed transition-colors"
					aria-label={t.form.addTitle}
				>
					<Plus size={24} strokeWidth={2.5} />
				</button>

				<ExerciseFormModal open={modalOpen} onOpenChange={setModalOpen} />
			</Show>
		</div>
	);
}
