/** Saved Capture Drafts belong to Convex; editor input stays in its presentation. */
import { canonicalJson } from "@foundry/core";
import {
	useConvexConnectionState,
	useMutation,
	usePaginatedQuery,
	useQuery,
} from "convex/react";
import {
	createContext,
	type ReactNode,
	use,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { api } from "../convex/api";
import type {
	CaptureDraft,
	CaptureDraftInput,
	OtherDaysSummary,
} from "./nutrition-capture-draft";
import type { NutritionLocalOperation } from "./nutrition-local-repository";
import {
	mintNutritionUuid,
	useNutritionOperations,
	useNutritionOperationVersion,
} from "./nutrition-operation-service";
import { useScreenQueryActive } from "./screen-query-active";

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
		if (operation.status !== "acknowledged" || operation.createdAt < since)
			return false;
		const change = operation.envelope.operation;
		if (change.kind === "create")
			return (
				change.entry.date === draft.date && change.entry.meal === draft.meal
			);
		if (change.kind === "createBatch")
			return change.date === draft.date && change.meal === draft.meal;
		return false;
	});
}

export type NutritionDraftsValue = {
	readonly revision: number;
	readonly loading: boolean;
	listForDate(date: string): CaptureDraft[];
	summariseOtherDays(date: string): OtherDaysSummary;
	get(id: string): CaptureDraft | undefined;
	create(input: CaptureDraftInput): Promise<CaptureDraft>;
	update(id: string, input: CaptureDraftInput): Promise<CaptureDraft>;
	remove(id: string): Promise<boolean>;
};

type DraftScope = Omit<
	NutritionDraftsValue,
	"loading" | "summariseOtherDays"
> & {
	subject?: string;
	receive(drafts: CaptureDraft[], startDate?: string, endDate?: string): void;
};
const NutritionDraftsContext = createContext<DraftScope | undefined>(undefined);

export function NutritionDraftsProvider({ children }: { children: ReactNode }) {
	const operations = useNutritionOperations();
	useNutritionOperationVersion();
	const subject = operations.getSubject();
	return (
		<NutritionDraftScope key={subject ?? "signed-out"} subject={subject}>
			{children}
		</NutritionDraftScope>
	);
}

function NutritionDraftScope({
	children,
	subject,
}: {
	children: ReactNode;
	subject?: string;
}) {
	const operations = useNutritionOperations();
	const { isWebSocketConnected } = useConvexConnectionState();
	const saveRemote = useMutation(api.nutritionDrafts.save);
	const [records, setRecords] = useState<ReadonlyMap<string, CaptureDraft>>(
		new Map(),
	);
	const [revision, setRevision] = useState(0);
	const createIds = useRef(new Map<string, string>());
	const retryIds = useRef(new Map<string, string>());
	const active = useRef(true);
	useEffect(() => {
		active.current = true;
		return () => {
			active.current = false;
		};
	}, []);
	const receive = useCallback(
		(drafts: CaptureDraft[], startDate?: string, endDate?: string) => {
			if (!active.current) return;
			setRecords((current) => {
				const next = new Map(current);
				if (startDate && endDate)
					for (const [id, draft] of next)
						if (draft.date >= startDate && draft.date <= endDate)
							next.delete(id);
				for (const draft of drafts)
					if (draft.subject === subject) next.set(draft.id, draft);
				return canonicalJson([...next]) === canonicalJson([...current])
					? current
					: next;
			});
		},
		[subject],
	);
	const write = useCallback(
		async (
			action: "create" | "update" | "remove",
			id: string,
			input?: CaptureDraftInput,
		) => {
			if (!subject || !isWebSocketConnected)
				throw new Error("A connection is required to save.");
			const retryKey = canonicalJson({ action, id, input });
			const operationId = retryIds.current.get(retryKey) ?? mintNutritionUuid();
			retryIds.current.set(retryKey, operationId);
			const saved = await saveRemote({
				expectedSubject: subject,
				operationId,
				id,
				action,
				...(input ? { input } : {}),
			});
			if (!active.current || operations.getSubject() !== subject)
				throw new Error("The account changed while saving.");
			if (saved) receive([saved]);
			else
				setRecords((current) => {
					const next = new Map(current);
					next.delete(id);
					return next;
				});
			retryIds.current.delete(retryKey);
			setRevision((value) => value + 1);
			return saved;
		},
		[subject, isWebSocketConnected, saveRemote, operations, receive],
	);
	const value = useMemo<DraftScope>(
		() => ({
			subject,
			revision,
			receive,
			listForDate: (date) =>
				[...records.values()]
					.filter((draft) => draft.date === date)
					.sort((a, b) => a.createdAt - b.createdAt),
			get: (id) => records.get(id),
			create: async (input) => {
				const key = canonicalJson(input);
				const id = createIds.current.get(key) ?? mintNutritionUuid();
				createIds.current.set(key, id);
				const saved = await write("create", id, input);
				createIds.current.delete(key);
				if (!saved) throw new Error("Missing Capture Draft acknowledgement.");
				return saved;
			},
			update: async (id, input) => {
				const saved = await write("update", id, input);
				if (!saved) throw new Error("Missing Capture Draft acknowledgement.");
				return saved;
			},
			remove: async (id) => {
				await write("remove", id);
				return true;
			},
		}),
		[subject, records, revision, receive, write],
	);
	return (
		<NutritionDraftsContext value={value}>{children}</NutritionDraftsContext>
	);
}

