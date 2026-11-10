import * as Sentry from "@sentry/react-native";
import Storage from "expo-sqlite/kv-store";
import {
	accountKeyspace,
	clearAccountStores,
	isLocalDatabase,
	PREFERENCE_KEYS,
	readLocal,
	readLocalJson,
	registerAccountStore,
	registerLocalDatabase,
	writeLocal,
	writeLocalJson,
} from "./local-store";

afterEach(() => jest.restoreAllMocks());

it("clears an account's keys on reset and leaves other accounts and preferences alone", () => {
	const drafts = accountKeyspace("test-drafts:v1");
	writeLocal(drafts.key("alice"), "a");
	writeLocal(drafts.key("alice", "session-1"), "a1");
	writeLocal(drafts.key("alice-2"), "other account sharing a prefix");
	writeLocal(drafts.key("bob", "session-1"), "b1");
	writeLocal(PREFERENCE_KEYS.locale, "nl");

	clearAccountStores("alice");

	expect(readLocal(drafts.key("alice"))).toBeNull();
	expect(readLocal(drafts.key("alice", "session-1"))).toBeNull();
	expect(readLocal(drafts.key("alice-2"))).toBe(
		"other account sharing a prefix",
	);
	expect(readLocal(drafts.key("bob", "session-1"))).toBe("b1");
	expect(readLocal(PREFERENCE_KEYS.locale)).toBe("nl");
});

it("attempts every store and still reports the one that failed", () => {
	const cleared: string[] = [];
	registerAccountStore({
		name: "test-broken",
		clear: () => {
			throw new Error("disk full");
		},
	});
	registerAccountStore({
		name: "test-working",
		clear: (subject) => cleared.push(subject),
	});

	expect(() => clearAccountStores("carol")).toThrow("disk full");
	expect(cleared).toEqual(["carol"]);
	expect(Sentry.captureException).toHaveBeenCalled();
	registerAccountStore({ name: "test-broken", clear: () => {} });
});

it("treats an unreadable store as empty, and a failed write as unsaved", () => {
	jest.spyOn(Storage, "getItemSync").mockImplementation(() => {
		throw new Error("closed");
	});
	jest.spyOn(Storage, "setItemSync").mockImplementation(() => {
		throw new Error("closed");
	});
	expect(readLocal(PREFERENCE_KEYS.appearance)).toBeNull();
	expect(writeLocal(PREFERENCE_KEYS.appearance, "dark")).toBe(false);
});

it("reads stored JSON through its parser and rejects a wrong shape", () => {
	const key = accountKeyspace("test-json:v1").key("dave");
	const parse = (value: unknown) => {
		if (typeof value !== "number") throw new Error("not a number");
		return value;
	};
	writeLocalJson(key, 3);
	expect(readLocalJson(key, parse)).toEqual({ ok: true, value: 3 });
	writeLocalJson(key, "three");
	expect(readLocalJson(key, parse)).toEqual({ ok: false });
});

it("knows which SQLite files belong to the app", () => {
	registerLocalDatabase(/^test-library-.+\.db$/);
	expect(isLocalDatabase("ExpoSQLiteStorage")).toBe(true);
	expect(isLocalDatabase("test-library-abc.db")).toBe(true);
	expect(isLocalDatabase("someone-elses.db")).toBe(false);
});
