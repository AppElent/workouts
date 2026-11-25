// Hosted Workouts are parked while HOSTED_WORKOUTS_ENABLED is false (APP-437).
import { HOSTED_WORKOUTS_ENABLED } from "@foundry/core/features";
import { HostedDetailScreen } from "../../../src/features/training/hosted/hosted-detail-screen";
import { HostedPausedScreen } from "../../../src/features/training/hosted/hosted-paused-screen";

export default HOSTED_WORKOUTS_ENABLED
	? HostedDetailScreen
	: HostedPausedScreen;
