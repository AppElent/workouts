#!/usr/bin/env bash
# Drive the Foundry Expo dev client on an iOS simulator.
# Usage: driver.sh <command> [args]   (run from anywhere; see SKILL.md)
set -euo pipefail

# Development variant (app.config.ts): its own bundle ID and app name.
BUNDLE_ID=com.appelent.foundry.dev
AGENT_DEVICE=(npx -y agent-device@0.21.27)

MOBILE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
CHECKOUT_ID="$(printf '%s' "$MOBILE_DIR" | shasum | cut -c1-8)"
STATE="${RUN_MOBILE_STATE:-${TMPDIR:-/tmp}/run-mobile-$CHECKOUT_ID}"
SIM_NAME="${RUN_MOBILE_SIM:-Foundry run-mobile $CHECKOUT_ID}"
DEVICE_TYPE="${RUN_MOBILE_DEVICE_TYPE:-iPhone 18 Pro}"
PORT="${RUN_MOBILE_PORT:-8090}"
METRO_FLAGS=()
mkdir -p "$STATE"

log() { printf '[run-mobile] %s\n' "$*" >&2; }
die() { log "ERROR: $*"; exit 1; }

udid() {
	xcrun simctl list devices -j | node -e '
		const name = process.argv[1];
		const all = Object.values(JSON.parse(require("fs").readFileSync(0, "utf8")).devices).flat();
		const d = all.find((x) => x.name === name && x.isAvailable);
		if (d) process.stdout.write(d.udid);
	' "$SIM_NAME"
}

require_udid() {
	local u
	u="$(udid)"
	[ -n "$u" ] || die "simulator '$SIM_NAME' missing; run: driver.sh up"
	printf '%s' "$u"
}

# agent-device keys its session by cwd, so always run it from the state dir.
ad() {
	local rc
	set +o pipefail
	(cd "$STATE" && "${AGENT_DEVICE[@]}" "$@" 2>&1; echo "__rc=$?") | grep -v '^npm notice' >"$STATE/ad.out"
	set -o pipefail
	rc="$(sed -n 's/^__rc=//p' "$STATE/ad.out")"
	grep -v '^__rc=' "$STATE/ad.out" || true
	return "${rc:-1}"
}

find_dev_client() {
	if [ -n "${RUN_MOBILE_APP:-}" ]; then printf '%s' "$RUN_MOBILE_APP"; return; fi
	ls -dt "$HOME"/Library/Developer/Xcode/DerivedData/FoundryDev-*/Build/Products/Debug-iphonesimulator/FoundryDev.app 2>/dev/null | head -1
}

set_lang() {
	local u="$1" lang="$2" locale
	case "$lang" in en) locale=en_US ;; nl) locale=nl_NL ;; *) die "lang must be en or nl" ;; esac
	xcrun simctl spawn "$u" defaults write -g AppleLanguages -array "$lang"
	xcrun simctl spawn "$u" defaults write -g AppleLocale -string "$locale"
}

metro_cwd() {
	local pid
	pid="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null | head -1)"
	[ -n "$pid" ] || return 0
	lsof -a -p "$pid" -d cwd -Fn | sed -n 's/^n//p'
}

ensure_metro() {
	local cwd
	cwd="$(metro_cwd)"
	if [ -n "$cwd" ]; then
		[ "$cwd" = "$MOBILE_DIR" ] || die "port $PORT is Metro for $cwd, not this checkout; set RUN_MOBILE_PORT"
		[ "${#METRO_FLAGS[@]}" = 0 ] || die "Metro is already running; driver.sh down, then up ${METRO_FLAGS[*]}"
		log "reusing Metro on :$PORT (after dependency or config changes, or to toggle --debug-queries: driver.sh down, then up)"
		return
	fi
	log "starting Metro on :$PORT (log: $STATE/metro.log)"
	# Background only the command, never a `cd && …` list: a backgrounded list is
	# a subshell that keeps the caller's stdout, so `up | tail` would never end.
	(
		cd "$MOBILE_DIR" || exit 1
		nohup pnpm exec expo start --dev-client --port "$PORT" ${METRO_FLAGS[@]+"${METRO_FLAGS[@]}"} </dev/null >"$STATE/metro.log" 2>&1 &
		echo $! >"$STATE/metro.pid"
	)
	for _ in $(seq 1 60); do
		if curl -sf "http://127.0.0.1:$PORT/status" | grep -q running; then
			# pnpm -> node puts the listener outside metro.pid's tree; record it
			# so `down` stops exactly the Metro this driver started.
			lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t | head -1 >"$STATE/metro.listener"
			return
		fi
		sleep 1
	done
	die "Metro did not come up; see $STATE/metro.log"
}

