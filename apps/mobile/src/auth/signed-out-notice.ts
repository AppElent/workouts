/**
 * A confirmation for the sign-in screen, left by a flow that ends the session.
 *
 * Deleting Foundry data signs out, and deleting the AppElent account ends the
 * session, so the signed-in layout (and its toasts) unmounts at the moment the
 * confirmation is due. The flow leaves the notice here first; the sign-in
 * screen shows it and clears it.
 *
 * Memory only: the sign-in screen mounts in the same app run. A notice the
 * person never saw because the app was killed is not worth keeping.
 */
export type SignedOutNotice = "dataDeleted" | "accountDeleted";

let pending: SignedOutNotice | null = null;

export function leaveSignedOutNotice(notice: SignedOutNotice | null): void {
	pending = notice;
}

/** Read without clearing, so a render that runs twice sees the same notice. */
export function signedOutNotice(): SignedOutNotice | null {
	return pending;
}

export function clearSignedOutNotice(): void {
	pending = null;
}
