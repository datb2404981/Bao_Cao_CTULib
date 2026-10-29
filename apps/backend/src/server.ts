import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import { logger } from "./config/logger.js";
import { connectDB } from "./config/db.js";

dotenv.config();
const app = express();
const PORT = process.env.PORT || 8080;

app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || '*'
}));
app.use(express.json());

app.use(
  morgan(":method :url :status :res[content-length] - :response-time ms", {
    stream: {
      write: (msg) => {
        const status = Number(msg.match(/\s(\d{3})\s/)?.[1]);

        if (status >= 500) {
          logger.error(msg.trim());
        } else if (status >= 400) {
          logger.warn(msg.trim());
        } else {
          logger.http(msg.trim());
        }
      },
    },
  }),
);

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'success', message: 'API Service is healthy' });
});

app.listen(PORT, async () => {
  await connectDB();
  logger.info(`CTULib API server is running on port ${PORT}`);
})