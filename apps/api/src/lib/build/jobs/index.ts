import type { BuildJob } from "../job";
import { blockJob, gameJob } from "./code";
import { doorJob } from "./door";
import { eventJob, roomJob, rolesJob, rulesJob } from "./lobbyTools";
import { pageJob } from "./pages";
import { lookJob } from "./look";
import { alertJob, crewJob, feedJob, hostJob, overlayJob, postJob } from "./people";

// Every "describe it" job (routes/aiDescribe.ts), by id.
export const DESCRIBE_JOBS: BuildJob<any>[] = [
  eventJob,
  roomJob,
  rolesJob,
  rulesJob,
  doorJob,
  crewJob,
  overlayJob,
  hostJob,
  postJob,
  alertJob,
  feedJob,
  blockJob,
  gameJob,
  pageJob,
  lookJob,
];
