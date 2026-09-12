import { useAuth } from "@clerk/expo";
import {
	canonicalJson,
	type NutritionDiaryOperation,
	type NutritionDiarySnapshot,
	type NutritionMealSlot,
	type NutritionOperationEnvelope,
} from "@workouts/core";
import { useConvexConnectionState, useMutation } from "convex/react";
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
	useSyncExternalStore,
} from "react";
import { AppState } from "react-native";
import { api } from "../convex/api";
import type { DiaryEntry, MealSlot } from "./nutrition-day";
import {
	type CachedGoalHistory,
	type DirectFoodUse,
	type LocalProjectionHint,
	type NutritionLocalRepository,
	type NutritionOperationResult,
	openNutritionLocalRepository,
} from "./nutrition-local-repository";

type RemoteApply = (
	envelope: NutritionOperationEnvelope,
) => Promise<NutritionOperationResult | undefined>;

type LegacyFallback = () => Promise<unknown>;

type LegacyWriters = {
	readonly create?: (snapshot: unknown) => Promise<unknown>;
	readonly update?: (args: unknown) => Promise<unknown>;
	readonly remove?: (args: unknown) => Promise<unknown>;
	readonly combo?: (args: unknown) => Promise<unknown>;
};

type ServiceOptions = {
	readonly repository?: NutritionLocalRepository;
	readonly subject?: string;
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

function classifyError(error: unknown): "permanent" | "transient" {
	const message = error instanceof Error ? error.message : String(error);
	return /invalid|unauthorized|subject|conflict|already exists|different payload/i.test(
		message,
	)
		? "permanent"
		: "transient";
}

export class NutritionOperationService {
	private readonly fallbacks = new Map<string, LegacyFallback>();
	private readonly fallbackPromises = new Map<string, Promise<unknown>>();
	private readonly errorHandlers = new Map<string, (error: unknown) => void>();
	private readonly successHandlers = new Map<string, () => void>();
	private readonly listeners = new Set<() => void>();
	private activeSubject: string | undefined;
	private replaying = new Set<string>();
	private version = 0;
	private retryTimer: ReturnType<typeof setTimeout> | undefined;
	private online = true;

	constructor(
		private readonly repository: NutritionLocalRepository,
		private readonly remoteApply: RemoteApply,
		private readonly legacy: LegacyWriters = {},
		private readonly legacyCompatibility = false,
		private readonly allowTestFallback = false,
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
		clearTimeout(this.retryTimer);
		if (subject) {
			this.repository.recoverSending(subject);
			void this.replay(subject);
		}
		this.notify();
	}

	setOnline(online: boolean) {
		this.online = online;
		if (!online) clearTimeout(this.retryTimer);
		else if (this.activeSubject) void this.replay(this.activeSubject);
	}

	dispose() {
		this.activeSubject = undefined;
		clearTimeout(this.retryTimer);
	}

	accept(
		subject: string,
		operation: NutritionDiaryOperation,
		hint?: LocalProjectionHint,
		fallback?: LegacyFallback,
		directFoodUse?: DirectFoodUse,
		onError?: (error: unknown) => void,
		onSuccess?: () => void,
	): string {
		if (subject !== this.activeSubject)
			throw new Error("Unauthorized nutrition account.");
		const envelope: NutritionOperationEnvelope = {
			version: 1,
			operationId: mintNutritionUuid(),
			expectedSubject: subject,
			operation,
		};
		this.repository.accept(subject, envelope, hint, directFoodUse);
		if (fallback) this.fallbacks.set(envelope.operationId, fallback);
		if (this.legacyCompatibility && fallback) {
			try {
				this.fallbackPromises.set(
					envelope.operationId,
					Promise.resolve(fallback()),
				);
			} catch (error) {
				this.fallbackPromises.set(envelope.operationId, Promise.reject(error));
			}
		}
		if (this.legacyCompatibility) {
			if (onError) this.errorHandlers.set(envelope.operationId, onError);
			if (onSuccess) this.successHandlers.set(envelope.operationId, onSuccess);
		}
		this.notify();
		// Production callers finish at the SQLite commit, never at a network ACK.
		if (!this.legacyCompatibility) onSuccess?.();
		void this.replay(subject);
		return envelope.operationId;
	}

	async replay(subject: string): Promise<void> {
		if (
			!this.online ||
			subject !== this.activeSubject ||
			this.replaying.has(subject)
		)
			return;
		this.replaying.add(subject);
		try {
			for (const operation of this.repository.listOperations(subject)) {
				if (!this.online || subject !== this.activeSubject) break;
				if (operation.status !== "queued") continue;
				if (operation.nextAttemptAt > Date.now()) continue;
				if (this.isBlockedByPredecessor(subject, operation)) continue;
				this.repository.markSending(subject, operation.operationId);
				this.notify();
				try {
					let result = await this.remoteApply(operation.envelope);
					if (result === undefined) {
						if (!this.legacyCompatibility && !this.allowTestFallback)
							throw new Error("Missing nutrition operation receipt.");
						const fallback = this.fallbacks.get(operation.operationId);
						const fallbackResult = this.fallbackPromises.get(
							operation.operationId,
						);
						if (fallbackResult) await fallbackResult;
						else if (fallback) await fallback();
						result = { entryIds: [], clientEntryIds: [], days: [] };
					}
					this.repository.acknowledge(subject, operation.operationId, result);
					this.fallbacks.delete(operation.operationId);
					this.fallbackPromises.delete(operation.operationId);
					this.errorHandlers.delete(operation.operationId);
					this.successHandlers.get(operation.operationId)?.();
					this.successHandlers.delete(operation.operationId);
				} catch (error) {
					this.errorHandlers.get(operation.operationId)?.(error);
					if (classifyError(error) === "permanent") {
						this.repository.markNeedsAttention(
							subject,
							operation.operationId,
							error instanceof Error ? error.message : String(error),
						);
					} else {
						this.repository.markQueued(
							subject,
							operation.operationId,
							error instanceof Error ? error.message : String(error),
						);
					}
				}
				this.notify();
			}
		} finally {
			this.replaying.delete(subject);
			if (this.online && subject === this.activeSubject) {
				clearTimeout(this.retryTimer);
				const queued = this.repository
					.listOperations(subject)
					.filter(
						(operation) =>
							operation.status === "queued" &&
							!this.isBlockedByPredecessor(subject, operation),
					);
				if (queued.length) {
					const delay = Math.max(
						100,
						Math.min(...queued.map((operation) => operation.nextAttemptAt)) -
							Date.now(),
					);
					this.retryTimer = setTimeout(() => void this.replay(subject), delay);
				}
			}
		}
	}

	private isBlockedByPredecessor(
		subject: string,
		operation: { operationId: string; envelope: NutritionOperationEnvelope },
	) {
		const target =
			operation.envelope.operation.kind === "update" ||
			operation.envelope.operation.kind === "remove"
				? operation.envelope.operation.target
				: undefined;
		if (!target) return false;
		return this.repository.listOperations(subject).some((candidate) => {
			if (
				candidate.operationId === operation.operationId ||
				candidate.sequence >
					(this.repository.getOperation(subject, operation.operationId)
						?.sequence ?? 0)
			)
				return false;
			const created = candidate.envelope.operation;
			if (
				(created.kind === "update" || created.kind === "remove") &&
				created.target.kind === target.kind &&
				created.target.id === target.id
			)
				return candidate.status !== "acknowledged";
			const ids =
				created.kind === "create"
					? [created.entry.clientEntryId]
					: created.kind === "createBatch"
						? created.entries.map((entry) => entry.clientEntryId)
						: [];
			return (
				target.kind === "clientEntryId" &&
				ids.includes(target.id) &&
				candidate.status !== "acknowledged"
			);
		});
	}

	getProjectedDay(subject: string, date: string) {
		return this.repository.projectDay(subject, date);
	}

	getGoals(subject: string, date: string) {
		return this.repository.getGoals(subject, date);
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

	retry(subject: string, operationId: string) {
		const operation = this.repository.getOperation(subject, operationId);
		if (!operation) return;
		this.repository.markQueued(subject, operationId);
		void this.replay(subject);
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
			undefined,
			this.legacy.create
				? () => this.legacy.create?.(snapshot) as Promise<unknown>
				: undefined,
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
			this.legacy.combo
				? () =>
						this.legacy.combo?.({
							date,
							meal,
							combo: entries[0]?.comboGroup
								? {
										id: entries[0].comboGroup.comboId,
										name: entries[0].comboGroup.name,
									}
								: { id: "copy", name: "Copied meal" },
							parts: entries.map(
								({ clientEntryId: _id, date: _date, meal: _meal, ...entry }) =>
									entry,
							),
						}) as Promise<unknown>
				: undefined,
			undefined,
			onError,
			onSuccess,
		);
	}

	update(
		subject: string,
		target:
			| { kind: "serverId"; id: string }
			| { kind: "clientEntryId"; id: string },
		patch: {
			quantity?: number;
			date?: string;
			meal?: "breakfast" | "lunch" | "dinner" | "snacks";
		},
		hint?: LocalProjectionHint,
		onError?: (error: unknown) => void,
		onSuccess?: () => void,
	) {
		return this.accept(
			subject,
			{
				kind: "update",
				target: target.id.startsWith("client:")
					? { kind: "clientEntryId", id: target.id.slice(7) }
					: target,
				...patch,
			},
			hint,
			target.kind === "serverId" && this.legacy.update
				? () =>
						this.legacy.update?.({
							id: target.id,
							...patch,
						}) as Promise<unknown>
				: undefined,
			undefined,
			onError,
			onSuccess,
		);
	}

	remove(
		subject: string,
		target: { kind: "serverId" | "clientEntryId"; id: string },
		hint?: LocalProjectionHint,
		onError?: (error: unknown) => void,
		onSuccess?: () => void,
	) {
		return this.accept(
			subject,
			{
				kind: "remove",
				target: target.id.startsWith("client:")
					? { kind: "clientEntryId", id: target.id.slice(7) }
					: (target as
							| { kind: "serverId"; id: string }
							| { kind: "clientEntryId"; id: string }),
			},
			hint,
			this.legacy.remove
				? () => this.legacy.remove?.({ id: target.id }) as Promise<unknown>
				: undefined,
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
}: ServiceOptions & { readonly children: ReactNode }) {
	const auth = useAuth();
	const account =
		subject ?? (auth.isSignedIn ? (auth.userId ?? undefined) : undefined);
	return (
		<NutritionOperationsSession
			key={account ?? "signed-out"}
			repository={repository}
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
}: ServiceOptions & { readonly children: ReactNode }) {
	const { isSignedIn, userId } = useAuth();
	const { isWebSocketConnected } = useConvexConnectionState();
	const applyOperation = useMutation(api.nutritionDiary.applyOperation);
	const legacyLog = useMutation(api.nutritionDiary.log);
	const legacyUpdate = useMutation(api.nutritionDiary.update);
	const legacyRemove = useMutation(api.nutritionDiary.remove);
	const legacyCombo = useMutation(api.nutritionDiary.logCombo);
	const local = useMemo(
		() => repository ?? openNutritionLocalRepository(),
		[repository],
	);
	const legacyOnly =
		typeof applyOperation === "function" &&
		typeof legacyLog === "function" &&
		typeof legacyUpdate === "function" &&
		typeof legacyRemove === "function" &&
		typeof legacyCombo === "function" &&
		sameMutation(applyOperation, legacyLog) &&
		sameMutation(applyOperation, legacyUpdate) &&
		sameMutation(applyOperation, legacyRemove) &&
		sameMutation(applyOperation, legacyCombo);
	const service = useMemo(
		() =>
			new NutritionOperationService(
				local,
				async (envelope) => {
					if (legacyOnly) return undefined;
					const run = applyOperation as unknown as (
						args: NutritionOperationEnvelope,
					) => Promise<unknown>;
					return (await run(envelope)) as NutritionOperationResult | undefined;
				},
				{
					create:
						typeof legacyLog === "function"
							? (snapshot) => legacyLog(snapshot as never)
							: undefined,
					update:
						typeof legacyUpdate === "function"
							? (args) => legacyUpdate(args as never)
							: undefined,
					remove:
						typeof legacyRemove === "function"
							? (args) => legacyRemove(args as never)
							: undefined,
					combo:
						typeof legacyCombo === "function"
							? (args) => legacyCombo(args as never)
							: undefined,
				},
				legacyOnly,
				repository !== undefined,
			),
		[
			applyOperation,
			legacyCombo,
			legacyLog,
			legacyOnly,
			legacyRemove,
			legacyUpdate,
			local,
			repository,
		],
	);
	const subject =
		forcedSubject ?? (isSignedIn ? (userId ?? undefined) : undefined);
	useEffect(() => {
		service.setSubject(subject);
		return () => service.dispose();
	}, [service, subject]);
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

function sameMutation(left: unknown, right: unknown) {
	return left === right;
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
		nutrients: entry.nutrients,
		provenance: entry.provenance,
		...(entry.id.startsWith("client:")
			? { clientEntryId: entry.id.slice("client:".length) }
			: {}),
	};
}
