import { useAuth } from "@clerk/expo";
import { canonicalJson } from "@foundry/core";
import { foodResults } from "@foundry/core/nutrition";
import {
	useConvex,
	useConvexConnectionState,
	useMutation,
	usePaginatedQuery,
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
import {
	useCachedQueries as useQueries,
	useCachedQuery as useQuery,
} from "../convex/query-cache";
import {
	type FoodPhotoUpload,
	useFoodPhotoUpload,
} from "./nutrition-food-photo-upload";
import {
	applyLibraryRecord,
	type LibraryRecord,
	type NutritionLibraryStateRepository,
	openNutritionLibraryStateRepository,
} from "./nutrition-library-repository";
import { mintNutritionUuid } from "./nutrition-operation-service";
import {
	type Combo,
	type ComboDraft,
	type PersonalFood,
	type PersonalFoodDraft,
	type PersonalFoodFilter,
	type PersonalFoodRepository,
	portablePersonalFood,
	validateComboDraft,
	validatePersonalFoodDraft,
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
		locale: "en" | "nl",
		filter?: PersonalFoodFilter,
	): PersonalFood[];
	forks(): PersonalFood[];
	findForkOf(shippedId: string): PersonalFood | undefined;
	create(draft: PersonalFoodDraft): Promise<PersonalFood>;
	update(id: string, draft: PersonalFoodDraft): Promise<PersonalFood>;
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
		receiveServerPage(records: readonly LibraryRecord[]): void;
	};
};

const PersonalFoodsContext = createContext<PersonalFoodsValue | null>(null);

type AccountControls = PersonalFoodsValue["account"];

