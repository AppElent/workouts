import {
	canonicalJson,
	LIBRARY_GET_MANY_LIMIT,
	type LibraryCategory,
	type Locale,
} from "@foundry/core";
import { foodResults } from "@foundry/core/shipped-foods";
import { useConvex, useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
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
import {
	usePausablePaginatedQuery,
	useQueries,
	useQuery,
} from "../convex/query-cache";
import { mintUuid, useAccountWrite } from "./account-write";
import { foodPhotos } from "./food-photo-manager";
import { useFoodPhotoUpload } from "./nutrition-food-photo-upload";
import type { LibraryRecord } from "./nutrition-library-repository";
import type { PersonalFoodCache } from "./personal-food-cache";
import {
	type Combo,
	type ComboDraft,
	hasUnuploadedPhoto,
	normalizeComboDraft,
	normalizePersonalFoodDraft,
	type PersonalFood,
	type PersonalFoodDraft,
	type PersonalFoodFilter,
	portablePersonalFood,
} from "./personal-food-repository";
import {
	openPersonalFoodSession,
	type PersonalFoodSession,
} from "./personal-food-session";
import { useScreenQueryActive } from "./screen-query-active";

type PersonalFoodsValue = {
	loading: boolean;
	canLoadMore: boolean;
	loadMore(): void;
	revision: number;
	list(filter?: PersonalFoodFilter): PersonalFood[];
	find(id: string): PersonalFood | undefined;
	findByBarcode(barcode: string): PersonalFood | undefined;
	lookupBarcode(barcode: string): Promise<PersonalFood | undefined>;
	search(
		query: string,
		locale: Locale,
		filter?: PersonalFoodFilter,
	): PersonalFood[];
	forks(): PersonalFood[];
	findForkOf(shippedId: string): PersonalFood | undefined;
	create(draft: PersonalFoodDraft): Promise<PersonalFood>;
	update(id: string, draft: PersonalFoodDraft): Promise<PersonalFood>;
	/** Removes the food and, once that is saved, its photo file. */
	remove(id: string): Promise<boolean>;
	listCombos(): Combo[];
	findCombo(id: string): Combo | undefined;
	createCombo(draft: ComboDraft): Promise<Combo>;
	updateCombo(id: string, draft: ComboDraft): Promise<Combo>;
	removeCombo(id: string): Promise<boolean>;
	account: {
		subject?: string;
		isDeleted(id: string): boolean;
		uploadDevicePhotos(): Promise<void>;
		devicePhotoCount: number;
		/** Reads every library page, for a management action over all of it. */
		loadEntireLibrary(): Promise<void>;
	};
};

type PersonalFoodsContextValue = PersonalFoodsValue & {
	receiveServerPage(records: readonly LibraryRecord[]): void;
};

const PersonalFoodsContext = createContext<PersonalFoodsContextValue | null>(
	null,
);

type RecordWrite = {
	readonly id: string;
	readonly kind: LibraryRecord["kind"];
	readonly payload: string | null;
};

export function PersonalFoodsProvider({
	children,
	cache,
}: {
	children: ReactNode;
	/** Stands in for the account's session cache, as tests do. */
	cache?: PersonalFoodCache;
}) {
	const { subject } = useAccountWrite();
	return (
		<PersonalFoodsAccount
			key={subject ?? "signed-out"}
			subject={subject}
			suppliedCache={cache}
		>
			{children}
		</PersonalFoodsAccount>
	);
}

function PersonalFoodsAccount({
	children,
	subject,
	suppliedCache,
}: {
	children: ReactNode;
	subject?: string;
	suppliedCache?: PersonalFoodCache;
}) {
	const [session] = useState<PersonalFoodSession>(() =>
		suppliedCache
			? { cache: suppliedCache, close: () => {} }
			: openPersonalFoodSession(subject),
	);
	const { cache } = session;
	useEffect(() => () => session.close(), [session]);
	const [revision, setRevision] = useState(0);
	const changed = useCallback(() => setRevision((value) => value + 1), []);
	const client = useConvex();
	const saveMutation = useMutation(api.nutritionLibrary.save);
	const accountWrite = useAccountWrite();
	const uploadPhoto = useFoodPhotoUpload();
	const owner = useRef(subject);
	owner.current = subject;
	useEffect(() => {
		owner.current = subject;
		return () => {
			owner.current = undefined;
		};
	}, [subject]);
	const receiveServerPage = useCallback(
		(records: readonly LibraryRecord[]) => {
			for (const record of records)
				if (!record.subject || record.subject === subject)
					cache.receive(record);
			changed();
		},
		[cache, subject, changed],
	);
	const lookupBarcode = useCallback(
		async (barcode: string) => {
			if (!subject || !accountWrite.online)
				throw new Error("A connection is required to look up your library.");
			const records = await client.query(api.nutritionLibrary.getMany, {
				ids: cache
					.list()
					.filter((food) => food.provenance.barcode === barcode)
					.slice(0, LIBRARY_GET_MANY_LIMIT)
					.map((food) => food.id),
				barcode,
			});
			if (owner.current !== subject)
				throw new Error("The account changed while looking up this food.");
			const owned = records.filter((record) => record.subject === subject);
			receiveServerPage(owned);
			return owned
				.map((record) => cache.find(record.id))
				.find((food) => food?.provenance.barcode === barcode);
		},
		[client, subject, accountWrite.online, cache, receiveServerPage],
	);
	const saveRecord = useCallback(
		async (write: RecordWrite, remove = false) => {
			const record = { ...write, revision: cache.revisionOf(write.id) };
			const result = await accountWrite.send({
				identity: { record, remove },
				prepare: async () => {
					if (record.kind !== "food" || !record.payload) return record;
					let food: PersonalFood = JSON.parse(record.payload);
					if (food.visual?.kind === "photo" && hasUnuploadedPhoto(food)) {
						const uploaded = await uploadPhoto(food.visual.uri);
						food = { ...food, visual: { ...food.visual, ...uploaded } };
					}
					return {
						...record,
						payload: JSON.stringify(portablePersonalFood(food)),
					};
				},
				deliver: (portable, { subject: expectedSubject, operationId }) =>
					saveMutation({
						operationId,
						expectedSubject,
						operation: remove
							? {
									kind: "remove",
									recordId: portable.id,
									recordKind: portable.kind,
									expectedRevision: portable.revision,
								}
							: {
									kind: "upsert",
									record: {
										id: portable.id,
										kind: portable.kind,
										payload: portable.payload ?? "",
									},
									expectedRevision: portable.revision,
								},
					}),
			});
			cache.receive(result.record);
			changed();
		},
		[accountWrite, saveMutation, cache, uploadPhoto, changed],
	);
	const createCandidates = useRef(
		new Map<
			string,
			| PersonalFood
			| (Omit<Combo, "parts"> & {
					parts: readonly Omit<Combo["parts"][number], "status">[];
			  })
		>(),
	);

	const value = useMemo<PersonalFoodsContextValue>(() => {
		const savedFood = (id: string) => {
			const saved = cache.find(id);
			if (!saved)
				throw new Error("The acknowledged record could not be loaded.");
			return saved;
		};
		const savedCombo = (id: string) => {
			const saved = cache.findCombo(id);
			if (!saved)
				throw new Error("The acknowledged record could not be loaded.");
			return saved;
		};
		return {
			loading: false,
			canLoadMore: false,
			loadMore: () => {},
			revision,
			list: (filter) => cache.list(filter),
			find: (id) => cache.find(id),
			findByBarcode: (barcode) => cache.findByBarcode(barcode),
			lookupBarcode,
			search: (query, locale, filter) => cache.search(query, locale, filter),
			forks: () => cache.forks(),
			findForkOf: (shippedId) => cache.findForkOf(shippedId),
			create: async (draft) => {
				const timestamp = Date.now();
				const candidateKey = canonicalJson(draft);
				const food = (createCandidates.current.get(candidateKey) as
					| PersonalFood
					| undefined) ?? {
					...normalizePersonalFoodDraft(draft),
					id: mintUuid(),
					createdAt: timestamp,
					updatedAt: timestamp,
				};
				createCandidates.current.set(candidateKey, food);
				await saveRecord({
					id: food.id,
					kind: "food",
					payload: JSON.stringify(food),
				});
				createCandidates.current.delete(candidateKey);
				return savedFood(food.id);
			},
			update: async (id, draft) => {
				const current = cache.find(id);
				if (!current) throw new Error("Personal Food not found.");
				const food = {
					...normalizePersonalFoodDraft(draft),
					id,
					createdAt: current.createdAt,
					updatedAt: Date.now(),
				};
				await saveRecord({ id, kind: "food", payload: JSON.stringify(food) });
				const saved = savedFood(id);
				if (
					current.visual?.kind === "photo" &&
					(saved.visual?.kind !== "photo" ||
						current.visual.uri !== saved.visual.uri)
				)
					foodPhotos.remove(current.visual);
				return saved;
			},
			remove: async (id) => {
				const current = cache.find(id);
				if (!current) return false;
				await saveRecord({ id, kind: "food", payload: null }, true);
				foodPhotos.remove(current.visual);
				return true;
			},
			listCombos: () => cache.listCombos(),
			findCombo: (id) => cache.findCombo(id),
			createCombo: async (draft) => {
				const timestamp = Date.now();
				const valid = normalizeComboDraft(draft);
				const candidateKey = `combo:${canonicalJson(draft)}`;
				const combo = (createCandidates.current.get(candidateKey) as
					| Combo
					| undefined) ?? {
					...valid,
					parts: valid.parts.map((part) => ({
						...part,
						id: part.id ?? mintUuid(),
					})),
					id: mintUuid(),
					createdAt: timestamp,
					updatedAt: timestamp,
				};
				createCandidates.current.set(candidateKey, combo);
				await saveRecord({
					id: combo.id,
					kind: "combo",
					payload: JSON.stringify(combo),
				});
				createCandidates.current.delete(candidateKey);
				return savedCombo(combo.id);
			},
			updateCombo: async (id, draft) => {
				const current = cache.findCombo(id);
				if (!current) throw new Error("Combo not found.");
				const valid = normalizeComboDraft(draft);
				const combo = {
					...current,
					...valid,
					parts: valid.parts.map((part) => ({
						...part,
						id: part.id ?? mintUuid(),
					})),
					updatedAt: Date.now(),
				};
				await saveRecord({ id, kind: "combo", payload: JSON.stringify(combo) });
				return savedCombo(id);
			},
			removeCombo: async (id) => {
				if (!cache.findCombo(id)) return false;
				await saveRecord({ id, kind: "combo", payload: null }, true);
				return true;
			},
			account: {
				...(subject ? { subject } : {}),
				isDeleted: (id) => cache.isDeleted(id),
				devicePhotoCount: cache.list().filter(hasUnuploadedPhoto).length,
				uploadDevicePhotos: async () => {
					const localPhotos = cache.list().filter(hasUnuploadedPhoto);
					for (
						let offset = 0;
						offset < localPhotos.length;
						offset += LIBRARY_GET_MANY_LIMIT
					) {
						const records = await client.query(api.nutritionLibrary.getMany, {
							ids: localPhotos
								.slice(offset, offset + LIBRARY_GET_MANY_LIMIT)
								.map((food) => food.id),
						});
						if (owner.current !== subject)
							throw new Error("The account changed while updating photos.");
						receiveServerPage(records);
					}
					for (const food of cache.list().filter(hasUnuploadedPhoto))
						await saveRecord({
							id: food.id,
							kind: "food",
							payload: JSON.stringify(food),
						});
				},
				loadEntireLibrary: async () => {
					let cursor: string | null = null;
					for (;;) {
						const page: FunctionReturnType<typeof api.nutritionLibrary.browse> =
							await client.query(api.nutritionLibrary.browse, {
								query: "",
								paginationOpts: { cursor, numItems: 100 },
							});
						if (owner.current !== subject)
							throw new Error("The account changed while loading the library.");
						receiveServerPage(page.page);
						if (page.isDone) return;
						cursor = page.continueCursor;
					}
				},
			},
			receiveServerPage,
		};
	}, [
		cache,
		client,
		lookupBarcode,
		receiveServerPage,
		revision,
		saveRecord,
		subject,
	]);

	return <PersonalFoodsContext value={value}>{children}</PersonalFoodsContext>;
}

export function usePersonalFoods(options?: {
	browse?: { query?: string; category?: LibraryCategory };
	ids?: readonly string[];
	forkIds?: readonly string[];
	/** Warm only the shipped matches displayed by the picker, after search debounce. */
	forkSearch?: { locale: Locale; limit?: number };
	barcode?: string;
	active?: boolean;
}): PersonalFoodsValue {
	const value = use(PersonalFoodsContext);
	if (!value) {
		throw new Error(
			"usePersonalFoods must be used within <PersonalFoodsProvider>",
		);
	}
	const [settledQuery, setSettledQuery] = useState(
		options?.browse?.query ?? "",
	);
	const query = options?.browse?.query ?? "";
	useEffect(() => {
		const timer = setTimeout(() => setSettledQuery(query), 300);
		return () => clearTimeout(timer);
	}, [query]);
	const screenActive = useScreenQueryActive();
	const subscribed = !!value.account.subject && options?.active !== false;
	const enabled = subscribed && screenActive;
	const browse = usePausablePaginatedQuery(
		api.nutritionLibrary.browse,
		subscribed && options?.browse
			? {
					query: settledQuery.trim(),
					...(options.browse.category
						? { category: options.browse.category }
						: {}),
				}
			: "skip",
		{ initialNumItems: 50 },
		screenActive,
	);
	let ids = [...new Set(options?.ids ?? [])].sort();
	const allForkIds = [
		...new Set([
			...(options?.forkIds ?? []),
			...(options?.forkSearch
				? foodResults({
						query: settledQuery,
						locale: options.forkSearch.locale,
						scope: "all",
						localMatches: [],
						localFoods: [],
						limit: options.forkSearch.limit ?? 100,
					}).flatMap((result) =>
						result.kind === "shipped" ? [result.food.id] : [],
					)
				: []),
		]),
	].sort();
	const forkIds = allForkIds.slice(0, LIBRARY_GET_MANY_LIMIT);
	const extraForkQueries: Record<
		string,
		{
			query: typeof api.nutritionLibrary.getMany;
			args: { ids: string[]; forkIds: string[] };
		}
	> = {};
	if (enabled)
		for (
			let offset = LIBRARY_GET_MANY_LIMIT;
			offset < allForkIds.length;
			offset += LIBRARY_GET_MANY_LIMIT
		) {
			const chunk = allForkIds.slice(offset, offset + LIBRARY_GET_MANY_LIMIT);
			extraForkQueries[String(offset)] = {
				query: api.nutritionLibrary.getMany,
				args: {
					forkIds: chunk,
					ids: value
						.forks()
						.filter((food) => chunk.includes(food.provenance.forkedFrom ?? ""))
						.slice(0, LIBRARY_GET_MANY_LIMIT)
						.map((food) => food.id)
						.sort(),
				},
			};
		}
	const requestedIds = [
		...new Set([
			...ids,
			...value
				.forks()
				.filter((food) => forkIds.includes(food.provenance.forkedFrom ?? ""))
				.map((food) => food.id),
		]),
	];
	ids = requestedIds.slice(0, LIBRARY_GET_MANY_LIMIT).sort();
	if (enabled)
		for (
			let offset = LIBRARY_GET_MANY_LIMIT;
			offset < requestedIds.length;
			offset += LIBRARY_GET_MANY_LIMIT
		)
			extraForkQueries[`cached:${offset}`] = {
				query: api.nutritionLibrary.getMany,
				args: {
					ids: requestedIds
						.slice(offset, offset + LIBRARY_GET_MANY_LIMIT)
						.sort(),
					forkIds: [],
				},
			};
	const extraForkArgsKey = canonicalJson(
		Object.fromEntries(
			Object.entries(extraForkQueries).map(([key, request]) => [
				key,
				request.args,
			]),
		),
	);
	const stableExtraForkQueries = useMemo(
		() =>
			Object.fromEntries(
				Object.entries(
					JSON.parse(extraForkArgsKey) as Record<
						string,
						{ ids: string[]; forkIds: string[] }
					>,
				).map(([key, args]) => [
					key,
					{ query: api.nutritionLibrary.getMany, args },
				]),
			),
		[extraForkArgsKey],
	);
	const extraForkResults = useQueries(stableExtraForkQueries);
	const extraRecords = Object.values(extraForkResults).flatMap((result) => {
		if (result instanceof Error) throw result;
		return Array.isArray(result) ? result : [];
	});
	const details = useQuery(
		api.nutritionLibrary.getMany,
		enabled && (ids.length || forkIds.length || options?.barcode)
			? {
					ids,
					...(forkIds.length ? { forkIds } : {}),
					...(options?.barcode ? { barcode: options.barcode } : {}),
				}
			: "skip",
	);
	const key = canonicalJson([
		...(subscribed && options?.browse ? browse.results : []),
		...(enabled && Array.isArray(details) ? details : []),
		...extraRecords,
	]);
	const receive = value.receiveServerPage;
	const receivedKey = useRef("");
	useEffect(() => {
		const receiptKey = `${value.account.subject}:${key}`;
		if (receivedKey.current === receiptKey) return;
		const records = JSON.parse(key) as LibraryRecord[];
		if (records.length) receive(records);
		receivedKey.current = receiptKey;
	}, [key, receive, value.account.subject]);
	const visibleIds = new Set(
		browse.results
			.filter(
				(record) =>
					!record.deleted &&
					(!record.subject || record.subject === value.account.subject),
			)
			.map((record) => record.id),
	);
	// Stays bounded while the screen is hidden, so the list it returns to is
	// the one it left.
	const bounded = !!options?.browse && subscribed;
	const sourcesResolved =
		enabled &&
		ids.length === 1 &&
		Array.isArray(details) &&
		details.every(
			(record) => !record.subject || record.subject === value.account.subject,
		);
	const resolveCombo = (combo: Combo): Combo => ({
		...combo,
		parts: combo.parts.map((part) => ({
			...part,
			status:
				part.status === "unloaded" &&
				part.reference.kind === "personal" &&
				(value.account.isDeleted(part.reference.foodId) ||
					(sourcesResolved && ids[0] === combo.id))
					? "missing"
					: part.status,
		})),
	});
	const { receiveServerPage: _receive, ...foods } = value;
	return {
		...foods,
		loading:
			Object.values(extraForkResults).some((result) => result === undefined) ||
			(key !== "[]" &&
				receivedKey.current !== `${value.account.subject}:${key}`) ||
			(bounded &&
				(browse.status === "LoadingFirstPage" || query !== settledQuery)) ||
			(!!(ids.length || forkIds.length || options?.barcode) &&
				enabled &&
				details === undefined),
		canLoadMore: bounded && browse.status === "CanLoadMore",
		loadMore: () => {
			if (browse.status === "CanLoadMore") browse.loadMore(50);
		},
		list: (filter) =>
			value.list(filter).filter((food) => !bounded || visibleIds.has(food.id)),
		search: (query, locale, filter) =>
			(bounded
				? value.list(filter)
				: value.search(query, locale, filter)
			).filter((food) => !bounded || visibleIds.has(food.id)),
		listCombos: () =>
			value
				.listCombos()
				.filter((combo) => !bounded || visibleIds.has(combo.id))
				.map(resolveCombo),
		findCombo: (id) => {
			const combo = value.findCombo(id);
			return combo ? resolveCombo(combo) : undefined;
		},
	};
}