# The simulator belongs to this checkout, so a session still holding it is left
# over from an interrupted run (DEVICE_IN_USE). Close that session and retry once.
open_app() {
	local u="$1" out owner
	if out="$(ad open "$BUNDLE_ID" --platform ios --udid "$u")"; then return; fi
	owner="$(printf '%s' "$out" | grep -o 'close --session [^ .,"]*' | head -1 | cut -d' ' -f3)"
	[ -n "$owner" ] || die "agent-device open failed: $out"
	log "simulator held by stale session '$owner'; closing it"
	ad close --session "$owner" >/dev/null || true
	ad open "$BUNDLE_ID" --platform ios --udid "$u" >/dev/null || die "agent-device open failed after closing '$owner'; see: driver.sh ad session list"
}

cmd_up() {
	local lang=en u app fresh=0
	while [ $# -gt 0 ]; do
		case "$1" in
			--lang) lang="$2"; shift 2 ;;
			--debug-queries) export EXPO_PUBLIC_DEBUG_QUERIES=1; shift ;;
			--clear) METRO_FLAGS+=(--clear); shift ;;
			*) die "unknown flag $1" ;;
		esac
	done

	u="$(udid)"
	if [ -z "$u" ]; then
		log "creating simulator '$SIM_NAME' ($DEVICE_TYPE)"
		u="$(xcrun simctl create "$SIM_NAME" "$DEVICE_TYPE")"
		fresh=1
	fi
	if [ "$fresh" = 1 ] || [ "$(cat "$STATE/lang" 2>/dev/null)" != "$lang" ]; then
		# Language only applies after a reboot; defaults need a booted device.
		xcrun simctl boot "$u" 2>/dev/null || true
		xcrun simctl bootstatus "$u" -b >/dev/null
		set_lang "$u" "$lang"
		xcrun simctl shutdown "$u" 2>/dev/null || true
		for _ in $(seq 1 30); do
			xcrun simctl list devices | grep -q "$u) (Shutdown)" && break
			sleep 1
		done
		echo "$lang" >"$STATE/lang"
	fi
	xcrun simctl boot "$u" 2>/dev/null || true
	xcrun simctl bootstatus "$u" -b >/dev/null

	if ! xcrun simctl get_app_container "$u" "$BUNDLE_ID" >/dev/null 2>&1; then
		app="$(find_dev_client)"
		[ -n "$app" ] || die "no FoundryDev.app dev client build found; run 'pnpm devbuild:ios' once or set RUN_MOBILE_APP"
		log "installing $app"
		xcrun simctl install "$u" "$app"
	fi
	ensure_metro

	xcrun simctl terminate "$u" "$BUNDLE_ID" 2>/dev/null || true
	local before
	before="$(grep -c 'iOS Bundled' "$STATE/metro.log" 2>/dev/null || true)"
	# Flags (expo-dev-launcher EXDevLauncherURLHelper.swift) skip the dev-menu
	# onboarding sheet and hide the floating gear that covers header buttons.
	xcrun simctl openurl "$u" "$BUNDLE_ID://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A$PORT&disableOnboarding=1&disableFab=1&disableAutoLaunch=1"
	# First deep link per simulator raises an "Open in Foundry?" system prompt.
	ad alert accept 5000 --platform ios --udid "$u" >/dev/null || true
	open_app "$u"
	log "waiting for the iOS bundle (max 180s)"
	local bundled=0
	for _ in $(seq 1 90); do
		[ -f "$STATE/metro.log" ] && [ "$(grep -c 'iOS Bundled' "$STATE/metro.log" || true)" -gt "${before:-0}" ] && { bundled=1; break; }
		grep -qE 'Bundling failed|PluginError|Unable to resolve' "$STATE/metro.log" 2>/dev/null &&
			die "Metro error; see $STATE/metro.log (stale Metro? driver.sh down, then up)"
		sleep 2
	done
	[ "$bundled" = 1 ] || die "no new iOS bundle after 180s; see $STATE/metro.log"
	cmd_backend >&2 || die "the app is not on the configured backend; make no writes"
	sleep 3
	log "up: udid=$u port=$PORT lang=$lang"
}

