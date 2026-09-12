import {
	applyLibraryRecord,
	type LibraryConflict,
	type LibraryOperation,
	type LibraryRecord,
	libraryRecordFromCombo,
	libraryRecordFromFood,
	type NutritionLibraryStateRepository,
} from "./nutrition-library-repository";
import { mintNutritionUuid } from "./nutrition-operation-service";
import type {
	Combo,
	PersonalFood,
	PersonalFoodRepository,
} from "./personal-food-repository";

export type NutritionLibraryOperationEnvelope = {
	readonly version: 1;
	readonly operationId: string;
	readonly expectedSubject: string;
	readonly operation:
		| {
				readonly kind: "upsert";
				readonly record: {
					readonly id: string;
					readonly kind: "food" | "combo";
					readonly payload: string;
				};
				readonly expectedRevision: number;
		  }
		| {
				readonly kind: "remove";
				readonly recordId: string;
				readonly recordKind: "food" | "combo";
				readonly expectedRevision: number;
		  };
};

export type NutritionLibraryRemote = (
	envelope: NutritionLibraryOperationEnvelope,
) => Promise<{ readonly record: LibraryRecord }>;

function isPermanent(error: unknown) {
	return /conflict|invalid|unauthenticated|unauthorized|subject|different payload/i.test(
		error instanceof Error ? error.message : String(error),
	);
}

/**
 * Owns one signed-in account's local-first library synchronization. The actual
 * food repository stays synchronous for callers; this service only adds a
 * durable outbox after the local write has succeeded.
 */
export class NutritionLibraryService {
	// Construction can happen during a React render. Recovery is local-only;
	// the provider explicitly enables transport after it knows connection state.
	private online = false;
	private replaying = false;
	private disposed = false;
	private readonly listeners = new Set<() => void>();
	private version = 0;

	constructor(
		readonly subject: string,
		private readonly state: NutritionLibraryStateRepository,
		private readonly repository: PersonalFoodRepository,
		private readonly remote: NutritionLibraryRemote,
	) {
		// An account switch or unmount can interrupt a request after it was marked
		// sending. Requeue it with its original revision/operation ID for safe replay.
		this.state.recoverSending(this.subject);
		this.recoverPrepared();
		this.seedUntrackedAccountLibrary();
	}

	/** Persist before a separate SQLite library write; see recoverPrepared(). */
	prepareUpsert(recordId: string, recordKind: "food" | "combo") {
		const transactionId = mintNutritionUuid();
		this.state.prepare(this.subject, {
			transactionId,
			action: "upsert",
			recordId,
			recordKind,
		});
		return transactionId;
	}

	prepareRemove(recordId: string, recordKind: "food" | "combo") {
		const transactionId = mintNutritionUuid();
		this.state.prepare(this.subject, {
			transactionId,
			action: "remove",
			recordId,
			recordKind,
		});
		return transactionId;
	}

	commitFood(transactionId: string, food: PersonalFood) {
		const known = this.state.getRecord(this.subject, food.id);
		this.state.commitPrepared(
			this.subject,
			transactionId,
			libraryRecordFromFood(food, known?.revision ?? 0),
		);
		this.notify();
		void this.replay();
	}

	commitCombo(transactionId: string, combo: Combo) {
		const known = this.state.getRecord(this.subject, combo.id);
		this.state.commitPrepared(
			this.subject,
			transactionId,
			libraryRecordFromCombo(combo, known?.revision ?? 0),
		);
		this.notify();
		void this.replay();
	}

	commitRemove(
		transactionId: string,
		recordId: string,
		kind: "food" | "combo",
	) {
		const known = this.state.getRecord(this.subject, recordId) ?? {
			id: recordId,
			kind,
			payload: null,
			revision: 0,
			deleted: false,
		};
		this.state.commitPrepared(this.subject, transactionId, known);
		this.notify();
		void this.replay();
	}

	discardPrepared(transactionId: string) {
		this.state.discardPrepared(this.subject, transactionId);
	}

	/**
	 * A crash after the account library commits but before the outbox commits
	 * leaves one prepared row. Recover it deterministically on the next launch.
	 */
	recoverPrepared() {
		for (const prepared of this.state.listPrepared(this.subject)) {
			const current =
				prepared.recordKind === "food"
					? this.repository.find(prepared.recordId)
					: this.repository.findCombo(prepared.recordId);
			if (prepared.action === "upsert" && current) {
				if (prepared.recordKind === "food")
					this.commitFood(prepared.transactionId, current as PersonalFood);
				else this.commitCombo(prepared.transactionId, current as Combo);
			} else if (prepared.action === "remove" && !current) {
				this.commitRemove(
					prepared.transactionId,
					prepared.recordId,
					prepared.recordKind,
				);
			} else {
				this.discardPrepared(prepared.transactionId);
			}
		}
	}

	/**
	 * An account can accumulate records while backup is disabled (for example,
	 * after another account has claimed this device's legacy library). Those rows
	 * already live in this account's isolated database, so enabling backup queues
	 * them explicitly rather than mislabeling them as an import from legacy data.
	 */
	private seedUntrackedAccountLibrary() {
		for (const food of this.repository.list()) {
			if (!this.state.getRecord(this.subject, food.id)) {
				this.state.queueUpsert(
					this.subject,
					libraryRecordFromFood(food),
					mintNutritionUuid(),
				);
			}
		}
		for (const combo of this.repository.listCombos()) {
			if (!this.state.getRecord(this.subject, combo.id)) {
				this.state.queueUpsert(
					this.subject,
					libraryRecordFromCombo(combo),
					mintNutritionUuid(),
				);
			}
		}
	}

