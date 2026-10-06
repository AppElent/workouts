import { act, renderHook } from "@testing-library/react-native";
import { requestDiaryDate, useDiaryDateRequest } from "./diary-date-request";

describe("asking the diary to show a day", () => {
	it("moves a mounted diary to each requested day", () => {
		const onRequest = jest.fn();
		renderHook(() => useDiaryDateRequest(onRequest));
		act(() => requestDiaryDate("2026-10-02"));
		act(() => requestDiaryDate("2026-10-03"));
		expect(onRequest.mock.calls).toEqual([["2026-10-02"], ["2026-10-03"]]);
	});

	it("ignores a request made before the diary mounted", () => {
		requestDiaryDate("2026-09-01");
		const onRequest = jest.fn();
		renderHook(() => useDiaryDateRequest(onRequest));
		expect(onRequest).not.toHaveBeenCalled();
	});
});
