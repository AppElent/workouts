/**
 * A longer per-test timeout for rendering tests (`*.test.tsx`) only.
 *
 * Rendering tests mount screens or components and wait on rendered output, so
 * their time scales with free CPU. While a simulator build runs, the stop
 * hook's related tests share the Mac with it, and screen tests that pass on a
 * quiet machine missed Jest's 5 s default (APP-530). A rendering test that
 * really hangs now takes 30 s to fail. Unit and hook tests (`*.test.ts`) keep
 * the default, so a slow pure function still fails fast.
 */

const SCREEN_TEST_TIMEOUT_MS = 30_000;

if (expect.getState().testPath?.endsWith(".test.tsx")) {
	jest.setTimeout(SCREEN_TEST_TIMEOUT_MS);
}
