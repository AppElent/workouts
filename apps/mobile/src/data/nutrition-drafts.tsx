/** Saved Capture Drafts belong to Convex; editor input stays in its presentation. */
import { canonicalJson } from "@foundry/core";
import { useMutation } from "convex/react";
import {
	createContext,
	type ReactNode,
	use,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";
import { api } from "../convex/api";
import { usePausablePaginatedQuery, useQuery } from "../convex/query-cache";
import { mintUuid, useAccountWrite } from "./account-write";
import type {
	CaptureDraft,
	CaptureDraftInput,
	OtherDaysSummary,
} from "./nutrition-capture-draft";
import { useScreenQueryActive } from "./screen-query-active";

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
	const account = useAccountWrite();
	const { subject } = account;
	const saveRemote = useMutation(api.nutritionDrafts.save);
	const [records, setRecords] = useState<ReadonlyMap<string, CaptureDraft>>(
		new Map(),
	);
	const [revision, setRevision] = useState(0);
	const receive = useCallback(
		(drafts: CaptureDraft[], startDate?: string, endDate?: string) => {
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
			id: string | undefined,
			input?: CaptureDraftInput,
		) => {
			const saved = await account.send({
				identity: { kind: "captureDraft", action, id, input },
				prepare: () => id ?? mintUuid(),
				deliver: (draftId, { subject, operationId }) =>
					saveRemote({
						expectedSubject: subject,
						operationId,
						id: draftId,
						action,
						...(input ? { input } : {}),
					}).then((draft) => ({ draftId, draft })),
			});
			if (saved.draft) receive([saved.draft]);
			else
				setRecords((current) => {
					const next = new Map(current);
					next.delete(saved.draftId);
					return next;
				});
			setRevision((value) => value + 1);
			return saved.draft;
		},
		[account, saveRemote, receive],
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
				const saved = await write("create", undefined, input);
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
	const result = usePausablePaginatedQuery(
		api.nutritionDrafts.list,
		value.subject && range
			? { startDate: range.startDate, endDate: range.endDate }
			: "skip",
		{ initialNumItems: 50 },
		screenActive,
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
