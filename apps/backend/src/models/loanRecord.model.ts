// src/models/loanRecord.model.ts

import { InferSchemaType, model, Schema } from "mongoose";

export const LOAN_STATUSES = [
  "Đặt lịch mượn",
  "Đang mượn",
  "Quá hạn",
  "Chờ nộp phạt",
  "Đã trả",
  "Đã huỷ",
] as const;

export type LoanStatus = (typeof LOAN_STATUSES)[number];

const loadRecordSchema = new Schema(
  {
    reservationDate: { type: Date, required: true },
    reservationExpiryDate: { type: Date, required: true },
    handoverDate: { type: Date },
    dueDate: { type: Date },
    actualReturnDate: { type: Date },
    returnCondition: { type: String },
    status: {
      type: String,
      enum: LOAN_STATUSES,
      default: "Đặt lịch mượn",
      required: true,
    },
    isArchived: { type: Boolean, default: false },
    handoverEmployeeId: { type: Schema.Types.ObjectId, ref: "Employee" },
    returnEmployeeId: { type: Schema.Types.ObjectId, ref: "Employee" },
    readerId: { type: Schema.Types.ObjectId, ref: "Reader", required: true },
    bookId: { type: Schema.Types.ObjectId, ref: "Book", required: true },
  },
  { timestamps: true },
);

// Đánh đúng index phục vụ tra cứu BR_01, BR_03
loadRecordSchema.index({ readerId: 1, status: 1 });
loadRecordSchema.index({ readerId: 1, reservationDate: -1 });

export type LoadRecord = InferSchemaType<typeof loadRecordSchema>;
export default model("Load_Record", loadRecordSchema);
