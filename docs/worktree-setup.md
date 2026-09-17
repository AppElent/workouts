# Worktree setup

Each worktree must use its own Convex deployment. The repository-owned setup command works from PowerShell, cmd.exe, bash, and zsh; editor actions should call it instead of embedding shell-specific setup logic.

The default is safe and does not configure Convex:

```sh
pnpm setup:worktree
```

This installs dependencies only. The explicit equivalent is `pnpm setup:worktree -- --convex=none`.

## T3 Code automatic action

Add an action, enable **Run automatically on worktree creation**, and use:

```sh
pnpm setup:worktree -- --convex=cloud --project=eric-jansen:workout-tracker --editor=t3code
```

Cloud creation requires a personal Convex login (`pnpm exec convex login`) before setup can create the deployment and mint its deployment-scoped key. The key is saved only in the ignored root `.env.local`; it is never committed.

## Other editors and manual worktrees

Use the same command in Codex, Cursor, Claude Code, Orca, or a manually created worktree, changing only the generic editor label:

```sh
pnpm setup:worktree -- --convex=cloud --project=eric-jansen:workout-tracker --editor=codex
pnpm setup:worktree -- --convex=cloud --project=eric-jansen:workout-tracker --editor=cursor
pnpm setup:worktree -- --convex=cloud --project=eric-jansen:workout-tracker --editor=claude
pnpm setup:worktree -- --convex=cloud --project=eric-jansen:workout-tracker --editor=orca
```

The deployment reference comes from the worktree directory, OS user, and editor label, so it remains stable when editor-specific environment variables are absent. Rerunning setup reuses the deployment. Use `--expiration="in 5 days"`, `--scoped-key=false`, `--install=false`, or `--push=false` to override cloud defaults. Preview the plan without running commands or writing files with `--dry-run`.

## Isolated local Convex

```sh
pnpm setup:worktree -- --convex=local --editor=codex
pnpm exec convex dev
```

Keep the second command running for as long as the web or mobile client uses the local backend. A local backend is a child of the persistent `convex dev` process; `convex dev --once` exits and does not leave it running.

When no local deployment exists yet, setup uses `convex dev --once` only to initialize its isolated configuration and push the first function set. Setup then exits, including the temporary backend process; the persistent command above is still required.

After either cloud or local selection, setup copies the public Convex URL from the root `.env.local` to `apps/mobile/.env.local`. Restart Expo/Metro after the URL changes so it reloads `EXPO_PUBLIC_CONVEX_URL`:

```sh
pnpm --dir apps/mobile start --clear
```

Generated `.env*` files, local `.convex/` state, pnpm's worktree-local store, and `.worktree-setup.json` metadata are ignored by Git.

The workflow follows Convex's official [Agent Mode guidance](https://docs.convex.dev/cli/agent-mode).
