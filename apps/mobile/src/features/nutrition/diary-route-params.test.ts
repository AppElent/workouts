import { diaryRouteParams } from "./diary-route-params";

const evening = new Date(2026, 2, 4, 20, 0);

describe("diaryRouteParams", () => {
	it("keeps a real date and a known meal", () => {
		expect(
			diaryRouteParams({ date: "2026-02-28", meal: "lunch" }, evening),
		).toEqual({ date: "2026-02-28", meal: "lunch" });
	});

	it("opens today and this hour's meal for a broken deep link", () => {
		expect(
			diaryRouteParams({ date: "2026-02-30", meal: "brunch" }, evening),
		).toEqual({ date: "2026-03-04", meal: "dinner" });
	});
});
