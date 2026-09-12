import { useAuth } from "@clerk/expo";
import { useConvexConnectionState, useMutation } from "convex/react";
import {
	createContext,
	type ReactNode,
	use,
	useCallback,
	useEffect,
	useMemo,
	useState,
	useSyncExternalStore,
} from "react";
import { api } from "../convex/api";
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
import {
	type Combo,
	type ComboDraft,
	openPersonalFoodRepository,
	type PersonalFood,
	type PersonalFoodDraft,
	type PersonalFoodRepository,
} from "./personal-food-repository";

type PersonalFoodsValue = {
	revision: number;
	list(): PersonalFood[];
	find(id: string): PersonalFood | undefined;
	findByBarcode(barcode: string): PersonalFood | undefined;
	search(query: string, locale: "en" | "nl"): PersonalFood[];
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
}: {
	children: ReactNode;
	repository?: PersonalFoodRepository;
	backup: BackupControls;
}) {
	const [repository] = useState(
		() => suppliedRepository ?? openPersonalFoodRepository(),
	);
	const [revision, setRevision] = useState(0);
	const changed = useCallback(() => setRevision((value) => value + 1), []);

	const value = useMemo<PersonalFoodsValue>(
		() => ({
			revision,
			list: () => repository.list(),
			find: (id) => repository.find(id),
			findByBarcode: (barcode) => repository.findByBarcode(barcode),
			search: (query, locale) => repository.search(query, locale),
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
		[backup, changed, repository, revision],
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
	const enabled = subject && state ? state.isEnabled(subject) : false;
	const legacyOwner = state?.legacyClaimedBy();
	const accountRepository = useMemo(
		() =>
			suppliedRepository ??
			openPersonalFoodRepository(
				subject && (enabled || legacyOwner !== undefined)
					? nutritionLibraryDatabaseName(subject)
					: undefined,
			),
		[enabled, legacyOwner, subject, suppliedRepository],
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
					accountRepository.list().length ||
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
					accountRepository.replaceFromBackup(legacy);
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
		[accountRepository, enabled, service, state, subject, syncSnapshot],
	);
	return (
		<PersonalFoodsScope
			key={`${subject ?? "legacy"}:${enabled ? "account" : "legacy"}:${settingsVersion}`}
			repository={accountRepository}
			backup={backup}
		>
			{children}
		</PersonalFoodsScope>
	);
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