function PersonalFoodsScope({
	children,
	repository,
	account,
	remoteRevision = 0,
	saveRecord,
	lookupBarcode,
}: {
	children: ReactNode;
	repository: PersonalFoodRepository;
	account: AccountControls;
	lookupBarcode(barcode: string): Promise<PersonalFood | undefined>;
	remoteRevision?: number;
	saveRecord: (
		record: LibraryRecord,
		remove?: boolean,
	) => Promise<LibraryRecord>;
}) {
	const [revision, setRevision] = useState(0);
	const createCandidates = useRef(
		new Map<
			string,
			| PersonalFood
			| (Omit<Combo, "parts"> & {
					parts: readonly Omit<Combo["parts"][number], "status">[];
			  })
		>(),
	);
	const changed = useCallback(() => setRevision((value) => value + 1), []);

	const value = useMemo<PersonalFoodsValue>(
		() => ({
			loading: false,
			canLoadMore: false,
			loadMore: () => {},
			revision: revision + remoteRevision,
			list: (filter) => repository.list(filter),
			find: (id) => repository.find(id),
			findByBarcode: (barcode) => repository.findByBarcode(barcode),
			lookupBarcode,
			search: (query, locale, filter) =>
				repository.search(query, locale, filter),
			forks: () => repository.forks(),
			findForkOf: (shippedId) => repository.findForkOf(shippedId),
			create: async (draft) => {
				const timestamp = Date.now();
				const candidateKey = canonicalJson(draft);
				const food = (createCandidates.current.get(candidateKey) as
					| PersonalFood
					| undefined) ?? {
					...validatePersonalFoodDraft(draft),
					id: mintNutritionUuid(),
					createdAt: timestamp,
					updatedAt: timestamp,
				};
				createCandidates.current.set(candidateKey, food);
				const record = await saveRecord({
					id: food.id,
					kind: "food",
					schemaVersion: 2,
					payload: JSON.stringify(food),
					revision: 0,
					deleted: false,
				});
				applyLibraryRecord(repository, record);
				repository.replaceFromBackup(
					{
						foods: record.payload
							? [
									{
										...JSON.parse(record.payload),
									},
								]
							: [],
						combos: [],
					},
					{ merge: true, preserveLocalPhotos: true },
				);
				createCandidates.current.delete(candidateKey);
				changed();
				const saved = repository.find(food.id);
				if (!saved)
					throw new Error("The acknowledged record could not be loaded.");
				return saved;
			},
			update: async (id, draft) => {
				const current = repository.find(id);
				if (!current) throw new Error("Personal Food not found.");
				const food = {
					...validatePersonalFoodDraft(draft),
					id,
					createdAt: current.createdAt,
					updatedAt: Date.now(),
				};
				const record = await saveRecord({
					id,
					kind: "food",
					schemaVersion: 2,
					payload: JSON.stringify(food),
					revision: 1,
					deleted: false,
				});
				applyLibraryRecord(repository, record);
				repository.replaceFromBackup(
					{
						foods: record.payload
							? [
									{
										...JSON.parse(record.payload),
									},
								]
							: [],
						combos: [],
					},
					{ merge: true, preserveLocalPhotos: true },
				);
				changed();
				const saved = repository.find(id);
				if (!saved)
					throw new Error("The acknowledged record could not be loaded.");
				return saved;
			},
			remove: async (id) => {
				if (!repository.find(id)) return false;
				const record = await saveRecord(
					{ id, kind: "food", revision: 1, payload: null, deleted: true },
					true,
				);
				applyLibraryRecord(repository, record);
				changed();
				return true;
			},
			listCombos: () => repository.listCombos(),
			findCombo: (id) => repository.findCombo(id),
			createCombo: async (draft) => {
				const timestamp = Date.now();
				const valid = validateComboDraft(draft);
				const candidateKey = `combo:${canonicalJson(draft)}`;
				const combo = (createCandidates.current.get(candidateKey) as
					| Combo
					| undefined) ?? {
					...valid,
					parts: valid.parts.map((part) => ({
						...part,
						id: part.id ?? mintNutritionUuid(),
					})),
					id: mintNutritionUuid(),
					createdAt: timestamp,
					updatedAt: timestamp,
				};
				createCandidates.current.set(candidateKey, combo);
				const record = await saveRecord({
					id: combo.id,
					kind: "combo",
					schemaVersion: 2,
					payload: JSON.stringify(combo),
					revision: 0,
					deleted: false,
				});
				applyLibraryRecord(repository, record);
				changed();
				createCandidates.current.delete(candidateKey);
				const saved = repository.findCombo(combo.id);
				if (!saved)
					throw new Error("The acknowledged record could not be loaded.");
				return saved;
			},
			updateCombo: async (id, draft) => {
				const current = repository.findCombo(id);
				if (!current) throw new Error("Combo not found.");
				const valid = validateComboDraft(draft);
				const combo = {
					...current,
					...valid,
					parts: valid.parts.map((part) => ({
						...part,
						id: part.id ?? mintNutritionUuid(),
					})),
					updatedAt: Date.now(),
				};
				const record = await saveRecord({
					id,
					kind: "combo",
					schemaVersion: 2,
					payload: JSON.stringify(combo),
					revision: 1,
					deleted: false,
				});
				applyLibraryRecord(repository, record);
				changed();
				const saved = repository.findCombo(id);
				if (!saved)
					throw new Error("The acknowledged record could not be loaded.");
				return saved;
			},
			removeCombo: async (id) => {
				if (!repository.findCombo(id)) return false;
				const record = await saveRecord(
					{ id, kind: "combo", revision: 1, payload: null, deleted: true },
					true,
				);
				applyLibraryRecord(repository, record);
				changed();
				return true;
			},
			account,
		}),
		[
			account,
			changed,
			remoteRevision,
			repository,
			revision,
			saveRecord,
			lookupBarcode,
		],
	);

	return <PersonalFoodsContext value={value}>{children}</PersonalFoodsContext>;
}

export function PersonalFoodsProvider({
	children,
	repository: suppliedRepository,
	libraryState,
	uploadPhoto,
}: {
	children: ReactNode;
	repository?: PersonalFoodRepository;
	libraryState?: NutritionLibraryStateRepository;
	uploadPhoto?: FoodPhotoUpload;
}) {
	const { isSignedIn, userId } = useAuth();
	const subject = isSignedIn ? userId : undefined;
	return (
		<PersonalFoodsAccount
			key={subject ?? "signed-out"}
			subject={subject}
			repository={suppliedRepository}
			libraryState={libraryState}
			uploadPhoto={uploadPhoto}
		>
			{children}
		</PersonalFoodsAccount>
	);
}

