---
type: record
kind: verification
description: Read for runtime screenshots of web data and account deletion on the Account page (APP-34).
version: 1.0.0
date: 2026-11-17
---

# Web data and account deletion — APP-34

Runtime screenshots of the web Account page's "Delete data and account" card,
taken with Vite dev and headless Chromium against the shared dev deployment,
signed in with the documented test account, in English. Desktop is 1280 px wide,
small screen 375 px; light and dark come from `prefers-color-scheme`.

The blocked state was produced by starting an empty Strength Session and
opening Account; the session was cancelled afterwards and the card re-enabled
without a reload. No data or account was deleted in these screenshot runs: the
confirm dialogs were cancelled. The live deletion run is below.

## Sign-out race after Delete account

After `user.delete()` Clerk is signed out, so the signed-in layout mounts
`RedirectToSignIn` while the card does a replace + full load of `/`. Without
deleting anything, the same sequence was reproduced with the test account:
`Clerk.setActive({ session: null })`, then `window.location.replace("/")`
after 0, 50 and 300 ms. Every run ended on `/`; none reached `/sign-in`.

| State | Desktop | 375 px |
| --- | --- | --- |
| Card, light | ![](web-account-desktop-light.png) | ![](web-account-375-light.png) |
| Card, dark | ![](web-account-desktop-dark.png) | ![](web-account-375-dark.png) |
| Delete my data confirm, light | ![](web-confirm-data-desktop-light.png) | ![](web-confirm-data-375-light.png) |
| Delete my data confirm, dark | ![](web-confirm-data-desktop-dark.png) | ![](web-confirm-data-375-dark.png) |
| Delete account confirm, light | ![](web-confirm-account-desktop-light.png) | ![](web-confirm-account-375-light.png) |
| Delete account confirm, dark | ![](web-confirm-account-desktop-dark.png) | ![](web-confirm-account-375-dark.png) |
| Blocked (running Activity), light | ![](web-blocked-desktop-light.png) | ![](web-blocked-375-light.png) |
| Blocked (running Activity), dark | ![](web-blocked-desktop-dark.png) | ![](web-blocked-375-dark.png) |

## Live deletion run

On 17 November 2026, at commit 45241e3a, against the shared dev deployment,
with a throwaway user on the Clerk development instance
(`app34-deletion+clerk_test@example.com`, `user_3MFhEFIwp5qFRrj3oWcKGF51gax`).
Headless Chromium, 1280 px, English, client-side navigation. The script
checked `Clerk.user.id` before every deletion step.

1. Signed in with an email code. Logged a body metric (81.2 kg) on Progress >
   Body and added the custom exercise "APP-34 Test Raise".
2. Account > Delete my data > confirmed. The toast said "Your data was
   deleted." Progress > Body then showed no measurements, and the trend showed
   its empty text. Exercises no longer listed "APP-34 Test Raise". No reload
   was needed.
3. Account > Delete account > confirmed. The page ended on `/` (navigations
   `/ -> /`), `Clerk.user` was `null`, and the signed-out start page showed.
4. Requesting a sign-in code for the same email said "No account uses this
   email address." The Clerk Backend API returns "not found" for the user ID.

| Step | Screenshot |
| --- | --- |
| Body metric logged | ![](live-1-body-before.png) |
| Custom exercise added | ![](live-2-exercise-before.png) |
| Delete my data done | ![](live-3-data-deleted.png) |
| Body empty after deletion | ![](live-4-body-after.png) |
| Custom exercise gone | ![](live-5-exercise-after.png) |
| Signed-out start after Delete account | ![](live-6-after-account.png) |
| Sign-in finds no account | ![](live-7-sign-in-again.png) |

## Full reload of a signed-in page

With the dev test account, reloading or opening a signed-in URL directly shows
"Something went wrong. Sign in again to continue."
([screenshot](reload-headed.png)); client-side navigation works. It happens
in headed and headless Chrome for Testing with a fresh profile, on `/account`
and on `/progress`, which this PR does not change. So it predates this PR. It
was not tried in a regular Chrome profile.

## Recent sign-in before Delete account

Clerk lists Delete account as a sensitive action: it needs the strongest
factor verified within 10 minutes, and otherwise refuses with
`session_reverification_required`. The live run above stayed inside that
window. The instance config has no setting for this, so Clerk's documented
default applies to both instances. Delete account now checks
`session.checkAuthorization({ reverification: "strict" })` through
`useReverification` before Apple revocation and before any data is deleted.
`user.delete()` is wrapped too, in case the window lapses during a long
deletion. Clerk's verify dialog opens in this app
([screenshot](reverify-dialog.png), dev test account, cancelled). A fresh
session passes the check without a dialog. Unit tests cover:

- an old sign-in confirmed, then deleted;
- the dialog cancelled, so nothing is deleted;
- Clerk asking again after the data is gone and that being cancelled, which
  asks the person to choose Delete account again and confirm their sign-in;
- the sign-in still old after Clerk's dialog, so nothing is deleted (Clerk
  retries once and returns the result as is, so the card requires `true`);
- Clerk refusing the retried `user.delete()`, so the page stays put and no
  reload claims success;
- after Clerk's dialog, a second confirmation that gives Apple's popup a fresh
  click, and cancelling it deletes nothing.

The check reads the live session through `useClerk()`, because Clerk replaces
the session object after verifying.

Each Clerk step, including Clerk's own retry, re-checks that the signed-in
user and session are still the ones that confirmed. If another account signed
in during the deletion (for example in another tab), that account is never
deleted. The card also re-reads the deletion blocker before Apple's popup,
because a revoked Apple grant can't be restored. Tests cover both cases.

An end-to-end run with a stale session was not done, because it needs another
throwaway account.
