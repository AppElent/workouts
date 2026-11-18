/**
 * A join link opened while signed out. The `(app)` guard redirects to sign-in
 * and the link's path is gone, so the guard remembers the token here and the
 * `(auth)` guard sends the newly signed-in user back to `/join/<token>`.
 *
 * Memory only: if the app is killed during sign-in, the user opens the link
 * again. The join screen clears it once it has the token.
 */
let pending: string | null = null;

/** `null` forgets an earlier link: the latest link opened wins, valid or not. */
export function rememberPendingJoin(token: string | null): void {
	pending = token;
}

export function pendingJoin(): string | null {
	return pending;
}

export function clearPendingJoin(): void {
	pending = null;
}
