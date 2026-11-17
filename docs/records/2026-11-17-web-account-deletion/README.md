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
without a reload. No data or account was deleted in these runs: the confirm
dialogs were cancelled. A live deletion run needs a throwaway Clerk development
user, which is pending (see the PR's leftover work).

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
