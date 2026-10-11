import { useAuth } from "@clerk/expo";
import { canonicalJson } from "@workouts/core";
import { foodResults } from "@workouts/core/nutrition";
import {
	useConvex,
	useConvexConnectionState,
	useMutation,
	usePaginatedQuery,
	useQueries,
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
	useSyncExternalStore,
} from "react";
import { api } from "../convex/api";
import { migrateDeviceRecipes } from "./legacy-recipe-migration";
import {
	applyLibraryRecord,
	type LibraryRecord,
	type NutritionLibraryStateRepository,
	nutritionLibraryDatabaseName,
	openNutritionLibraryStateRepository,
} from "./nutrition-library-repository";
import {
	type NutritionLibraryOperationEnvelope,
	NutritionLibraryService,
} from "./nutrition-library-service";
import { mintNutritionUuid } from "./nutrition-operation-service";
import { personalFoodLibraryView } from "./personal-food-library-view";
import {
	type Combo,
	type ComboDraft,
	openPersonalFoodRepository,
	type PersonalFood,
	type PersonalFoodDraft,
	type PersonalFoodFilter,
	type PersonalFoodRepository,
	portablePersonalFood,
	validateComboDraft,
	validatePersonalFoodDraft,
} from "./personal-food-repository";
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
		hasLegacy: boolean;
		operations: readonly {
			operationId: string;
			status: string;
			lastError?: string;
		}[];
		importLegacy(): void;
		uploadPending(): Promise<void>;
		isDeleted(id: string): boolean;
		retry(): void;
		receiveServerPage(records: readonly LibraryRecord[]): void;
	};
};

const PersonalFoodsContext = createContext<PersonalFoodsValue | null>(null);

type AccountControls = PersonalFoodsValue["account"];

