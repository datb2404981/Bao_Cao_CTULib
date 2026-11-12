import { z } from "zod";

const genericValueSchema = z.union([z.number().finite(), z.string().trim().min(1)]);
const integerSchema = z.number().finite().int();

export const systemConfigValueSchema = (key: string) => {
  switch (key) {
    case "loanDuration":
      return integerSchema.min(1).max(90);
    case "maxBorrowLimit":
      return integerSchema.min(1).max(10);
    case "overdueFeePerDay":
      return integerSchema.min(1000).multipleOf(1000);
    default:
      return genericValueSchema;
  }
};

export const createSystemConfigSchema = z.object({
  key: z.string().trim().min(1).max(120),
  value: genericValueSchema,
  description: z.string().trim().optional(),
}).strict().refine(
  ({ key, value }) => systemConfigValueSchema(key).safeParse(value).success,
  { path: ["value"], message: "Giá trị cấu hình không hợp lệ" },
);

export const updateSystemConfigSchema = (key: string) => z.object({
  value: systemConfigValueSchema(key),
}).strict();
