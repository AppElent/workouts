import { useAuth } from "@clerk/expo";
import {
	canonicalJson,
	type NutritionDiaryOperation,
	type NutritionDiarySnapshot,
	type NutritionMealSlot,
	type NutritionOperationEnvelope,
	type NutritionOperationTarget,
} from "@foundry/core";
import type {
	DiaryNutrientCorrection,
	NutrientKey,
} from "@foundry/core/nutrition";
import { useConvexConnectionState, useMutation } from "convex/react";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useSyncExternalStore,
} from "react";
import { AppState } from "react-native";
import { api } from "../convex/api";
import type { DiaryEntry, MealSlot } from "./nutrition-day";
import {
	type FoodPhotoUpload,
	prepareDiaryPhotoOperation,
	useFoodPhotoUpload,
} from "./nutrition-food-photo-upload";
import {
	type CachedGoalHistory,
	type DirectFoodUse,
	type NutritionLocalRepository,
	type NutritionOperationResult,
	openNutritionLocalRepository,
} from "./nutrition-local-repository";

type RemoteApply = (
	envelope: NutritionOperationEnvelope,
	includeDays?: boolean,
) => Promise<NutritionOperationResult | undefined>;

type ServiceOptions = {
	readonly repository?: NutritionLocalRepository;
	readonly subject?: string;
	readonly uploadPhoto?: FoodPhotoUpload;
};

export function mintNutritionUuid(): string {
	if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
	const bytes = new Uint8Array(16);
	if (globalThis.crypto?.getRandomValues)
		globalThis.crypto.getRandomValues(bytes);
	else
		for (let index = 0; index < bytes.length; index += 1) {
			bytes[index] = Math.floor(Math.random() * 256);
		}
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
		.join("")
		.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
}

export class NutritionOperationService {
	private readonly listeners = new Set<() => void>();
	private activeSubject: string | undefined;
	private version = 0;
	private online = false;
	private readonly onlineRetries = new Map<
		string,
		NutritionOperationEnvelope
	>();

	constructor(
		private readonly repository: NutritionLocalRepository,
		private readonly remoteApply: RemoteApply,
	) {}

	subscribe = (listener: () => void) => {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	};

	private notify() {
		this.version += 1;
		for (const listener of this.listeners) listener();
	}

	getVersion = () => this.version;

	setSubject(subject: string | undefined) {
		if (this.activeSubject === subject) return;
		this.activeSubject = subject;
		this.onlineRetries.clear();
		this.notify();
	}
	setOnline(online: boolean) {
		this.online = online;
	}
	dispose() {
		this.activeSubject = undefined;
		this.onlineRetries.clear();
	}

	accept(
		subject: string,
		operation: NutritionDiaryOperation,
		directFoodUse?: DirectFoodUse,
		onError?: (error: unknown) => void,
		onSuccess?: () => void,
	): string {
		if (subject !== this.activeSubject)
			throw new Error("Unauthorized nutrition account.");
		if (!this.online) throw new Error("A connection is required to save.");
		let envelope: NutritionOperationEnvelope = {
			version: 1,
			operationId: mintNutritionUuid(),
			expectedSubject: subject,
			operation,
		};
		// Input stays in the editor; only its retry identity lives here until ACK.
		const withoutGeneratedIds = (entry: NutritionDiarySnapshot) => {
			const { clientEntryId: _id, comboGroup, ...input } = entry;
			return {
				...input,
				...(comboGroup
					? {
							comboGroup: {
								comboId: comboGroup.comboId,
								name: comboGroup.name,
							},
						}
					: {}),
			};
		};
		const retryKey = canonicalJson({
			subject,
			operation:
				operation.kind === "create"
					? {
							kind: operation.kind,
							entry: withoutGeneratedIds(operation.entry),
						}
					: operation.kind === "createBatch"
						? {
								...operation,
								entries: operation.entries.map((entry) =>
									withoutGeneratedIds({
										...entry,
										date: operation.date,
										meal: operation.meal,
									}),
								),
							}
						: operation.kind === "group"
							? {
									...operation,
									comboGroup: {
										comboId: operation.comboGroup.comboId,
										name: operation.comboGroup.name,
									},
								}
							: operation,
		});
		envelope = this.onlineRetries.get(retryKey) ?? envelope;
		this.onlineRetries.set(retryKey, envelope);
		void this.remoteApply(envelope, false)
			.then((result) => {
				if (!result) throw new Error("Missing nutrition operation receipt.");
				// Keep completion under its original owner, even after account changes.
				// These are acknowledged records, never an outbox for new offline input.
				this.repository.recordAcknowledged(
					subject,
					envelope,
					result,
					directFoodUse,
				);
				this.onlineRetries.delete(retryKey);
				if (subject === this.activeSubject) {
					this.notify();
					onSuccess?.();
				}
			})
			.catch((error: unknown) => {
				if (subject === this.activeSubject) onError?.(error);
			});
		return envelope.operationId;
	}