	subscribe = (listener: () => void) => {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	};

	getVersion = () => this.version;

	private notify() {
		this.version += 1;
		for (const listener of this.listeners) listener();
	}

	setOnline(online: boolean) {
		if (this.disposed) return;
		this.online = online;
		if (online) void this.replay();
	}

	dispose() {
		this.disposed = true;
		this.online = false;
	}

	private queue(record: LibraryRecord) {
		this.state.queueUpsert(this.subject, record, mintNutritionUuid());
		this.notify();
		void this.replay();
	}

	recordFood(food: PersonalFood) {
		const known = this.state.getRecord(this.subject, food.id);
		this.queue(libraryRecordFromFood(food, known?.revision ?? 0));
	}

	recordCombo(combo: Combo) {
		const known = this.state.getRecord(this.subject, combo.id);
		this.queue(libraryRecordFromCombo(combo, known?.revision ?? 0));
	}

	remove(recordId: string, kind: "food" | "combo") {
		const known = this.state.getRecord(this.subject, recordId) ?? {
			id: recordId,
			kind,
			payload: null,
			revision: 0,
			deleted: false,
		};
		this.state.queueRemove(this.subject, known, mintNutritionUuid());
		this.notify();
		void this.replay();
	}

	getOperations() {
		return this.state.listOperations(this.subject);
	}

	getConflicts(): LibraryConflict[] {
		return this.state.listConflicts(this.subject);
	}

	async replay() {
		if (this.disposed || !this.online || this.replaying) return;
		this.replaying = true;
		let stoppedByFailure = false;
		const blockedRecords = new Set<string>();
		try {
			for (const candidate of this.state.listOperations(this.subject)) {
				if (this.disposed || !this.online) break;
				if (candidate.status === "needs-attention") {
					blockedRecords.add(candidate.recordId);
					continue;
				}
				if (
					candidate.status !== "queued" ||
					blockedRecords.has(candidate.recordId)
				)
					continue;
				const operation = this.state.markSending(
					this.subject,
					candidate.operationId,
				);
				if (!operation) continue;
				this.notify();
				try {
					const result = await this.remote(this.envelope(operation));
					if (this.disposed) break;
					this.state.acknowledge(
						this.subject,
						operation.operationId,
						result.record,
					);
				} catch (error) {
					if (this.disposed) break;
					const message =
						error instanceof Error ? error.message : String(error);
					if (isPermanent(error)) {
						this.state.markNeedsAttention(
							this.subject,
							operation.operationId,
							message,
						);
					} else {
						this.state.markQueued(this.subject, operation.operationId, message);
						stoppedByFailure = true;
					}
					blockedRecords.add(operation.recordId);
				}
				this.notify();
			}
		} finally {
			this.replaying = false;
			// A second local write can arrive while this pass is awaiting the first
			// remote receipt. Drain it promptly, but never busy-loop a failed retry.
			if (
				!this.disposed &&
				this.online &&
				!stoppedByFailure &&
				this.state
					.listOperations(this.subject)
					.some(
						(item) =>
							item.status === "queued" && !blockedRecords.has(item.recordId),
					)
			) {
				void this.replay();
			}
		}
	}

	private envelope(
		operation: LibraryOperation,
	): NutritionLibraryOperationEnvelope {
		if (operation.kind === "upsert") {
			if (!operation.payload)
				throw new Error("A library upsert has no payload.");
			return {
				version: 1,
				operationId: operation.operationId,
				expectedSubject: this.subject,
				operation: {
					kind: "upsert",
					record: {
						id: operation.recordId,
						kind: operation.recordKind,
						payload: operation.payload,
					},
					expectedRevision: operation.expectedRevision,
				},
			};
		}
		return {
			version: 1,
			operationId: operation.operationId,
			expectedSubject: this.subject,
			operation: {
				kind: "remove",
				recordId: operation.recordId,
				recordKind: operation.recordKind,
				expectedRevision: operation.expectedRevision,
			},
		};
	}

	/** Called once per bounded server page. Conflicting local work remains visible. */
	receiveServerPage(records: readonly LibraryRecord[]) {
		for (const record of records) {
			const decision = this.state.acceptServerRecord(this.subject, record);
			if (decision === "apply") {
				// Metadata deliberately follows the separate account-library write. If
				// that write fails or the process dies first, the page can safely replay.
				applyLibraryRecord(this.repository, record);
				this.state.commitServerRecord(this.subject, record);
			}
		}
		this.notify();
	}

	keepDeviceCopy(conflict: LibraryConflict) {
		const local = this.state.getRecord(this.subject, conflict.record.id);
		if (!local) throw new Error("The local conflict copy is unavailable.");
		this.state.resolveLocalConflict(
			this.subject,
			local,
			conflict.serverRevision,
			mintNutritionUuid(),
		);
		this.notify();
		void this.replay();
	}

	resolveServerConflict(conflict: LibraryConflict) {
		const record: LibraryRecord = {
			id: conflict.record.id,
			kind: conflict.record.kind,
			payload: conflict.serverPayload,
			revision: conflict.serverRevision,
			deleted: conflict.serverDeleted,
		};
		applyLibraryRecord(this.repository, record);
		this.state.adoptServerConflict(this.subject, record);
		this.notify();
	}
}
