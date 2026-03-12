import { serve } from "@hono/node-server";
import { ApiServer } from "./src/ApiServer";
import {
  findUserByEmail,
  upsertUserWithCode,
  updateUserValidation,
  clearVerificationCode,
  incrementFailedAttempts,
} from "@alpha/data/crud/users";
import {
  createSession,
  findSessionById,
  endSession,
} from "@alpha/data/crud/sessions";
import { logger } from "./src/utils/logger";

const OPENAI_API_KEY = process.env["OPENAI_API_KEY"];
let CORS_HOSTS = "http://localhost:5173";
if (process.env["CORS_HOSTS"]) {
  try {
    CORS_HOSTS = JSON.parse(process.env["CORS_HOSTS"]);
  } catch {
    console.error(
      'Environment variable "CORS_HOSTS" contains invalid JSON.\n' +
        "Please fix it in your .env file.",
    );
    process.exit(1);
  }
}
const PORT = process.env["PORT"] ? parseInt(process.env["PORT"]) : 8081;

if (!OPENAI_API_KEY) {
  console.error(
    'Environment variable "OPENAI_API_KEY" is required.\n' +
      "Please set it in your .env file.",
  );
  process.exit(1);
}

const JWT_SECRET = process.env["JWT_SECRET"];
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error(
    'Environment variable "JWT_SECRET" is required and must be at least 32 characters.\n' +
      "Please set it in your .env file.",
  );
  process.exit(1);
}

const LIVEKIT_API_KEY = process.env["LIVEKIT_API_KEY"];
const LIVEKIT_API_SECRET = process.env["LIVEKIT_API_SECRET"];
const LIVEKIT_URL = process.env["LIVEKIT_URL"];

if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
  console.error(
    "LIVEKIT_API_KEY, LIVEKIT_API_SECRET, and LIVEKIT_URL are required.\n" +
      "Please set them in your .env file.",
  );
  process.exit(1);
}

const apiServer = new ApiServer(OPENAI_API_KEY, CORS_HOSTS, JWT_SECRET, {
  apiKey: LIVEKIT_API_KEY,
  apiSecret: LIVEKIT_API_SECRET,
  url: LIVEKIT_URL,
});
apiServer.initServer({
  findUserByEmail,
  upsertUserWithCode,
  updateUserValidation,
  clearVerificationCode,
  incrementFailedAttempts,
  createSession,
  findSessionById,
  endSession,
});

// Socket.io disabled — LiveKit agent runs as separate process
// const server = new SocketServer(OPENAI_API_KEY, CORS_HOSTS, AUDIO_ROOT_DIR);
// server.listen(apiServer.getServer(), PORT);

serve({ fetch: apiServer.getServer().fetch, port: PORT });
logger.log(`Listening on http://localhost:${PORT}`);
