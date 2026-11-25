import { useEffect, useState } from "react";

/** How long an auth check may run before recovery controls appear. */
export const SESSION_STALL_MS = 10_000;

/** True once the calling component has been mounted that long. */
export function useStalled() {
	const [stalled, setStalled] = useState(false);
	useEffect(() => {
		const timer = setTimeout(() => setStalled(true), SESSION_STALL_MS);
		return () => clearTimeout(timer);
	}, []);
	return stalled;
}