function PersonalFoodsAccount({
	children,
	subject,
	repository: suppliedRepository,
	libraryState,
	uploadPhoto: suppliedUploadPhoto,
}: {
	children: ReactNode;
	subject?: string;
	repository?: PersonalFoodRepository;
	libraryState?: NutritionLibraryStateRepository;
	uploadPhoto?: FoodPhotoUpload;
}) {
	const [state] = useState(
		() =>
			libraryState ??
			(suppliedRepository ? undefined : openNutritionLibraryStateRepository()),
	);
	const [session] = useState<PersonalFoodSession>(() =>
		suppliedRepository
			? {
					repository: suppliedRepository,
					acknowledged: () => {},
					close: () => {},
				}
			: openPersonalFoodSession(subject),
	);
	const accountRepository = session.repository;
	const [restoredRevision, setRestoredRevision] = useState(0);
	useEffect(
		() => () => {
			session.close();
			if (!libraryState) state?.close();
		},
		[session, state, libraryState],
	);
	const client = useConvex();
	const onlineMutation = useMutation(api.nutritionLibrary.save);
	const uploadPhoto = useFoodPhotoUpload();
	const { isWebSocketConnected } = useConvexConnectionState();
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
			const owned = records.filter(
				(record) => !record.subject || record.subject === subject,
			);
			for (const record of owned) {
				const current = subject
					? state?.getRecord(subject, record.id)
					: undefined;
				if (current && current.revision > record.revision) continue;
				applyLibraryRecord(accountRepository, record);
				if (subject) state?.commitServerRecord(subject, record);
				session.acknowledged(record);
			}
			setRestoredRevision((value) => value + 1);
		},
		[state, accountRepository, subject, session],
	);
	const lookupBarcode = useCallback(
		async (barcode: string) => {
			if (!subject || !isWebSocketConnected)
				throw new Error("A connection is required to look up your library.");
			const records = await client.query(api.nutritionLibrary.getMany, {
				photoVersion: 3,
				ids: accountRepository
					.list()
					.filter((food) => food.provenance.barcode === barcode)
					.slice(0, 100)
					.map((food) => food.id),
				barcode,
			});
			if (owner.current !== subject)
				throw new Error("The account changed while looking up this food.");
			receiveServerPage(records.filter((record) => record.subject === subject));
			return records
				.filter((record) => record.subject === subject)
				.map((record) => accountRepository.find(record.id))
				.find((food) => food?.provenance.barcode === barcode);
		},
		[
			client,
			subject,
			isWebSocketConnected,
			accountRepository,
			receiveServerPage,
		],
	);
	const retryOperations = useRef(new Map<string, string>());
	const saveRecord = useCallback(
		async (record: LibraryRecord, remove = false) => {
			if (!subject || !isWebSocketConnected)
				throw new Error("A connection is required to save.");
			let portableRecord = record;
			if (record.kind === "food" && record.payload) {
				let food: PersonalFood = JSON.parse(record.payload);
				if (food.visual?.kind === "photo" && !food.visual.storageId) {
					const uploaded = await (suppliedUploadPhoto ?? uploadPhoto)(
						food.visual.uri,
					);
					if (owner.current !== subject)
						throw new Error("The account changed while uploading a photo.");
					food = { ...food, visual: { ...food.visual, ...uploaded } };
				}
				portableRecord = {
					...record,
					payload: JSON.stringify(portablePersonalFood(food)),
				};
			}
			const retryKey = canonicalJson(portableRecord);
			const operationId =
				retryOperations.current.get(retryKey) ?? mintNutritionUuid();
			retryOperations.current.set(retryKey, operationId);
			const result = await onlineMutation({
				version: 1,
				operationId,
				expectedSubject: subject,
				operation: remove
					? {
							kind: "remove",
							recordId: record.id,
							recordKind: record.kind,
							expectedRevision: record.revision,
						}
					: {
							kind: "upsert",
							record: {
								id: record.id,
								kind: record.kind,
								payload: portableRecord.payload ?? "",
								schemaVersion: 3,
							},
							expectedRevision: record.revision,
						},
			});
			if (owner.current !== subject)
				throw new Error("The account changed while saving.");
			const current = state?.getRecord(subject, result.record.id);
			const accepted =
				current && current.revision > result.record.revision
					? current
					: result.record;
			applyLibraryRecord(accountRepository, accepted);
			state?.commitServerRecord(subject, accepted);
			session.acknowledged(accepted);
			retryOperations.current.delete(retryKey);
			return accepted;
		},
		[
			subject,
			isWebSocketConnected,
			onlineMutation,
			state,
			accountRepository,
			uploadPhoto,
			suppliedUploadPhoto,
			session,
		],
	);

	const accountControls = useMemo<AccountControls>(
		() => ({
			...(subject ? { subject } : {}),
			isDeleted: (id) => !!(subject && state?.getRecord(subject, id)?.deleted),
			devicePhotoCount: accountRepository
				.list()
				.filter(
					(food) => food.visual?.kind === "photo" && !food.visual.storageId,
				).length,
			uploadDevicePhotos: async () => {
				const localPhotos = accountRepository
					.list()
					.filter(
						(food) => food.visual?.kind === "photo" && !food.visual.storageId,
					);
				for (let offset = 0; offset < localPhotos.length; offset += 100) {
					const records = await client.query(api.nutritionLibrary.getMany, {
						ids: localPhotos.slice(offset, offset + 100).map((food) => food.id),
						photoVersion: 3,
					});
					if (owner.current !== subject)
						throw new Error("The account changed while updating photos.");
					receiveServerPage(records);
				}
				for (const food of accountRepository.list()) {
					if (food.visual?.kind !== "photo" || food.visual.storageId) continue;
					const revision = subject
						? state?.getRecord(subject, food.id)?.revision
						: undefined;
					await saveRecord({
						id: food.id,
						kind: "food",
						payload: JSON.stringify(food),
						revision: revision ?? 0,
						schemaVersion: 3,
						deleted: false,
					});
				}
				setRestoredRevision((value) => value + 1);
			},
			receiveServerPage,
		}),
		[subject, state, receiveServerPage, accountRepository, saveRecord, client],
	);

	return (
		<PersonalFoodsScope
			key={subject ?? "signed-out"}
			repository={accountRepository}
			account={accountControls}
			remoteRevision={restoredRevision}
			saveRecord={saveRecord}
			lookupBarcode={lookupBarcode}
		>
			{children}
		</PersonalFoodsScope>
	);
}

