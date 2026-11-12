import systemConfigModel from "../models/systemConfig.model.js";
import { AppError } from "../utils/app-error.js";
import { createSystemConfigSchema, systemConfigValueSchema, updateSystemConfigSchema } from "../schemas/systemConfig.schema.js";

const getNumericConfig = async (key: string, defaultValue: number): Promise<number> => {
  const config = await systemConfigModel.findOne({ key }).lean();
  const parsed = systemConfigValueSchema(key).safeParse(config?.value);
  return parsed.success && typeof parsed.data === "number" ? parsed.data : defaultValue;
};

export const getAllSystemConfigs = async () => {
  return await systemConfigModel.find({}).lean();
};

export const updateSystemConfig = async (config: { key: string; value: number | string }) => {
  const parsed = updateSystemConfigSchema(config.key).safeParse({ value: config.value });
  if (!parsed.success) throw new AppError("Giá trị cấu hình không hợp lệ", 400);

  const updateConfig = await systemConfigModel.findOneAndUpdate(
    { key: config.key },
    { $set: { value: parsed.data.value } },
    { new: true, runValidators: true, upsert: true, setDefaultsOnInsert: true }
  );

  if (!updateConfig) {
    throw new AppError("Cấu hình không tồn tại", 404);
  }
  return updateConfig;
};

export const createSystemConfig = async (config: { key: string; value: number | string; description?: string }) => {
  const parsed = createSystemConfigSchema.safeParse(config);
  if (!parsed.success) throw new AppError("Dữ liệu cấu hình không hợp lệ", 400);
  return await systemConfigModel.create(parsed.data);
};

export const getLoanDuration = async (): Promise<number> => {
  return getNumericConfig("loanDuration", 7);
};

export const getOverdueFeePerDay = async (): Promise<number> => {
  return getNumericConfig("overdueFeePerDay", 5000);
};

export const getMaxBorrowLimit = async (): Promise<number> => {
  return getNumericConfig("maxBorrowLimit", 3);
};
