import { Show, useClerk, useUser } from "@clerk/react";
import { useState } from "react";
import { useAuthConfig } from "#/lib/auth/components/auth/AuthConfigProvider";
import { cn } from "#/lib/auth/lib/utils";

export default function HeaderUser() {
	const { user } = useUser();
	const { signOut } = useClerk();
	const config = useAuthConfig();
	const [open, setOpen] = useState(false);
	const initials = (
		user?.firstName?.[0] ??
		user?.primaryEmailAddress?.emailAddress?.[0] ??
		"?"
	).toUpperCase();

	return (
		<>
			<Show when="signed-in">
				<div className="relative">
					<button
						type="button"
						onClick={() => setOpen((v) => !v)}
						className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--auth-accent)] text-sm font-medium text-[var(--auth-accent-fg)]"
						aria-label="Account menu"
					>
						{initials}
					</button>
					{open ? (
						<div
							className={cn(
								"absolute right-0 mt-2 w-40 rounded-[var(--auth-radius)] border border-[var(--auth-border)] bg-[var(--auth-card-bg)] p-1 shadow-md",
							)}
						>
							<a
								href={config.paths.account}
								onClick={() => setOpen(false)}
								className="block rounded px-3 py-2 text-sm text-[var(--auth-fg)] hover:bg-[var(--auth-border)]"
							>
								Account
							</a>
							<button
								type="button"
								onClick={() => signOut()}
								className="block w-full rounded px-3 py-2 text-left text-sm text-[var(--auth-fg)] hover:bg-[var(--auth-border)]"
							>
								Sign out
							</button>
						</div>
					) : null}
				</div>
			</Show>
			<Show when="signed-out">
				<a
					href={config.paths.signIn}
					className="text-sm font-medium text-[var(--auth-fg)] hover:underline"
				>
					Sign in
				</a>
			</Show>
		</>
	);
}
