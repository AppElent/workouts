/**
 * The state every Clerk Core 3 flow step shares: a `busy` flag and the last
 * `{ error }` a step resolved with, shown through the catalog.
 *
 * `run` leaves `busy` set when every step succeeds: a step that ends in
 * `finalize()` flips `isSignedIn`, the `(auth)` layout redirects, and the
 * screen unmounts. A caller that stays on screen calls `idle()`.
 */
import { useCallback, useState } from "react";
import {
	type CodedError,
	type ErrorSignal,
	pickErrorKey,
	useClerkErrorText,
} from "./clerk-errors";

type Step = () => Promise<{ error: CodedError | null }>;

export function useClerkFlow<TFields extends object>(
	errors: ErrorSignal<TFields>,
) {
	const [busy, setBusy] = useState(false);
	const [returned, setReturned] = useState<CodedError | null>(null);

	const run = useCallback(async (...steps: Step[]): Promise<boolean> => {
		setBusy(true);
		setReturned(null);
		for (const step of steps) {
			const { error } = await step();
			if (error) {
				setReturned(error);
				setBusy(false);
				return false;
			}
		}
		return true;
	}, []);

	const idle = useCallback(() => setBusy(false), []);
	const fail = useCallback((error: CodedError) => setReturned(error), []);
	const clear = useCallback(() => setReturned(null), []);

	return {
		busy,
		error: useClerkErrorText(pickErrorKey(errors, returned)),
		run,
		idle,
		fail,
		clear,
	};
}
