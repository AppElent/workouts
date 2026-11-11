/// <reference types="vite/client" />

import { HOSTED_LEVELS } from "@foundry/core";
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

it("leaves unnamed athletes for the clients to label, marking the host", async () => {
	const t = convexTest(schema, modules);
	const host = t.withIdentity({ subject: "host" });
	const id = await host.mutation(api.hostedWorkouts.createDraft, {
		title: "Friday lift",
		hostParticipation: "hostAndParticipate",
		template: {
			strengthBlocks: [],
			wodBlocks: [
				{
					blockId: "max",
					name: "Max clean",
					type: "load",
					levels: HOSTED_LEVELS.map((level) => ({
						level,
						label: level,
						movements: [{ name: "Clean" }],
					})),
				},
			],
		},
	});
	await host.mutation(api.hostedWorkouts.open, { id });
	const mine = await host.query(api.hostedWorkouts.getMine, { id });
	if (!mine) throw new Error("Hosted workout missing");
	expect(mine.participants).toHaveLength(1);
	expect(mine.participants[0]).not.toHaveProperty("displayName");
	const score = {
		wodBlockId: "max",
		level: "rx" as const,
		load: 100,
		loadUnit: "kg" as const,
	};
	await host.mutation(api.hostedWorkoutSubmissions.submitForSession, {
		sessionId: mine.participants[0].sessionId,
		...score,
	});
	await t.mutation(api.hostedWorkoutSubmissions.submitGuest, {
		token: mine.hosted.joinToken,
		guestName: "Sam",
		...score,
	});
	const board = await t.query(api.hostedWorkouts.getByJoinToken, {
		token: mine.hosted.joinToken,
	});
	expect(
		board?.submissions.map(({ athleteName, byHost }) => ({
			athleteName,
			byHost,
		})),
	).toEqual(
		expect.arrayContaining([
			{ athleteName: null, byHost: true },
			{ athleteName: "Sam", byHost: false },
		]),
	);
});