/** Subscribe only to the dates this consumer displays; never download all notes. */
export function useNutritionDrafts(range?: {
	startDate: string;
	endDate: string;
	recordId?: string;
}): NutritionDraftsValue {
	const value = use(NutritionDraftsContext);
	if (!value)
		throw new Error(
			"useNutritionDrafts must be used within <NutritionDraftsProvider>",
		);
	const screenActive = useScreenQueryActive();
	const queryEnabled = !!value.subject && screenActive;
	const result = usePaginatedQuery(
		api.nutritionDrafts.list,
		queryEnabled && range
			? { startDate: range.startDate, endDate: range.endDate }
			: "skip",
		{ initialNumItems: 50 },
	);
	const summary = useQuery(
		api.nutritionDrafts.summary,
		queryEnabled && range ? { date: range.startDate } : "skip",
	);
	const byId = useQuery(
		api.nutritionDrafts.get,
		queryEnabled && range?.recordId ? { id: range.recordId } : "skip",
	);
	const pageKey = canonicalJson(result.results);
	const { receive } = value;
	const startDate = range?.startDate;
	const endDate = range?.endDate;
	useEffect(() => {
		if (
			!queryEnabled ||
			!startDate ||
			!endDate ||
			result.status === "LoadingFirstPage"
		)
			return;
		receive(
			JSON.parse(pageKey) as CaptureDraft[],
			result.status === "Exhausted" ? startDate : undefined,
			result.status === "Exhausted" ? endDate : undefined,
		);
	}, [pageKey, result.status, startDate, endDate, receive, queryEnabled]);
	useEffect(() => {
		if (queryEnabled && result.status === "CanLoadMore") result.loadMore(50);
	}, [result.status, result.loadMore, queryEnabled]);
	const draftKey = canonicalJson(byId ?? null);
	useEffect(() => {
		if (draftKey !== "null" && draftKey !== "[]")
			receive([JSON.parse(draftKey) as CaptureDraft]);
	}, [draftKey, receive]);
	return {
		...value,
		loading: result.status === "LoadingFirstPage",
		summariseOtherDays: (date) => {
			if (summary && "count" in summary && date === startDate)
				return {
					count: summary.count,
					oldestDate: summary.oldestDate ?? undefined,
				};
			return { count: 0, oldestDate: undefined };
		},
	};
}
