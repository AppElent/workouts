import { useAuth } from "@clerk/expo";
import { canonicalJson } from "@foundry/core";
import { useConvexConnectionState } from "convex/react";
import {
	createContext,
	type ReactNode,
	use,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { AppState } from "react-native";

export function mintUuid(): string {
	if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
	const bytes = new Uint8Array(16);
	if (globalThis.crypto?.getRandomValues)
		globalThis.crypto.getRandomValues(bytes);
	else
		for (let index = 0; index < bytes.length; index += 1)
			bytes[index] = Math.floor(Math.random() * 256);
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
		.join("")
		.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
}

export class OfflineWriteError extends Error {
	constructor() {
		super("A connection is required to save.");
		this.name = "OfflineWriteError";
	}
}

export class AccountChangedError extends Error {
	constructor() {
		super("The account changed while saving.");
		this.name = "AccountChangedError";
	}
}

export type AccountWriteRequest<P, T> = {
	/**
	 * What the write means, without ids it mints: a retry of the same identity
	 * reuses the operation id and the payload of its first try, so a write the
	 * server applied before its answer was lost is not applied twice.
	 */
	readonly identity: unknown;
	readonly prepare: (subject: string) => P | Promise<P>;
	readonly deliver: (
		prepared: P,
		request: { readonly subject: string; readonly operationId: string },
	) => Promise<T>;
};

export type AccountWrite = {
	readonly subject: string | undefined;
	readonly online: boolean;
	send<P, T>(request: AccountWriteRequest<P, T>): Promise<T>;
};

/** Per-account session memory, created on first use and dropped with the account. */
export type AccountSlot<T> = { readonly create: () => T };

export function accountSlot<T>(create: () => T): AccountSlot<T> {
	return { create };
}

type AccountScope = AccountWrite & {
	readonly slots: Map<AccountSlot<unknown>, unknown>;
};

const AccountWriteContext = createContext<AccountScope | null>(null);

/**
 * The one account boundary for nutrition data: who is signed in, whether a
 * write can reach the server, and the retry identity of each write. Everything
 * beneath remounts when the account changes.
 */
export function AccountWriteProvider({
	children,
	subject: suppliedSubject,
}: {
	children: ReactNode;
	subject?: string;
}) {
	const { isSignedIn, userId } = useAuth();
	const subject =
		suppliedSubject ?? (isSignedIn ? (userId ?? undefined) : undefined);
	return (
		<AccountWriteScope key={subject ?? "signed-out"} subject={subject}>
			{children}
		</AccountWriteScope>
	);
}

function AccountWriteScope({
	children,
	subject,
}: {
	children: ReactNode;
	subject: string | undefined;
}) {
	const { isWebSocketConnected } = useConvexConnectionState();
	const [foreground, setForeground] = useState(true);
	useEffect(() => {
		const subscription = AppState.addEventListener("change", (state) =>
			setForeground(state === "active"),
		);
		return () => subscription.remove();
	}, []);
	const online = isWebSocketConnected && foreground;
	const onlineRef = useRef(online);
	onlineRef.current = online;
	const mounted = useRef(true);
	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
		};
	}, []);
	const [retries] = useState(
		() => new Map<string, { prepared: unknown; operationId: string }>(),
	);
	const [slots] = useState(() => new Map<AccountSlot<unknown>, unknown>());
	const value = useMemo<AccountScope>(
		() => ({
			subject,
			online,
			slots,
			async send<P, T>({
				identity,
				prepare,
				deliver,
			}: AccountWriteRequest<P, T>) {
				if (!subject || !onlineRef.current) throw new OfflineWriteError();
				const key = canonicalJson(identity);
				let attempt = retries.get(key) as
					| { prepared: P; operationId: string }
					| undefined;
				if (!attempt) {
					attempt = {
						prepared: await prepare(subject),
						operationId: mintUuid(),
					};
					if (!mounted.current) throw new AccountChangedError();
					retries.set(key, attempt);
				}
				const result = await deliver(attempt.prepared, {
					subject,
					operationId: attempt.operationId,
				});
				if (!mounted.current) throw new AccountChangedError();
				retries.delete(key);
				return result;
			},
		}),
		[subject, online, retries, slots],
	);
	return <AccountWriteContext value={value}>{children}</AccountWriteContext>;
}

function useAccountScope(): AccountScope {
	const scope = use(AccountWriteContext);
	if (!scope) throw new Error("AccountWriteProvider is missing.");
	return scope;
}

export function useAccountWrite(): AccountWrite {
	return useAccountScope();
}

export function useAccountSlot<T>(slot: AccountSlot<T>): T {
	const { slots } = useAccountScope();
	const key = slot as AccountSlot<unknown>;
	if (!slots.has(key)) slots.set(key, slot.create());
	return slots.get(key) as T;
}
