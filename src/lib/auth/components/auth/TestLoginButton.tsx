import { useSignIn } from "@clerk/react";
import { useState } from "react";
import { shouldShowTestLogin } from "#/lib/auth/core";
import { useMessages } from "#/lib/i18n";
import { AuthButton } from "./AuthButton";
import { AuthError } from "./AuthError";
import { orThrow } from "./clerkResult";
import { clerkErrorMessage } from "./types";

export function TestLoginButton({ onSuccess }: { onSuccess: () => void }) {
	const { signIn } = useSignIn();
	const { auth } = useMessages();
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	if (!shouldShowTestLogin(import.meta.env)) {
		return null;
	}

	async function loginTestUser() {
		setError(null);
		setLoading(true);
		try {
			await orThrow(
				signIn.password({
					identifier: import.meta.env.VITE_TEST_USER_EMAIL as string,
					password: import.meta.env.VITE_TEST_USER_PASSWORD as string,
				}),
			);
			if (signIn.status === "complete") {
				await orThrow(signIn.finalize());
				onSuccess();
			} else {
				setError(auth.testLogin.needsSteps);
			}
		} catch (err) {
			setError(clerkErrorMessage(err));
		} finally {
			setLoading(false);
		}
	}

	return (
		<div className="mt-2 flex flex-col gap-1">
			<AuthButton
				type="button"
				variant="ghost"
				loading={loading}
				onClick={loginTestUser}
			>
				{auth.testLogin.button}
			</AuthButton>
			<AuthError message={error} />
		</div>
	);
}
