import { useAuth, useSignIn } from "@clerk/react";
import { isTestLoginAvailable } from "@foundry/core";
import { useState } from "react";
import { useMessages } from "#/lib/i18n";
import { AuthButton } from "./AuthButton";
import { AuthError } from "./AuthError";
import { orThrow, useClerkErrorMessage } from "./clerkError";

export function TestLoginButton({ onSuccess }: { onSuccess?: () => void }) {
	const { signIn } = useSignIn();
	const { isLoaded } = useAuth();
	const { auth } = useMessages();
	const errorMessage = useClerkErrorMessage();
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	const email = import.meta.env.VITE_TEST_USER_EMAIL;
	const password = import.meta.env.VITE_TEST_USER_PASSWORD;
	if (
		!email ||
		!password ||
		!isTestLoginAvailable({
			publishableKey: import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
			email,
			password,
		})
	)
		return null;

	const loginTestUser = async () => {
		// Clerk queues calls made before it loads; nothing may go out then.
		if (!isLoaded) return;
		setError(null);
		setLoading(true);
		try {
			await orThrow(
				signIn.password({
					identifier: email,
					password,
				}),
			);
			if (signIn.status === "complete") {
				await orThrow(signIn.finalize());
				onSuccess?.();
			} else {
				setError(auth.testLogin.needsSteps);
			}
		} catch (err) {
			setError(errorMessage(err));
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="mt-2 flex flex-col gap-1">
			<AuthButton
				type="button"
				variant="ghost"
				loading={loading}
				disabled={!isLoaded}
				onClick={loginTestUser}
			>
				{auth.testLogin.button}
			</AuthButton>
			<AuthError message={error} />
		</div>
	);
}
