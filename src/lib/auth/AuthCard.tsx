import type { ReactNode } from "react";
import { useMessages } from "#/lib/i18n";

export function AuthCard({
	title,
	subtitle,
	children,
}: {
	title: string;
	subtitle?: string;
	children: ReactNode;
}) {
	const { nav } = useMessages();
	return (
		<div className="flex min-h-screen items-center justify-center bg-[var(--auth-bg)] p-4">
			<div className="w-full max-w-sm rounded-[var(--auth-radius)] border border-[var(--auth-border)] bg-[var(--auth-card-bg)] p-6 shadow-sm">
				<div className="mb-5 text-center">
					<span className="text-base font-semibold text-[var(--auth-fg)]">
						{nav.appName}
					</span>
					<h1 className="mt-2 text-lg font-semibold text-[var(--auth-fg)]">
						{title}
					</h1>
					{subtitle ? (
						<p className="mt-1 text-sm text-[var(--auth-muted)]">{subtitle}</p>
					) : null}
				</div>
				{children}
			</div>
		</div>
	);
}