	getProjectedDay(subject: string, date: string) {
		return this.repository.projectDay(subject, date);
	}

	getGoals(subject: string, date: string) {
		return this.repository.getGoals(subject, date);
	}

	getSupplementaryServings(subject: string, foodId: string) {
		return this.repository.getSupplementaryServings(subject, foodId);
	}
	cacheSupplementaryServings(
		subject: string,
		foodId: string,
		servings: readonly import("@foundry/core/nutrition").SupplementaryServing[],
	) {
		if (
			canonicalJson(
				this.repository.getSupplementaryServings(subject, foodId),
			) === canonicalJson(servings)
		)
			return;
		this.repository.putSupplementaryServings(subject, foodId, servings);
		this.notify();
	}
	getPersonalMeasures(subject: string) {
		return this.repository.getPersonalMeasures(subject);
	}

	cachePersonalMeasures(
		subject: string,
		measures: readonly import("@foundry/core/nutrition").PersonalMeasure[],
	) {
		if (
			canonicalJson(this.repository.getPersonalMeasures(subject)) ===
			canonicalJson(measures)
		)
			return;
		this.repository.putPersonalMeasures(subject, measures);
		this.notify();
	}

	cacheGoals(subject: string, date: string, history: CachedGoalHistory) {
		if (
			canonicalJson(this.repository.getGoals(subject, date)) ===
			canonicalJson(history)
		)
			return;
		this.repository.putGoals(subject, date, history);
		this.notify();
	}

	cacheGoalDisplayOrder(subject: string, displayOrder: NutrientKey[]) {
		if (
			canonicalJson(this.repository.getGoalDisplayOrder(subject)) ===
			canonicalJson(displayOrder)
		)
			return;
		this.repository.putGoalDisplayOrder(subject, displayOrder);
		this.notify();
	}

	getSubject() {
		return this.activeSubject;
	}

	cacheServerDay(
		subject: string,
		day: NutritionOperationResult["days"][number],
	) {
		const entries = day.entries.map((entry) => ({
			...entry,
			date: entry.date ?? day.date,
		}));
		const current = this.repository.getDay(subject, day.date);
		if (
			current &&
			current.revision === day.revision &&
			canonicalJson(current.entries) === canonicalJson(entries)
		) {
			return;
		}
		this.repository.putDay(subject, {
			subject,
			date: day.date,
			revision: day.revision,
			complete: true,
			entries,
			updatedAt: Date.now(),
		});
		this.notify();
	}

	getOperations(subject: string) {
		return this.repository.listOperations(subject);
	}

	listRecent(subject: string) {
		return this.repository.listRecent(subject);
	}

	listFavorites(subject: string) {
		return this.repository.listFavorites(subject);
	}

	getShortcut(subject: string, sourceKey: string) {
		return this.repository.getShortcut(subject, sourceKey);
	}

	toggleFavorite(subject: string, sourceKey: string, favorite: boolean) {
		this.repository.toggleFavorite(subject, sourceKey, favorite);
		this.notify();
	}

