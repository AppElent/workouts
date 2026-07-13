import { AuthCard, SignInForm } from "@appelent/auth";
import { useAuth } from "@clerk/clerk-react";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
	buildMcpAuthErrorRedirect,
	buildMcpAuthTokenRedirect,
	parseMcpAuthRequest,
} from "#/lib/mcpAuthRedirect";

export const Route = createFileRoute("/mcp/auth")({
	ssr: false,
	component: McpAuthLoginPage,
});

function McpAuthLoginPage() {
	const { getToken, isLoaded, isSignedIn } = useAuth();
	const [error, setError] = useState<string | undefined>();
	const authRequest = useMemo(
		() => parseMcpAuthRequest(window.location.href),
		[],
	);

	useEffect(() => {
		if (!authRequest.ok || !isLoaded || !isSignedIn) return;

		let cancelled = false;
		const request = authRequest;

		async function redirectWithToken() {
			try {
				const token = await getToken({ template: "convex" });
				if (cancelled) return;

				if (!token) {
					window.location.assign(
						buildMcpAuthErrorRedirect({
							redirectUri: request.redirectUri,
							state: request.state,
							error: "token_unavailable",
							description: "Could not create an MCP token.",
						}),
					);
					return;
				}

				window.location.assign(
					buildMcpAuthTokenRedirect({
						redirectUri: request.redirectUri,
						state: request.state,
						token,
					}),
				);
			} catch {
				if (cancelled) return;
				window.location.assign(
					buildMcpAuthErrorRedirect({
						redirectUri: request.redirectUri,
						state: request.state,
						error: "token_unavailable",
						description: "Could not create an MCP token.",
					}),
				);
			}
		}

		redirectWithToken();

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

	if (error) {
		return (
			<AuthCard
				title="MCP sign in"
				subtitle="The MCP login could not continue."
			>
				<p className="text-sm text-red-400">{error}</p>
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
				title="Sign in to Workouts MCP"
				subtitle="Continue to connect this MCP client."
			>
				<SignInForm onSuccess={() => setError(undefined)} />
			</AuthCard>
		);
	}

	return (
		<AuthCard title="MCP sign in" subtitle="Returning to your MCP client.">
			<p className="text-sm text-muted-foreground">Connecting...</p>
		</AuthCard>
	);
}
