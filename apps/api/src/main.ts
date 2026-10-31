import { createApp } from "./app.js";
import { env } from "./core/env.js";

const app = await createApp();
app.enableShutdownHooks();
await app.listen(env.API_PORT, "127.0.0.1");
console.log(`Oryvia API listening on http://127.0.0.1:${env.API_PORT}/api (docs: /api/docs)`);
