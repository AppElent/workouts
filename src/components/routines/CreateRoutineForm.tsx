import { api } from "@convex/_generated/api";
import { useMutation } from "convex/react";
import { useState } from "react";
import { RoutineEditor } from "./RoutineEditor";

export function CreateRoutineForm() {
	const createRoutine = useMutation(api.routines.create);
	const [created, setCreated] = useState(0);

	return (
		<section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
			<h2 className="text-sm font-semibold text-text">Create Routine</h2>
			<RoutineEditor
				key={created}
				submitLabel="Save Routine"
				onSubmit={async (payload) => {
					await createRoutine(payload);
					setCreated((count) => count + 1);
				}}
			/>
		</section>
	);
}