export function usePersonalFoods(options?: {
	browse?: { query?: string; category?: "food" | "recipe" | "combo" };
	ids?: readonly string[];
	forkIds?: readonly string[];
	/** Warm only the shipped matches displayed by the picker, after search debounce. */
	forkSearch?: { locale: "en" | "nl"; limit?: number };
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
	const enabled =
		!!value.account.subject && options?.active !== false && screenActive;
	const browse = usePaginatedQuery(
		api.nutritionLibrary.browse,
		enabled && options?.browse
			? {
					query: settledQuery.trim(),
					photoVersion: 3,
					...(options.browse.category
						? { category: options.browse.category }
						: {}),
				}
			: "skip",
		{ initialNumItems: 50 },
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
	const forkIds = allForkIds.slice(0, 100);
	const extraForkQueries: Record<
		string,
		{
			query: typeof api.nutritionLibrary.getMany;
			args: { ids: string[]; forkIds: string[]; photoVersion: 3 };
		}
	> = {};
	if (enabled)
		for (let offset = 100; offset < allForkIds.length; offset += 100) {
			const chunk = allForkIds.slice(offset, offset + 100);
			extraForkQueries[String(offset)] = {
				query: api.nutritionLibrary.getMany,
				args: {
					photoVersion: 3,
					forkIds: chunk,
					ids: value
						.forks()
						.filter((food) => chunk.includes(food.provenance.forkedFrom ?? ""))
						.slice(0, 100)
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
	ids = requestedIds.slice(0, 100).sort();
	if (enabled)
		for (let offset = 100; offset < requestedIds.length; offset += 100)
			extraForkQueries[`cached:${offset}`] = {
				query: api.nutritionLibrary.getMany,
				args: {
					photoVersion: 3,
					ids: requestedIds.slice(offset, offset + 100).sort(),
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
					photoVersion: 3,
					ids,
					...(forkIds.length ? { forkIds } : {}),
					...(options?.barcode ? { barcode: options.barcode } : {}),
				}
			: "skip",
	);
	const key = canonicalJson([
		...(enabled && options?.browse ? browse.results : []),
		...(enabled && Array.isArray(details) ? details : []),
		...extraRecords,
	]);
	const receive = value.account.receiveServerPage;
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
	const bounded = !!options?.browse && enabled;
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
	return {
		...value,
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
