import { Show, useClerk, useUser } from "@clerk/react";
import { useState } from "react";
import { useMessages } from "#/lib/i18n";
import { AUTH_PATHS } from "./paths";

export function HeaderUser() {
	const { user } = useUser();
	const { signOut } = useClerk();
	const { auth } = useMessages();
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
						aria-label={auth.header.accountMenu}
					>
						{initials}
					</button>
					{open ? (
						<div className="absolute right-0 mt-2 w-40 rounded-[var(--auth-radius)] border border-[var(--auth-border)] bg-[var(--auth-card-bg)] p-1 shadow-md">
							<a
								href={AUTH_PATHS.account}
								onClick={() => setOpen(false)}
								className="block rounded px-3 py-2 text-sm text-[var(--auth-fg)] hover:bg-[var(--auth-border)]"
							>
								{auth.header.account}
							</a>
							<button
								type="button"
								onClick={() => signOut()}
								className="block w-full rounded px-3 py-2 text-left text-sm text-[var(--auth-fg)] hover:bg-[var(--auth-border)]"
							>
								{auth.header.signOut}
							</button>
						</div>
					) : null}
				</div>
			</Show>
			<Show when="signed-out">
				<a
					href={AUTH_PATHS.signIn}
					className="text-sm font-medium text-[var(--auth-fg)] hover:underline"
				>
					{auth.header.signIn}
				</a>
			</Show>
		</>
	);
}