function PersonalFoodsScope({
	children,
	repository: suppliedRepository,
	account,
	remoteRevision = 0,
	saveRecord,
	lookupBarcode,
}: {
	children: ReactNode;
	repository?: PersonalFoodRepository;
	account: AccountControls;
	lookupBarcode(barcode: string): Promise<PersonalFood | undefined>;
	remoteRevision?: number;
	saveRecord: (
		record: LibraryRecord,
		remove?: boolean,
	) => Promise<LibraryRecord>;
}) {
	const [repository] = useState(
		() => suppliedRepository ?? openPersonalFoodRepository(),
	);
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
										...(food.visual?.kind === "photo"
											? { visual: food.visual }
											: {}),
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
										...(food.visual?.kind === "photo"
											? { visual: food.visual }
											: {}),
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
	legacyRepository: suppliedLegacyRepository,
}: {
	children: ReactNode;
	repository?: PersonalFoodRepository;
	/** Tests inject this alongside `repository`; production opens durable SQLite. */
	libraryState?: NutritionLibraryStateRepository;
	/** Public migration seam: an unowned device library separate from the account cache. */
	legacyRepository?: PersonalFoodRepository;
}) {
	const { isSignedIn, userId } = useAuth();
	const subject = isSignedIn ? userId : undefined;
	const state = useMemo(
		() =>
			libraryState ??
			(suppliedRepository ? undefined : openNutritionLibraryStateRepository()),
		[libraryState, suppliedRepository],
	);

	const [restoredRevision, setRestoredRevision] = useState(0);
	const onPageRestored = useCallback(
		() => setRestoredRevision((value) => value + 1),
		[],
	);
	const enabled = !!subject && !!state;
	const legacyOwner = state?.legacyClaimedBy();
	const legacyRepository = useMemo(
		() =>
			suppliedLegacyRepository ??
			suppliedRepository ??
			openPersonalFoodRepository(),
		[suppliedLegacyRepository, suppliedRepository],
	);
	const account = useMemo(() => {
		if (suppliedRepository || !subject)
			return {
				repository: suppliedRepository ?? legacyRepository,
				migratedIds: [] as readonly string[],
			};
		const repository = openPersonalFoodRepository(
			nutritionLibraryDatabaseName(subject),
			{ partialCache: true },
		);
		const migratedIds = migrateDeviceRecipes(subject, repository, [
			...legacyRepository.list().map((food) => food.id),
			...legacyRepository.listCombos().map((combo) => combo.id),
			...(state?.listRecords(subject).map((record) => record.id) ?? []),
		]);
		return { repository, migratedIds };
	}, [legacyRepository, state, subject, suppliedRepository]);
	const accountRepository = account.repository;
	const visibleRepository = useMemo(
		() =>
			subject && !enabled && legacyOwner === undefined && !suppliedRepository
				? personalFoodLibraryView(legacyRepository, accountRepository)
				: subject
					? accountRepository
					: legacyRepository,
		[
			accountRepository,
			enabled,
			legacyOwner,
			legacyRepository,
			subject,
			suppliedRepository,
		],
	);
	const client = useConvex();
	const applyMutation = useMutation(api.nutritionLibrary.migrateOperation);
	const onlineMutation = useMutation(api.nutritionLibrary.save);
	const remote = useCallback(
		(envelope: NutritionLibraryOperationEnvelope) => applyMutation(envelope),
		[applyMutation],
	);
	const service = useMemo(
		() =>
			enabled && subject && state
				? new NutritionLibraryService(
						subject,
						state,
						accountRepository,
						remote,
						true,
					)
				: undefined,
		[accountRepository, enabled, remote, state, subject],
	);
	const serviceVersion = useSyncExternalStore(
		service ? service.subscribe : () => () => {},
		service ? service.getVersion : () => 0,
		() => 0,
	);
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
			if (service) service.receiveServerPage(owned);
			else
				for (const record of owned)
					applyLibraryRecord(accountRepository, record);
			onPageRestored();
		},
		[service, accountRepository, onPageRestored, subject],
	);
	const lookupBarcode = useCallback(
		async (barcode: string) => {
			if (!subject || !isWebSocketConnected)
				throw new Error("A connection is required to look up your library.");
			const records = await client.query(api.nutritionLibrary.getMany, {
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
			const portableRecord =
				record.kind === "food" && record.payload
					? {
							...record,
							payload: JSON.stringify(
								portablePersonalFood(
									JSON.parse(record.payload) as PersonalFood,
								),
							),
						}
					: record;
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
								schemaVersion: 2,
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
			retryOperations.current.delete(retryKey);
			return accepted;
		},
		[subject, isWebSocketConnected, onlineMutation, state, accountRepository],
	);

	useEffect(() => {
		service?.setOnline(isWebSocketConnected);
	}, [isWebSocketConnected, service]);
	useEffect(() => () => service?.dispose(), [service]);
	const syncSnapshot = useMemo(
		() => ({
			version: serviceVersion,
			operations: service?.getOperations() ?? [],
		}),
		[service, serviceVersion],
	);
	const accountControls = useMemo<AccountControls>(
		() => ({
			...(subject ? { subject } : {}),
			hasLegacy:
				(!legacyOwner || legacyOwner === subject) &&
				[...legacyRepository.list(), ...legacyRepository.listCombos()].some(
					(record) =>
						!subject || !state?.getRecord(subject, `device:${record.id}`),
				),
			operations: syncSnapshot.operations,
			isDeleted: (id) => !!(subject && state?.getRecord(subject, id)?.deleted),
			importLegacy: () => {
				if (!service || !subject || !enabled) {
					throw new Error("Sign in before importing this device library.");
				}
				if (!state?.claimLegacy(subject)) {
					throw new Error(
						"This device library was already imported by another account.",
					);
				}
				const original = legacyRepository.exportBackup();
				// Retrying a partially completed claim copies only records not journaled yet.
				// Acknowledged edits and tombstones must never be replaced by the original.
				const exported = {
					foods: original.foods.filter(
						(food) => !state.getRecord(subject, `device:${food.id}`),
					),
					combos: original.combos.filter(
						(combo) => !state.getRecord(subject, `device:${combo.id}`),
					),
				};
				const ids = new Set(original.foods.map((food) => food.id));
				const legacy = {
					foods: exported.foods.map((food) => ({
						...food,
						id: `device:${food.id}`,
					})),
					combos: exported.combos.map((combo) => ({
						...combo,
						id: `device:${combo.id}`,
						parts: combo.parts.map((part) =>
							part.reference.kind === "personal" &&
							ids.has(part.reference.foodId)
								? {
										...part,
										reference: {
											...part.reference,
											foodId: `device:${part.reference.foodId}`,
										},
										snapshot: {
											...part.snapshot,
											provenance: {
												...part.snapshot.provenance,
												sourceId: `device:${part.reference.foodId}`,
											},
										},
									}
								: part,
						),
					})),
				};
				const preparations = [
					...legacy.foods.map((food) => ({
						transactionId: service.prepareUpsert(food.id, "food"),
						kind: "food" as const,
						value: food,
					})),
					...legacy.combos.map((combo) => ({
						transactionId: service.prepareUpsert(combo.id, "combo"),
						kind: "combo" as const,
						value: combo,
					})),
				];
				let localCommitted = false;
				try {
					accountRepository.replaceFromBackup(
						{
							foods: [
								...legacy.foods,
								...accountRepository
									.list()
									.filter(
										(food) => !legacy.foods.some((item) => item.id === food.id),
									),
							],
							combos: legacy.combos,
						},
						{ merge: true, preserveLocalPhotos: true },
					);
					localCommitted = true;
					for (const prepared of preparations) {
						if (prepared.kind === "food")
							service.commitFood(
								prepared.transactionId,
								prepared.value as PersonalFood,
							);
						else
							service.commitCombo(
								prepared.transactionId,
								prepared.value as Combo,
							);
					}
					void service.replay();
				} catch (error) {
					if (!localCommitted) {
						for (const prepared of preparations)
							service.discardPrepared(prepared.transactionId);
					}
					throw error;
				}
			},
			retry: () => void service?.replay(),
			uploadPending: async () => {
				if (!service) throw new Error("Sign in before uploading local data.");
				await service.uploadPending();
			},
			receiveServerPage,
		}),
		[
			legacyRepository,
			accountRepository,
			enabled,
			service,
			state,
			legacyOwner,
			subject,
			syncSnapshot,
			receiveServerPage,
		],
	);
	return (
		<PersonalFoodsScope
			key={subject ?? "signed-out"}
			repository={visibleRepository}
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
			args: { ids: string[]; forkIds: string[] };
		}
	> = {};
	if (enabled)
		for (let offset = 100; offset < allForkIds.length; offset += 100) {
			const chunk = allForkIds.slice(offset, offset + 100);
			extraForkQueries[String(offset)] = {
				query: api.nutritionLibrary.getMany,
				args: {
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
