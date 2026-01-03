import "express-async-errors";

import express from "express";
import router from "./routes";

const WG_API_PORT = process.env.WG_API_PORT;

if (!WG_API_PORT) {
  console.error("FATAL: WG_API_PORT environment variable is required");
  process.exit(1);
}

const PORT = parseInt(WG_API_PORT, 10);

if (isNaN(PORT) || PORT < 1 || PORT > 65535) {
  console.error("FATAL: WG_API_PORT must be a valid port number (1-65535)");
  process.exit(1);
}

const app = express();
app.use(express.json());
app.use("/", router);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
