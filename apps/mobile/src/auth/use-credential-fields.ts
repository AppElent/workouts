/**
 * State and submit for a credential form whose fields iOS AutoFill can change
 * silently.
 *
 * AutoFill (and declining its "Use Strong Password?" offer) can set or clear
 * a native field without an `onChangeText`; the app only learns the text from
 * the field's `onEndEditing`. So every field also syncs from `onEndEditing`,
 * and the latest text lives in a ref that each event writes synchronously.
 *
 * Submitting never trusts a focused field: `press` blurs it and submits from
 * that field's `onEndEditing`, once its final native text is known. The return
 * key submits with the text its own event carries. `editing` is true while a
 * field is focused, so the primary action can stay enabled after a fill the
 * app has not heard about yet.
 */
import { useCallback, useRef, useState } from "react";
import { TextInput, type TextInputProps } from "react-native";

export function useCredentialFields<K extends string>(
	initial: Record<K, string>,
	onSubmit: (values: Record<K, string>) => void,
) {
	const [values, setValues] = useState(initial);
	const latest = useRef(initial);
	const [editing, setEditing] = useState(false);
	const pendingSubmit = useRef(false);
	const submitRef = useRef(onSubmit);
	submitRef.current = onSubmit;

	const set = useCallback((key: K, text: string) => {
		latest.current = { ...latest.current, [key]: text };
		setValues(latest.current);
	}, []);

	const submitNow = useCallback(() => {
		pendingSubmit.current = false;
		submitRef.current(latest.current);
	}, []);

	const field = (key: K) =>
		({
			value: values[key],
			onChangeText: (text) => set(key, text),
			onFocus: () => {
				pendingSubmit.current = false;
				setEditing(true);
			},
			onEndEditing: (event) => {
				set(key, event.nativeEvent.text);
				setEditing(false);
				if (pendingSubmit.current) submitNow();
			},
		}) satisfies TextInputProps;

	/** The primary action: waits for the focused field's final text. */
	const press = useCallback(() => {
		const focused = TextInput.State.currentlyFocusedInput();
		if (focused) {
			pendingSubmit.current = true;
			focused.blur();
		} else {
			submitNow();
		}
	}, [submitNow]);

	/** `onSubmitEditing` for the last field: its event has the final text. */
	const submitFrom =
		(key: K): TextInputProps["onSubmitEditing"] =>
		(event) => {
			set(key, event.nativeEvent.text);
			submitNow();
		};

	return { values, field, press, submitFrom, editing };
}

/**
 * iOS `passwordRules` matching the Clerk instance's password policy, so a
 * generated strong password passes Clerk. The development instance uses
 * Clerk's default (at least 8 characters, no class rules); update this with
 * the dashboard's password settings.
 */
export const CLERK_PASSWORD_RULES = "minlength: 8;";
