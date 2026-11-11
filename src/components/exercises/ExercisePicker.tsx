import { filterExercises } from "@foundry/core";
import type { Exercise } from "@foundry/core/exercises";
import { useMemo, useState } from "react";
import { useExercises } from "#/lib/exercises";

/** A searchable list of every exercise; `onSelect` receives the pick. */
export function ExercisePicker({
	onSelect,
	autoFocus = false,
}: {
	onSelect: (exercise: Exercise) => void;
	autoFocus?: boolean;
}) {
	const exercises = useExercises();
	const [query, setQuery] = useState("");
	const matches = useMemo(
		() => filterExercises(exercises, { query }),
		[exercises, query],
	);

	return (
		<div className="flex flex-col">
			<div className="border-b border-[var(--border)] p-3">
				<input
					// biome-ignore lint/a11y/noAutofocus: the picker opens to search
					autoFocus={autoFocus}
					type="search"
					aria-label="Search exercises"
					placeholder="Search exercises…"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-3 text-sm text-white placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
				/>
			</div>
			<div className="max-h-72 divide-y divide-[var(--border)] overflow-y-auto">
				{matches.map((exercise) => (
					<button
						key={exercise._id}
						type="button"
						onClick={() => onSelect(exercise)}
						className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-white/5"
					>
						<span className="text-sm text-white">{exercise.name}</span>
						<span className="ml-2 text-xs capitalize text-[var(--text-muted)]">
							{exercise.equipment}
						</span>
					</button>
				))}
				{matches.length === 0 && (
					<p className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">
						No exercises found.
					</p>
				)}
			</div>
		</div>
	);
}
