/**
 * State for a credential field that iOS AutoFill can change silently.
 *
 * AutoFill (and declining its "Use Strong Password?" offer) can set or clear
 * a native field without an `onChangeText`. `props` therefore also takes the
 * native text from `onEndEditing`, and `latest()` reads a ref that every
 * event writes synchronously, so a submit in the same event as the last edit
 * never sends a stale closure's value. `sync` takes the text of an
 * `onSubmitEditing` event, which iOS fires before `onEndEditing`.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import type { TextInputProps } from "react-native";

export function useCredentialField(initial = "") {
	const [value, setValue] = useState(initial);
	const latestText = useRef(initial);

	const sync = useCallback((text: string) => {
		latestText.current = text;
		setValue(text);
	}, []);

	const props = useMemo(
		() =>
			({
				value,
				onChangeText: sync,
				onEndEditing: (event) => sync(event.nativeEvent.text),
			}) satisfies TextInputProps,
		[value, sync],
	);

	const latest = useCallback(() => latestText.current, []);

	return { value, props, sync, latest };
}

/**
 * iOS `passwordRules` matching the Clerk instance's password policy, so a
 * generated strong password passes Clerk. The development instance uses
 * Clerk's default (at least 8 characters, no class rules); update this with
 * the dashboard's password settings.
 */
export const CLERK_PASSWORD_RULES = "minlength: 8;";
