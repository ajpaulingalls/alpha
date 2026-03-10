import path from "node:path";
import { ApiServer } from "./src/ApiServer";
import { SocketServer } from "./src/SocketServer";

const OPENAI_API_KEY = process.env["OPENAI_API_KEY"];
const CORS_HOSTS = process.env["CORS_HOSTS"]
  ? JSON.parse(process.env["CORS_HOSTS"])
  : "http://localhost:5173";
const PORT = process.env["PORT"] ? parseInt(process.env["PORT"]) : 8081;
const AUDIO_ROOT_DIR = path.join(process.cwd(), "audio");

if (!OPENAI_API_KEY) {
  console.error(
    'Environment variable "OPENAI_API_KEY" is required.\n' +
      "Please set it in your .env file."
  );
  process.exit(1);
}

const JWT_SECRET = process.env["JWT_SECRET"];
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error(
    'Environment variable "JWT_SECRET" is required and must be at least 32 characters.\n' +
      "Please set it in your .env file."
  );
  process.exit(1);
}

const apiServer = new ApiServer(OPENAI_API_KEY, CORS_HOSTS);
apiServer.initServer();
const server = new SocketServer(OPENAI_API_KEY, CORS_HOSTS, AUDIO_ROOT_DIR);
server.listen(apiServer.getServer(), PORT);
