import { useAuth } from "@clerk/react";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { AuthCard } from "#/lib/auth/AuthCard";
import { SignInForm } from "#/lib/auth/SignInForm";
import { mcpCallbackUrl, parseMcpAuthRequest } from "#/lib/mcp/authRedirect";
import { reportError } from "#/lib/observability/errors";

export const Route = createFileRoute("/mcp/auth")({
	ssr: false,
	component: McpAuthLoginPage,
});

function McpAuthLoginPage() {
	const { getToken, isLoaded, isSignedIn } = useAuth();
	const authRequest = useMemo(
		() => parseMcpAuthRequest(window.location.href),
		[],
	);

	useEffect(() => {
		if (!authRequest.ok || !isLoaded || !isSignedIn) return;
		let cancelled = false;
		getToken({ template: "convex" })
			.catch((error) => {
				reportError(error, "mcpAuthToken");
				return null;
			})
			.then((token) => {
				if (cancelled) return;
				window.location.assign(
					mcpCallbackUrl(
						authRequest,
						token
							? { token }
							: {
									error: "token_unavailable",
									error_description: "Could not create an MCP token.",
								},
					),
				);
			});
		return () => {
			cancelled = true;
		};
	}, [authRequest, getToken, isLoaded, isSignedIn]);

	if (!authRequest.ok) {
		return (
			<AuthCard
				title="MCP sign in"
				subtitle="This MCP login request is invalid."
			>
				<p className="text-sm text-red-400">{authRequest.message}</p>
			</AuthCard>
		);
	}

	if (!isLoaded) {
		return (
			<AuthCard title="MCP sign in" subtitle="Preparing your MCP session.">
				<p className="text-sm text-muted-foreground">Loading...</p>
			</AuthCard>
		);
	}

	if (!isSignedIn) {
		return (
			<AuthCard
				title="Sign in to Foundry MCP"
				subtitle="Continue to connect this MCP client."
			>
				<SignInForm />
			</AuthCard>
		);
	}

	return (
		<AuthCard title="MCP sign in" subtitle="Returning to your MCP client.">
			<p className="text-sm text-muted-foreground">Connecting...</p>
		</AuthCard>
	);
}
