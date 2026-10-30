import { app } from "./app.js";
import { connectDB } from "./config/db.js";
import { logger } from "./config/logger.js";

const PORT = process.env.PORT || 8080;

app.listen(PORT, async () => {
  await connectDB();
  logger.info(`CTULib API server is running on port ${PORT}`);
});
