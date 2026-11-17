---
type: decision
description: Read before changing Hosted Workout ownership, Submissions, or participant history.
version: 1.1.0
status: accepted
date: 2026-09-16
---

# Keep hosted prescriptions shared and participant history personal

A Hosted Workout is a host-owned shared event with a frozen prescription, participant list, and leaderboard; it is not a container for other people's training history. Signed-in Participants record the resulting session and WOD Results in their own histories while contributing a linked Submission to the shared leaderboard, and guests contribute leaderboard-only Submissions without creating personal history.

This boundary preserves personal ownership and access control while still giving the host a group view. It also prevents later edits to reusable Exercises or WODs from rewriting what participants were prescribed at the event.

## Claiming a guest Submission

A guest Submission carries a random key from the guest's browser, matched together with the typed name, so guests who share a name or a device keep separate rows. A guest who later signs in on that browser can claim the Submissions under one name: they join the Hosted Workout and each claimed Submission becomes a signed-in Submission with a WOD Result in their own history, dated at the original submit. The key never leaves the server. On a shared device the name is taken on trust: anyone signed in on that browser can claim any name scored from it, which is accepted because the device was already shared. A WOD block the athlete already scored while signed in keeps that score, and the guest row stays leaderboard-only.
