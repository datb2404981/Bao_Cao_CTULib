import { logger } from "../config/logger.js";
import { syncExpiredLoanRecords } from "../services/loadRecord.service.js";

let timer: NodeJS.Timeout | null = null;
let isRunning = false;
export const startLoanExpiryScheduler = (intervalMs = 300_000) => {
  if (timer) return;
  logger.info("[Scheduler] Đã kích hoạt quét phiếu mượn tự động.");

  timer = setInterval(async () => {
    if (isRunning) return;
    isRunning = true;
    try {
      await syncExpiredLoanRecords();
    } catch (error: unknown) {
      logger.error("[Scheduler Error] Không thể đồng bộ phiếu hết hạn", error);
    } finally {
      isRunning = false;
    }
  }, intervalMs);
};

export const stopLoanExpiryScheduler = () => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
};
