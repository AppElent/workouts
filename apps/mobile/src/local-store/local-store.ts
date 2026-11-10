/**
 * The phone's key-value store (`expo-sqlite/kv-store`) and the registry of
 * everything an account leaves on this device.
 *
 * **Synchronous on purpose.** Preferences such as the language and appearance
 * have to be known before the first frame (#69 forbids a frame painted in a
 * rejected language), and `expo-sqlite/kv-store` is the only Expo persistence
 * module with a synchronous read (`getItemSync`). `expo-secure-store` has only
 * async reads, so it cannot serve here.
 *
 * **Best effort, reported.** A store that will not open is a phone that
 * forgets, which is a fallback rather than an error: reads come back empty
 * (`readLocal`) or `{ ok: false }` (`readLocalJson`), writes return `false`.
 * Every failure is reported once per operation and launch, without the key
 * (account keys can hold food text).
 *
 * `expo-sqlite` is a native module: a client whose native side predates it
 * throws on import, which nothing here can catch. Expo Go bundles it; a custom
 * dev client has to be rebuilt for it.
 */
import Storage from "expo-sqlite/kv-store";
import { reportError } from "../observability/errors";

declare const localKeyBrand: unique symbol;
/** A key built by this module: a preference or a keyspace's `key()`. */
export type LocalKey = string & { readonly [localKeyBrand]: true };

const asKey = (key: string) => key as LocalKey;

/**
 * Preferences of this phone rather than of the signed-in account: they apply
 * on the signed-out screens and while Convex is unreachable.
 */
export const PREFERENCE_KEYS = {
	locale: asKey("workouts:locale"),
	exerciseLibraryLayout: asKey("workouts:exercise-library-layout"),
	appearance: asKey("workouts:appearance"),
	/**
	 * Consent to send text and photos to the nutrition AI provider. Per phone,
	 * not per account, until product decides whether consent follows the
	 * account (the AI history next to it is account-scoped).
	 */
	nutritionAiConsent: asKey("workouts:nutrition-ai-consent"),
	/** Look named store products up on the web during AI entry ("1"). */
	nutritionAiWebSearch: asKey("workouts:nutrition-ai-web-search"),
} as const;

const reportedOperations = new Set<string>();
function failed(operation: string, error: unknown) {
	if (reportedOperations.has(operation)) return;
	reportedOperations.add(operation);
	reportError(error, `local-store.${operation}`);
}

export type LocalRead<T> = { ok: true; value: T | null } | { ok: false };

/** What is stored under `key`; `{ ok: false }` when the store failed. */
function readLocalResult(key: LocalKey): LocalRead<string> {
	try {
		return { ok: true, value: Storage.getItemSync(key) };
	} catch (error) {
		failed("read", error);
		return { ok: false };
	}
}

/**
 * Stored JSON, checked by `parse` (which throws on a wrong shape). A wrong
 * shape counts as a failed read, like an unreadable store.
 */
export function readLocalJson<T>(
	key: LocalKey,
	parse: (value: unknown) => T,
): LocalRead<T> {
	const read = readLocalResult(key);
	if (!read.ok || read.value === null) return read as LocalRead<T>;
	try {
		return { ok: true, value: parse(JSON.parse(read.value)) };
	} catch (error) {
		failed("parse", error);
		return { ok: false };
	}
}

/** What is stored under `key`, or `null` when nothing readable is. */
export function readLocal(key: LocalKey): string | null {
	const read = readLocalResult(key);
	return read.ok ? read.value : null;
}

/** `false` when the store failed; the value then lives only in memory. */
export function writeLocal(key: LocalKey, value: string): boolean {
	try {
		Storage.setItemSync(key, value);
		return true;
	} catch (error) {
		failed("write", error);
		return false;
	}
}

export function writeLocalJson(key: LocalKey, value: unknown): boolean {
	return writeLocal(key, JSON.stringify(value));
}

export function removeLocal(key: LocalKey): boolean {
	try {
		Storage.removeItemSync(key);
		return true;
	} catch (error) {
		failed("remove", error);
		return false;
	}
}

/** Something an account leaves on this phone, cleared when that account's data is reset. */
interface AccountStore {
	readonly name: string;
	/** Throws when the data could not be removed; the reset then reports a failure. */
	clear(subject: string): void;
}

const accountStores = new Map<string, AccountStore>();

/** Registering under an existing name replaces it (module reloads in development). */
export function registerAccountStore(store: AccountStore) {
	accountStores.set(store.name, store);
}

/**
 * Clears every registered store for `subject`. Every store is attempted; a
 * failure is reported and the first one rethrown afterwards.
 */
export function clearAccountStores(subject: string) {
	let first: unknown;
	for (const store of accountStores.values()) {
		try {
			store.clear(subject);
		} catch (error) {
			reportError(error, `local-store.clear.${store.name}`);
			first ??= error;
		}
	}
	if (first !== undefined) throw first;
}

interface AccountKeyspace {
	/** `<prefix>:<subject>[:<part>…]` */
	key(subject: string, ...parts: string[]): LocalKey;
	/** Removes every key of this keyspace that belongs to `subject`. */
	clear(subject: string): void;
}

/**
 * Keys owned by one account, registered for account reset under `prefix`.
 * The prefix carries its own version (`strength-set-drafts:v1`) so a shape
 * change can start a fresh keyspace.
 */
export function accountKeyspace(prefix: string): AccountKeyspace {
	const keyspace: AccountKeyspace = {
		key: (subject, ...parts) => asKey([prefix, subject, ...parts].join(":")),
		clear(subject) {
			const own = `${prefix}:${subject}`;
			for (const key of Storage.getAllKeysSync())
				if (key === own || key.startsWith(`${own}:`))
					Storage.removeItemSync(key);
		},
	};
	registerAccountStore({ name: prefix, clear: keyspace.clear });
	return keyspace;
}

/** `expo-sqlite/kv-store`'s own database file. */
const KV_STORE_DATABASE = "ExpoSQLiteStorage";
const localDatabases: (string | RegExp)[] = [KV_STORE_DATABASE];

/** Declares a SQLite file as the app's, so the development inspector lists it. */
export function registerLocalDatabase(name: string | RegExp) {
	localDatabases.push(name);
}

export function isLocalDatabase(fileName: string): boolean {
	return localDatabases.some((name) =>
		typeof name === "string" ? name === fileName : name.test(fileName),
	);
}
