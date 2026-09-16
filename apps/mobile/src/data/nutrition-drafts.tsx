/**
 * Capture Drafts for the screens: the diary (rows and the other-days banner),
 * the food browser (save / resolve) and the weekly review (per-day count).
 *
 * The subject comes from the operation service so a draft is filed under the
 * same account as the Diary Entries it will become. Every write bumps a
 * revision so a diary sitting under the pushed browser re-reads on return.
 */
import {
	createContext,
	type ReactNode,
	use,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import {
	type CaptureDraft,
	type CaptureDraftInput,
	type NutritionDraftRepository,
	type OtherDaysSummary,
	openNutritionDraftRepository,
} from "./nutrition-draft-repository";
import type { NutritionLocalOperation } from "./nutrition-local-repository";
import {
	useNutritionOperations,
	useNutritionOperationVersion,
} from "./nutrition-operation-service";

/**
 * Whether any Diary Entry was accepted for the draft's day and meal at or
 * after `since`. This is the whole removal rule: a resolving session that
 * logged at least one entry has done the note's job, however many items the
 * note listed; one that logged nothing leaves the reminder in place.
 */
export function intakeLoggedSince(
	operations: readonly NutritionLocalOperation[],
	draft: Pick<CaptureDraft, "date" | "meal">,
	since: number,
): boolean {
	return operations.some((operation) => {
		if (operation.createdAt < since) return false;
		const change = operation.envelope.operation;
		if (change.kind === "create")
			return change.entry.date === draft.date && change.entry.meal === draft.meal;
		if (change.kind === "createBatch")
			return change.date === draft.date && change.meal === draft.meal;
		return false;
	});
}

export type NutritionDraftsValue = {
	readonly revision: number;
	listForDate(date: string): CaptureDraft[];
	summariseOtherDays(date: string): OtherDaysSummary;
	get(id: string): CaptureDraft | undefined;
	create(input: CaptureDraftInput): CaptureDraft;
	update(id: string, input: CaptureDraftInput): CaptureDraft;
	remove(id: string): boolean;
};

const NutritionDraftsContext = createContext<NutritionDraftsValue | undefined>(
	undefined,
);

const NO_SUMMARY: OtherDaysSummary = { count: 0, oldestDate: undefined };

export function NutritionDraftsProvider({
	children,
	repository: suppliedRepository,
}: {
	children: ReactNode;
	/** Tests inject an in-memory store; production opens the device database. */
	repository?: NutritionDraftRepository;
}) {
	const operations = useNutritionOperations();
	// The subject is set by an effect after mount, and announced by version.
	useNutritionOperationVersion();
	const subject = operations.getSubject();
	const [repository] = useState<NutritionDraftRepository>(
		() => suppliedRepository ?? openNutritionDraftRepository(),
	);
	const ownsRepository = suppliedRepository === undefined;
	useEffect(() => {
		if (!ownsRepository) return;
		return () => repository.close();
	}, [ownsRepository, repository]);
	const [revision, setRevision] = useState(0);
	const bump = useCallback(() => setRevision((value) => value + 1), []);

	const value = useMemo<NutritionDraftsValue>(
		() => ({
			revision,
			listForDate: (date) =>
				subject ? repository.listForDate(subject, date) : [],
			summariseOtherDays: (date) =>
				subject ? repository.summariseOtherDays(subject, date) : NO_SUMMARY,
			get: (id) => (subject ? repository.get(subject, id) : undefined),
			create: (input) => {
				if (!subject) throw new Error("Sign in to save a note.");
				const created = repository.create(subject, input);
				bump();
				return created;
			},
			update: (id, input) => {
				if (!subject) throw new Error("Sign in to edit a note.");
				const updated = repository.update(subject, id, input);
				bump();
				return updated;
			},
			remove: (id) => {
				if (!subject) return false;
				const removed = repository.remove(subject, id);
				if (removed) bump();
				return removed;
			},
		}),
		[bump, repository, revision, subject],
	);

	return (
		<NutritionDraftsContext value={value}>{children}</NutritionDraftsContext>
	);
}

export function useNutritionDrafts(): NutritionDraftsValue {
	const value = use(NutritionDraftsContext);
	if (!value) {
		throw new Error(
			"useNutritionDrafts must be used within <NutritionDraftsProvider>",
		);
	}
	return value;
}
