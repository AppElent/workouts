import { screen } from "@testing-library/react-native";
import { renderThemed } from "../test-support/render-themed";
import { RowNote } from "./row-note";
import { AppText } from "./text";

// The test renderer drops `numberOfLines` from host text, so spy on what we pass.
jest.mock("./text", () => {
	const { Text } = require("react-native");
	return {
		AppText: jest.fn(({ children }) => <Text>{children}</Text>),
	};
});

let mockLarge = false;
jest.mock("./use-large-text", () => ({ useLargeText: () => mockLarge }));

const lines = () => jest.mocked(AppText).mock.lastCall?.[0].numberOfLines;

beforeEach(() => {
	mockLarge = false;
	jest.mocked(AppText).mockClear();
});

it("shows the note in two lines at most", async () => {
	await renderThemed(<RowNote note="narrow grip, left elbow sore" />);
	expect(screen.getByText("narrow grip, left elbow sore")).toBeTruthy();
	expect(lines()).toBe(2);
});

it("shows all of it at accessibility text sizes", async () => {
	mockLarge = true;
	await renderThemed(<RowNote note="narrow grip" />);
	expect(lines()).toBeUndefined();
});

it("renders nothing without a note", async () => {
	await renderThemed(<RowNote note="" />);
	expect(screen.toJSON()).toBeNull();
});
