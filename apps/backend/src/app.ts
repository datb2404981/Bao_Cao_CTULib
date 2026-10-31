import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { logger } from "./config/logger.js";
import routes from "./routes/index.js";
import { errorHandler, notFound } from "./middlewares/error.middleware.js";
import cookieParser from "cookie-parser";

export const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
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

app.use(cookieParser());
app.use(routes);
app.use(notFound);
app.use(errorHandler);
