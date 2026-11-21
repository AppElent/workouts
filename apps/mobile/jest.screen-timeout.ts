/**
 * A longer per-test timeout for screen tests (`*.test.tsx`) only.
 *
 * Screen tests mount real routes and wait on rendered output, so their time
 * scales with free CPU. While a simulator build runs, the stop hook's related
 * tests share the Mac with it, and screen tests that pass on a quiet machine
 * missed Jest's 5 s default (APP-530). Unit and hook tests (`*.test.ts`) keep the
 * default, so a slow pure function still fails fast.
 */

const SCREEN_TEST_TIMEOUT_MS = 30_000;

if (expect.getState().testPath?.endsWith(".test.tsx")) {
	jest.setTimeout(SCREEN_TEST_TIMEOUT_MS);
}