	create(
		subject: string,
		snapshot: NutritionDiarySnapshot,
		directFoodUse?: DirectFoodUse,
		onError?: (error: unknown) => void,
		onSuccess?: () => void,
	) {
		return this.accept(
			subject,
			{
				kind: "create",
				entry: {
					...snapshot,
					clientEntryId: snapshot.clientEntryId ?? mintNutritionUuid(),
				},
			},
			directFoodUse,
			onError,
			onSuccess,
		);
	}

	createBatch(
		subject: string,
		date: string,
		meal: NutritionMealSlot,
		entries: readonly (NutritionDiarySnapshot & { clientEntryId: string })[],
		onError?: (error: unknown) => void,
		onSuccess?: () => void,
	) {
		return this.accept(
			subject,
			{
				kind: "createBatch",
				date,
				meal,
				entries: entries.map(({ date: _date, meal: _meal, ...entry }) => entry),
			},
			undefined,
			onError,
			onSuccess,
		);
	}

	group(
		subject: string,
		date: string,
		meal: NutritionMealSlot,
		targets: readonly NutritionOperationTarget[],
		comboGroup: { id: string; comboId: string; name: string },
		onError?: (error: unknown) => void,
		onSuccess?: () => void,
	) {
		const uniqueTargets = new Set(
			targets.map((target) => `${target.kind}:${target.id}`),
		);
		const projectedEntries = this.repository.projectDay(subject, date).entries;
		const entries = targets.map((target) =>
			projectedEntries.find((entry) =>
				target.kind === "serverId"
					? entry._id === target.id
					: entry.clientEntryId === target.id,
			),
		);
		if (
			targets.length < 1 ||
			targets.length > 100 ||
			uniqueTargets.size !== targets.length ||
			entries.some((entry) => !entry || entry.meal !== meal)
		) {
			throw new Error(
				"Every diary entry must be available in the same Meal Slot.",
			);
		}
		const selectedEntries = entries.filter(
			(entry): entry is NonNullable<typeof entry> => entry !== undefined,
		);
		const selectedIds = new Set(selectedEntries.map((entry) => entry._id));
		const existingGroupIds = new Set(
			selectedEntries
				.map((entry) => entry.comboGroup?.id)
				.filter((id): id is string => id !== undefined),
		);
		if (
			projectedEntries.some(
				(entry) =>
					entry.comboGroup &&
					existingGroupIds.has(entry.comboGroup.id) &&
					!selectedIds.has(entry._id),
			)
		) {
			throw new Error("Existing Logged Combos must be selected as a whole.");
		}
		return this.accept(
			subject,
			{
				kind: "group",
				targets: targets,
				comboGroup,
			},
			undefined,
			onError,
			onSuccess,
		);
	}

	update(
		subject: string,
		target: NutritionOperationTarget,
		patch: {
			correction?: DiaryNutrientCorrection;
			quantity?: number;
			selection?: {
				serving: { en: string; nl: string };
				quantity: number;
				amount: number;
				personalMeasureId: string | null;
			};
			date?: string;
			meal?: "breakfast" | "lunch" | "dinner" | "snacks";
		},
		onError?: (error: unknown) => void,
		onSuccess?: () => void,
	) {
		return this.accept(
			subject,
			{ kind: "update", target, ...patch },
			undefined,
			onError,
			onSuccess,
		);
	}

	remove(
		subject: string,
		target: NutritionOperationTarget,
		onError?: (error: unknown) => void,
		onSuccess?: () => void,
	) {
		return this.accept(
			subject,
			{ kind: "remove", target },
			undefined,
			onError,
			onSuccess,
		);
	}

	removeBatch(
		subject: string,
		targets: readonly NutritionOperationTarget[],
		onError?: (error: unknown) => void,
		onSuccess?: () => void,
	) {
		return this.accept(
			subject,
			{ kind: "removeBatch", targets },
			undefined,
			onError,
			onSuccess,
		);
	}

