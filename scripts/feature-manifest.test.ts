import { FEATURES } from "@foundry/core/features";
import { expect, it } from "vitest";
import { checkFeatureManifest, listRouteFiles } from "./feature-manifest-check";

it("maps every route to a feature", () => {
	const routes = {
		web: listRouteFiles("src/routes"),
		mobile: listRouteFiles("apps/mobile/app"),
	};
	expect(checkFeatureManifest(FEATURES, routes)).toEqual([]);
});
