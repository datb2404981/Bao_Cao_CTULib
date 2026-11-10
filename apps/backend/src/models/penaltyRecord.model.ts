import { InferSchemaType, model, Schema } from "mongoose";

const penaltyRecordSchema = new Schema({
  issuedDate: { type: Date, required: true, default: Date.now },
  overdueDays: { type: Number, default: 0 },
  appliedCoverPrice: { type: Number, required: true },
  damagePercentage: { type: Number, default: 0, min: 0, max: 100 },
  overdueFee: { type: Number, default: 0, min: 0 },
  damageFee: { type: Number, default: 0, min: 0 },
  totalPenalty: { type: Number, required: true, min: 0 },
  violationNote: { type: String, trim: true },
  paymentStatus: {
    type: String,
    enum: ["Chờ thanh toán", "Đã thanh toán"],
    default: "Chờ thanh toán",
    required: true,
  },
  paymentDate: { type: Date },
  amountCollected: { type: Number, default: 0, min: 0, required: true },
  paymentMethod: { type: String, enum: ["CASH"] },
  loanRecordId: {
    type: Schema.Types.ObjectId,
    ref: "Load_Record",
    required: true,
    unique: true,
  },
  paymentEmployeeId: {
    type: Schema.Types.ObjectId,
    ref: "Employee",
  },
}, {
  timestamps:true
});

// Index cho các trường phục vụ tra cứu và thanh toán
penaltyRecordSchema.index({ loanRecordId: 1, paymentStatus: 1 });
penaltyRecordSchema.index({ paymentStatus: 1 });
penaltyRecordSchema.index({ paymentDate: 1 });

export type PenaltyRecord = InferSchemaType<typeof penaltyRecordSchema>;
export default model("Penalty_Record", penaltyRecordSchema);