	moveBatch(
		subject: string,
		targets: readonly NutritionOperationTarget[],
		date: string,
		meal: NutritionMealSlot,
		onError?: (error: unknown) => void,
		onSuccess?: () => void,
	) {
		return this.accept(
			subject,
			{ kind: "moveBatch", targets, date, meal },
			undefined,
			onError,
			onSuccess,
		);
	}
}

const NutritionOperationsContext =
	createContext<NutritionOperationService | null>(null);

export function NutritionOperationsProvider({
	children,
	repository,
	subject,
	uploadPhoto,
}: ServiceOptions & { readonly children: ReactNode }) {
	const auth = useAuth();
	const account =
		subject ?? (auth.isSignedIn ? (auth.userId ?? undefined) : undefined);
	return (
		<NutritionOperationsSession
			key={account ?? "signed-out"}
			repository={repository}
			uploadPhoto={uploadPhoto}
			subject={account}
		>
			{children}
		</NutritionOperationsSession>
	);
}

function NutritionOperationsSession({
	children,
	repository,
	subject: forcedSubject,
	uploadPhoto: suppliedUploadPhoto,
}: ServiceOptions & { readonly children: ReactNode }) {
	const { isSignedIn, userId } = useAuth();
	const { isWebSocketConnected } = useConvexConnectionState();
	const applyOperation = useMutation(api.nutritionDiary.applyOperation);
	const uploadPhoto = useFoodPhotoUpload();
	const local = useMemo(
		() => repository ?? openNutritionLocalRepository(),
		[repository],
	);
	const subject =
		forcedSubject ?? (isSignedIn ? (userId ?? undefined) : undefined);
	const currentSubject = useRef(subject);
	currentSubject.current = subject;
	const service = useMemo(() => {
		const created = new NutritionOperationService(
			local,
			async (envelope, includeDays) => {
				const operation = await prepareDiaryPhotoOperation(
					envelope.operation,
					suppliedUploadPhoto ?? uploadPhoto,
				);
				return (await applyOperation({
					...envelope,
					operation,
					...(includeDays === false ? { includeDays } : {}),
				} as never)) as NutritionOperationResult;
			},
		);
		// Known from the first render: consumers key account-scoped subtrees on
		// it, and a later change remounts the navigator they wrap.
		created.setSubject(currentSubject.current);
		return created;
	}, [applyOperation, local, uploadPhoto, suppliedUploadPhoto]);
	useEffect(() => {
		service.setSubject(subject);
		return () => {
			service.dispose();
			if (!repository) local.close();
		};
	}, [service, subject, repository, local]);
	useEffect(() => {
		service.setOnline(isWebSocketConnected);
		const subscription = AppState.addEventListener("change", (state) => {
			service.setOnline(state === "active" && isWebSocketConnected);
		});
		return () => subscription.remove();
	}, [service, isWebSocketConnected]);
	return (
		<NutritionOperationsContext.Provider value={service}>
			{children}
		</NutritionOperationsContext.Provider>
	);
}

export function useNutritionOperations() {
	const service = useContext(NutritionOperationsContext);
	if (!service) throw new Error("NutritionOperationsProvider is missing.");
	return service;
}

export function useNutritionOperationVersion(): number {
	const service = useNutritionOperations();
	return useSyncExternalStore(
		service.subscribe,
		service.getVersion,
		service.getVersion,
	);
}

export function snapshotFromDiaryEntry(
	entry: DiaryEntry,
	date: string,
	meal: MealSlot,
): NutritionDiarySnapshot {
	return {
		date,
		meal,
		name: entry.name,
		serving: entry.serving,
		quantity: entry.quantity,
		amount: entry.amount,
		baseUnit: entry.baseUnit,
		...(entry.visual ? { visual: entry.visual } : {}),
		...(entry.comboGroup ? { comboGroup: entry.comboGroup } : {}),
		...(entry.personalMeasureId
			? { personalMeasureId: entry.personalMeasureId }
			: {}),
		nutrients: entry.nutrients,
		provenance: entry.provenance,
		...(entry.estimated ? { estimated: true as const } : {}),
		...(entry.correctedNutrients
			? { correctedNutrients: entry.correctedNutrients }
			: {}),
	};
}
