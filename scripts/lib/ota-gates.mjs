// Pure gates for the OTA workflows (developer-home standards/releases.md).
// The CLIs that call EAS are apps/mobile/scripts/channel-runtime.mjs and
// apps/mobile/scripts/soaked-commit.mjs; the logic lives here so it is tested.

/**
 * The newest commit published to a channel for `platform` at least `hours`
 * ago: the one that has soaked on that platform. `updates` are EAS update
 * infos (`eas update:view --json`), in any order. Other platforms'
 * updates, roll-backs to the embedded bundle and updates without a commit
 * are skipped. Returns `{ commit, createdAt }` or null.
 */
export function soakedCommit(updates, now, hours, platform) {
	const cutoff = now.getTime() - hours * 3600 * 1000;
	const soaked = updates
		.filter((u) => u.platform === platform)
		.filter((u) => u.gitCommitHash && !u.isRollBackToEmbedded)
		.filter((u) => new Date(u.createdAt).getTime() <= cutoff)
		.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
	return soaked.length
		? { commit: soaked[0].gitCommitHash, createdAt: soaked[0].createdAt }
		: null;
}

/**
 * Which platforms may take an update: those where something on the channel
 * (an earlier update or a finished build) already runs this runtime. `force`
 * publishes every platform. `due` lists the platforms that need a new build.
 */
export function matchPlatforms(results, force = false) {
	const publish = [];
	const due = [];
	for (const { platform, updates, builds } of results) {
		if (force || updates > 0 || builds > 0) publish.push(platform);
		else due.push(platform);
	}
	return { publish, due };
}
