import { isLocalSentryUrl } from "./config";

it.each([
	"http://localhost:3100/",
	"http://app.localhost/",
	"http://127.0.0.1:3100/",
	"http://127.0.0.2/",
	"http://[::1]:3100/",
	"http://0.0.0.0:3100/",
])("disables reporting for local preview URL %s", (url) => {
	expect(isLocalSentryUrl(url)).toBe(true);
});

it.each([
	"https://foundry.appelent.nl/",
	"https://workouts-pr-42.example.workers.dev/",
	"https://localhost.example.com/",
	"https://example.com/?redirect=http://localhost:3100/",
])("keeps deployed reporting enabled for %s", (url) => {
	expect(isLocalSentryUrl(url)).toBe(false);
});
