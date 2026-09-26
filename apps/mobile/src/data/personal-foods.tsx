import { useAuth } from "@clerk/expo";
import { useConvexConnectionState, useMutation, useQuery } from "convex/react";
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
	type LibraryConflict,
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
} from "./personal-food-repository";

type PersonalFoodsValue = {
	revision: number;
	list(filter?: PersonalFoodFilter): PersonalFood[];
	find(id: string): PersonalFood | undefined;
	findByBarcode(barcode: string): PersonalFood | undefined;
	search(
		query: string,
		locale: "en" | "nl",
		filter?: PersonalFoodFilter,
	): PersonalFood[];
	forks(): PersonalFood[];
	findForkOf(shippedId: string): PersonalFood | undefined;
	create(draft: PersonalFoodDraft): PersonalFood;
	update(id: string, draft: PersonalFoodDraft): PersonalFood;
	remove(id: string): boolean;
	listCombos(): Combo[];
	findCombo(id: string): Combo | undefined;
	createCombo(draft: ComboDraft): Combo;
	updateCombo(id: string, draft: ComboDraft): Combo;
	removeCombo(id: string): boolean;
	backup: {
		enabled: boolean;
		subject?: string;
		operations: readonly {
			operationId: string;
			status: string;
			lastError?: string;
		}[];
		conflicts: readonly LibraryConflict[];
		enable(): void;
		importLegacy(): void;
		retry(): void;
		restore(): void;
		restoreError: boolean;
		receiveServerPage(records: readonly LibraryRecord[]): void;
		keepDeviceCopy(conflict: LibraryConflict): void;
		useServerCopy(conflict: LibraryConflict): void;
		prepareUpsert?(id: string, kind: "food" | "combo"): string;
		prepareRemove?(id: string, kind: "food" | "combo"): string;
		commitFood?(transactionId: string, food: PersonalFood): void;
		commitCombo?(transactionId: string, combo: Combo): void;
		commitRemove?(
			transactionId: string,
			id: string,
			kind: "food" | "combo",
		): void;
		discardPrepared?(transactionId: string): void;
	};
};

const PersonalFoodsContext = createContext<PersonalFoodsValue | null>(null);

type BackupControls = PersonalFoodsValue["backup"];

function PersonalFoodsScope({
	children,
	repository: suppliedRepository,
	backup,
	remoteRevision = 0,
}: {
	children: ReactNode;
	repository?: PersonalFoodRepository;
	backup: BackupControls;
	remoteRevision?: number;
}) {
	const [repository] = useState(
		() => suppliedRepository ?? openPersonalFoodRepository(),
	);
	const [revision, setRevision] = useState(0);
	const changed = useCallback(() => setRevision((value) => value + 1), []);

	const value = useMemo<PersonalFoodsValue>(
		() => ({
			revision: revision + remoteRevision,
			list: (filter) => repository.list(filter),
			find: (id) => repository.find(id),
			findByBarcode: (barcode) => repository.findByBarcode(barcode),
			search: (query, locale, filter) =>
				repository.search(query, locale, filter),
			forks: () => repository.forks(),
			findForkOf: (shippedId) => repository.findForkOf(shippedId),
			create: (draft) => {
				const id = backup.enabled ? mintNutritionUuid() : undefined;
				const prepared = id ? backup.prepareUpsert?.(id, "food") : undefined;
				let localCommitted = false;
				let food: PersonalFood;
				try {
					food = repository.create(draft, id);
					localCommitted = true;
					if (prepared) backup.commitFood?.(prepared, food);
				} catch (error) {
					if (prepared && !localCommitted) backup.discardPrepared?.(prepared);
					throw error;
				}
				changed();
				return food;
			},
			update: (id, draft) => {
				const prepared = backup.enabled
					? backup.prepareUpsert?.(id, "food")
					: undefined;
				let localCommitted = false;
				let food: PersonalFood;
				try {
					food = repository.update(id, draft);
					localCommitted = true;
					if (prepared) backup.commitFood?.(prepared, food);
				} catch (error) {
					if (prepared && !localCommitted) backup.discardPrepared?.(prepared);
					throw error;
				}
				changed();
				return food;
			},
			remove: (id) => {
				const prepared = backup.enabled
					? backup.prepareRemove?.(id, "food")
					: undefined;
				let localCommitted = false;
				let removed: boolean;
				try {
					removed = repository.remove(id);
					localCommitted = removed;
					if (prepared && removed) backup.commitRemove?.(prepared, id, "food");
					if (prepared && !removed) backup.discardPrepared?.(prepared);
				} catch (error) {
					if (prepared && !localCommitted) backup.discardPrepared?.(prepared);
					throw error;
				}
				if (removed) {
					changed();
				}
				return removed;
			},
			listCombos: () => repository.listCombos(),
			findCombo: (id) => repository.findCombo(id),
			createCombo: (draft) => {
				const id = backup.enabled ? mintNutritionUuid() : undefined;
				const prepared = id ? backup.prepareUpsert?.(id, "combo") : undefined;
				let localCommitted = false;
				let combo: Combo;
				try {
					combo = repository.createCombo(draft, id);
					localCommitted = true;
					if (prepared) backup.commitCombo?.(prepared, combo);
				} catch (error) {
					if (prepared && !localCommitted) backup.discardPrepared?.(prepared);
					throw error;
				}
				changed();
				return combo;
			},
			updateCombo: (id, draft) => {
				const prepared = backup.enabled
					? backup.prepareUpsert?.(id, "combo")
					: undefined;
				let localCommitted = false;
				let combo: Combo;
				try {
					combo = repository.updateCombo(id, draft);
					localCommitted = true;
					if (prepared) backup.commitCombo?.(prepared, combo);
				} catch (error) {
					if (prepared && !localCommitted) backup.discardPrepared?.(prepared);
					throw error;
				}
				changed();
				return combo;
			},
			removeCombo: (id) => {
				const prepared = backup.enabled
					? backup.prepareRemove?.(id, "combo")
					: undefined;
				let localCommitted = false;
				let removed: boolean;
				try {
					removed = repository.removeCombo(id);
					localCommitted = removed;
					if (prepared && removed) backup.commitRemove?.(prepared, id, "combo");
					if (prepared && !removed) backup.discardPrepared?.(prepared);
				} catch (error) {
					if (prepared && !localCommitted) backup.discardPrepared?.(prepared);
					throw error;
				}
				if (removed) {
					changed();
				}
				return removed;
			},
			backup,
		}),
		[backup, changed, remoteRevision, repository, revision],
	);

	return <PersonalFoodsContext value={value}>{children}</PersonalFoodsContext>;
}

