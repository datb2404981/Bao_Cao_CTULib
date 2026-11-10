import { app } from "./app.js";
import { connectDB } from "./config/db.js";
import { logger } from "./config/logger.js";
import { startLoanExpiryScheduler } from "./schedulers/loan-expiry.scheduler.js";

const PORT = process.env.PORT || 8080;

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      logger.info(`CTULib API server is running on port ${PORT}`);

      startLoanExpiryScheduler(300_000);
    })
  } catch(error){
    logger.error("Không thể khởi động server:", error);
    process.exit(1);
  }
}

void startServer()