cmd_signin() {
	local email="" password=""
	while [ $# -gt 0 ]; do
		case "$1" in
			--email) email="$2"; shift 2 ;;
			--password) password="$2"; shift 2 ;;
			*) die "signin: unknown option $1" ;;
		esac
	done
	# Both or neither: one flag alone would sign in to the pre-filled shared account.
	if [ -n "$email" ] && [ -z "$password" ]; then die "signin: --email needs --password"; fi
	if [ -z "$email" ] && [ -n "$password" ]; then die "signin: --password needs --email"; fi
	ad wait text "Sign in" 20000 >/dev/null || die "sign-in screen not visible (already signed in?)"
	if [ -n "$email" ]; then
		local field secure
		field=$(ad snapshot -i | grep -m1 '\[text-field\]' | grep -o '@e[0-9]*')
		ad fill "$field" "$email" >/dev/null || die "could not fill email"
		secure=$(ad snapshot -i | grep -m1 '\[securetextfield\]' | grep -o '@e[0-9]*')
		ad fill "$secure" "$password" >/dev/null || die "could not fill password"
		# Never fall through to the pre-filled shared account.
		ad snapshot -i | grep -qF "[text-field] \"$email\"" || die "email field does not show $email; not signing in"
	fi
	ad press 'label="Sign in"' >/dev/null
	ad wait 'role=tab-bar' 30000 >/dev/null || die "tab bar not visible after sign-in"
	log "signed in"
}

cmd_ss() {
	local out="${1:-$STATE/screen-$(date +%H%M%S).png}"
	xcrun simctl io "$(require_udid)" screenshot "$out" >/dev/null 2>&1
	echo "$out"
}

# Prints only Convex origins: bundles also inline the test user's password.
cmd_backend() {
	node "$MOBILE_DIR/../../scripts/check-mobile-backend.mjs" --port "$PORT"
}

cmd_reload() {
	curl -sf -X POST "http://127.0.0.1:$PORT/reload" >/dev/null || die "Metro not reachable on :$PORT"
	log "reload sent"
}

cmd_down() {
	local u
	ad close >/dev/null || true
	if [ -f "$STATE/metro.pid" ]; then
		pkill -P "$(cat "$STATE/metro.pid")" 2>/dev/null || true
		kill "$(cat "$STATE/metro.pid")" 2>/dev/null || true
		rm -f "$STATE/metro.pid"
	fi
	# Only the listener this driver recorded; a reused Metro stays running.
	if [ -f "$STATE/metro.listener" ]; then
		# Guard against pid reuse: the recorded pid must still own the port.
		lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t | grep -qx "$(cat "$STATE/metro.listener")" &&
			kill "$(cat "$STATE/metro.listener")" 2>/dev/null || true
		rm -f "$STATE/metro.listener"
	fi
	u="$(udid)"
	[ -z "$u" ] || xcrun simctl shutdown "$u" 2>/dev/null || true
	log "down"
}

case "${1:-}" in
	up) shift; cmd_up "$@" ;;
	signin) shift; cmd_signin "$@" ;;
	ad) shift; ad "$@" ;;
	ss) shift; cmd_ss "$@" ;;
	reload) cmd_reload ;;
	backend) cmd_backend ;;
	logs) tail -n "${2:-40}" "$STATE/metro.log" ;;
	udid) require_udid; echo ;;
	state) echo "$STATE" ;;
	down) cmd_down ;;
	*) sed -n '2,3p' "$0"; echo "commands: up [--lang en|nl] [--debug-queries] [--clear] | signin [--email E --password P] | ad <agent-device args> | ss [file] | reload | backend | logs [n] | udid | state | down"; exit 2 ;;
esac