export function PersonalFoodsProvider({
	children,
	repository: suppliedRepository,
	libraryState,
}: {
	children: ReactNode;
	repository?: PersonalFoodRepository;
	/** Tests inject this alongside `repository`; production opens durable SQLite. */
	libraryState?: NutritionLibraryStateRepository;
}) {
	const { isSignedIn, userId } = useAuth();
	const subject = isSignedIn ? userId : undefined;
	const state = useMemo(
		() =>
			libraryState ??
			(suppliedRepository ? undefined : openNutritionLibraryStateRepository()),
		[libraryState, suppliedRepository],
	);
	const [settingsVersion, setSettingsVersion] = useState(0);
	const [restoreVersion, setRestoreVersion] = useState(0);
	const [restoreError, setRestoreError] = useState(false);
	const onRestoreError = useCallback(() => setRestoreError(true), []);
	const [restoredRevision, setRestoredRevision] = useState(0);
	const onPageRestored = useCallback(
		() => setRestoredRevision((value) => value + 1),
		[],
	);
	const enabled = subject && state ? state.isEnabled(subject) : false;
	const legacyOwner = state?.legacyClaimedBy();
	const legacyRepository = useMemo(
		() => suppliedRepository ?? openPersonalFoodRepository(),
		[suppliedRepository],
	);
	const account = useMemo(() => {
		if (suppliedRepository || !subject)
			return {
				repository: legacyRepository,
				migratedIds: [] as readonly string[],
			};
		const repository = openPersonalFoodRepository(
			nutritionLibraryDatabaseName(subject),
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
	const applyMutation = useMutation(api.nutritionLibrary.applyOperation);
	const remote = useCallback(
		(envelope: NutritionLibraryOperationEnvelope) => applyMutation(envelope),
		[applyMutation],
	);
	const service = useMemo(
		() =>
			enabled && subject && state
				? new NutritionLibraryService(subject, state, accountRepository, remote)
				: undefined,
		[accountRepository, enabled, remote, state, subject],
	);
	const serviceVersion = useSyncExternalStore(
		service ? service.subscribe : () => () => {},
		service ? service.getVersion : () => 0,
		() => 0,
	);
	const { isWebSocketConnected } = useConvexConnectionState();
	useEffect(() => {
		service?.setOnline(isWebSocketConnected);
	}, [isWebSocketConnected, service]);
	useEffect(() => () => service?.dispose(), [service]);
	const syncSnapshot = useMemo(
		() => ({
			version: serviceVersion,
			operations: service?.getOperations() ?? [],
			conflicts: service?.getConflicts() ?? [],
		}),
		[service, serviceVersion],
	);
	const backup = useMemo<BackupControls>(
		() => ({
			enabled,
			...(subject ? { subject } : {}),
			operations: syncSnapshot.operations,
			conflicts: syncSnapshot.conflicts,
			enable: () => {
				if (!subject)
					throw new Error("Sign in before enabling library backup.");
				if (!state)
					throw new Error("Backup state is unavailable in this test harness.");
				state.setEnabled(subject, true);
				setSettingsVersion((value) => value + 1);
			},
			importLegacy: () => {
				if (!service || !subject || !enabled) {
					throw new Error(
						"Enable backup before importing this device library.",
					);
				}
				if (
					accountRepository
						.list()
						.some((food) => !account.migratedIds.includes(food.id)) ||
					accountRepository.listCombos().length
				) {
					throw new Error("This account library already contains records.");
				}
				if (!state?.claimLegacy(subject)) {
					throw new Error(
						"This device library was already imported by another account.",
					);
				}
				const legacy = openPersonalFoodRepository().exportBackup();
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
					accountRepository.replaceFromBackup({
						foods: [
							...legacy.foods,
							...accountRepository
								.list()
								.filter(
									(food) => !legacy.foods.some((item) => item.id === food.id),
								),
						],
						combos: legacy.combos,
					});
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
				} catch (error) {
					if (!localCommitted) {
						for (const prepared of preparations)
							service.discardPrepared(prepared.transactionId);
					}
					throw error;
				}
			},
			retry: () => void service?.replay(),
			restore: () => {
				setRestoreError(false);
				setRestoreVersion((version) => version + 1);
			},
			restoreError,
			receiveServerPage: (records) => service?.receiveServerPage(records),
			keepDeviceCopy: (conflict) => service?.keepDeviceCopy(conflict),
			useServerCopy: (conflict) => service?.resolveServerConflict(conflict),
			prepareUpsert: (id, kind) => service?.prepareUpsert(id, kind) ?? "",
			prepareRemove: (id, kind) => service?.prepareRemove(id, kind) ?? "",
			commitFood: (transactionId, food) =>
				service?.commitFood(transactionId, food),
			commitCombo: (transactionId, combo) =>
				service?.commitCombo(transactionId, combo),
			commitRemove: (transactionId, id, kind) =>
				service?.commitRemove(transactionId, id, kind),
			discardPrepared: (transactionId) =>
				service?.discardPrepared(transactionId),
		}),
		[
			account,
			accountRepository,
			enabled,
			restoreError,
			service,
			state,
			subject,
			syncSnapshot,
		],
	);
	return (
		<>
			{service && subject ? (
				<LibraryRestore
					key={`${subject}:${restoreVersion}`}
					service={service}
					onError={onRestoreError}
					onPage={onPageRestored}
				/>
			) : null}
			<PersonalFoodsScope
				key={`${subject ?? "legacy"}:${enabled ? "account" : "legacy"}:${settingsVersion}`}
				repository={visibleRepository}
				backup={backup}
				remoteRevision={restoredRevision}
			>
				{children}
			</PersonalFoodsScope>
		</>
	);
}

/** Restore all server pages for the signed-in library, independent of Settings. */
function LibraryRestore({
	service,
	onError,
	onPage,
}: {
	service: NutritionLibraryService;
	onError: () => void;
	onPage: () => void;
}) {
	const [cursor, setCursor] = useState<string | null>(null);
	const received = useRef(new Set<string>());
	const result = useQuery(api.nutritionLibrary.list, {
		paginationOpts: { cursor, numItems: 50 },
	});
	useEffect(() => {
		if (!result || !("page" in result)) return;
		const key = `${cursor ?? "first"}:${result.continueCursor}:${result.page.map((record) => `${record.id}:${record.revision}`).join(",")}`;
		if (received.current.has(key)) return;
		try {
			received.current.add(key);
			service.receiveServerPage(result.page);
			onPage();
			if (!result.isDone) setCursor(result.continueCursor);
		} catch {
			received.current.delete(key);
			onError();
		}
	}, [cursor, onError, onPage, result, service]);
	return null;
}

export function usePersonalFoods(): PersonalFoodsValue {
	const value = use(PersonalFoodsContext);
	if (!value) {
		throw new Error(
			"usePersonalFoods must be used within <PersonalFoodsProvider>",
		);
	}
	return value;
}
