import app from "./server.js";
import { createServer } from "http";
import cronJob from "./cron/index.js";
const httpServer = createServer(app);

cronJob();
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Listening on port: ${PORT}`);
});
