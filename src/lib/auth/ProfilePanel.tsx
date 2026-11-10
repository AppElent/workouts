import { useClerk, useUser } from "@clerk/react";
import { useEffect, useState } from "react";
import { fmt, useMessages } from "#/lib/i18n";
import { AuthButton } from "./AuthButton";
import { AuthError } from "./AuthError";
import { AuthField } from "./AuthField";
import { useClerkErrorMessage } from "./clerkError";

export function ProfilePanel() {
	const { isLoaded, user } = useUser();
	const { signOut } = useClerk();
	const { auth } = useMessages();
	const text = auth.profile;
	const errorMessage = useClerkErrorMessage();
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [savingProfile, setSavingProfile] = useState(false);
	const [savingPassword, setSavingPassword] = useState(false);

	useEffect(() => {
		if (user) {
			setFirstName(user.firstName ?? "");
			setLastName(user.lastName ?? "");
		}
	}, [user]);

	if (!isLoaded || !user) {
		return <p className="text-sm text-[var(--auth-muted)]">{text.loading}</p>;
	}

	async function saveProfile(e: React.FormEvent) {
		e.preventDefault();
		if (!user) {
			return;
		}
		setError(null);
		setSavingProfile(true);
		try {
			await user.update({ firstName, lastName });
		} catch (err) {
			setError(errorMessage(err));
		} finally {
			setSavingProfile(false);
		}
	}

	async function changePassword(e: React.FormEvent) {
		e.preventDefault();
		if (!user) {
			return;
		}
		setError(null);
		setSavingPassword(true);
		try {
			await user.updatePassword({ currentPassword, newPassword });
			setCurrentPassword("");
			setNewPassword("");
		} catch (err) {
			setError(errorMessage(err));
		} finally {
			setSavingPassword(false);
		}
	}

	return (
		<div className="space-y-6">
			<AuthError message={error} />

			<section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
				<p className="text-sm font-semibold text-[var(--text)]">{text.title}</p>
				<form
					onSubmit={saveProfile}
					className="mt-3 flex flex-col gap-3"
					noValidate
				>
					<AuthField
						label={text.firstName}
						type="text"
						value={firstName}
						onChange={setFirstName}
					/>
					<AuthField
						label={text.lastName}
						type="text"
						value={lastName}
						onChange={setLastName}
					/>
					<p className="text-xs text-[var(--auth-muted)]">
						{fmt(text.email, {
							email: user.primaryEmailAddress?.emailAddress ?? "",
						})}
					</p>
					<AuthButton loading={savingProfile}>{text.save}</AuthButton>
				</form>
			</section>

			<section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
				<p className="text-sm font-semibold text-[var(--text)]">
					{text.security}
				</p>
				<form
					onSubmit={changePassword}
					className="mt-3 flex flex-col gap-3"
					noValidate
				>
					<AuthField
						label={text.currentPassword}
						type="password"
						autoComplete="current-password"
						value={currentPassword}
						onChange={setCurrentPassword}
					/>
					<AuthField
						label={text.newPassword}
						type="password"
						autoComplete="new-password"
						value={newPassword}
						onChange={setNewPassword}
					/>
					<AuthButton loading={savingPassword}>
						{text.changePassword}
					</AuthButton>
				</form>
			</section>

			<section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
				<p className="text-sm font-semibold text-[var(--text)]">
					{text.session}
				</p>
				<div className="mt-3">
					<AuthButton type="button" variant="ghost" onClick={() => signOut()}>
						{text.signOut}
					</AuthButton>
				</div>
			</section>
		</div>
	);
}
