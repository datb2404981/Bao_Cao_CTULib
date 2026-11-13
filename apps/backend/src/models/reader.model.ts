import { Schema, InferSchemaType, model } from "mongoose";

const readerSchema = new Schema({
  _id: {
    type: Schema.Types.ObjectId,
    ref: "Account",
    required: true,
  },
  fullName: { type: String },
  dateOfBirth: { type: Date },
  phoneNumber: { type: String },
  address: { type: String },
  readerType: { type: String, enum: ["STUDENT", "POSTGRADUATE", "STAFF"] },
  isBorrowingBlocked: { type: Boolean, required: true, default: false },
  // Giữ riêng lệnh khóa thủ công để thu xong tiền phạt không tự gỡ khóa của thủ thư.
  isBorrowingManuallyBlocked: { type: Boolean, required: true, default: false },
  borrowingBlockReason: { type: String, default: "" },
  facultyId: {
    type: Schema.Types.ObjectId,
    ref: "Faculty",
    required: false,
  },
  // Version dùng để tuần tự hóa các lần đặt sách đồng thời của cùng độc giả.
  // Không dùng làm bộ đếm: số phiếu đang hoạt động lấy trực tiếp từ Loan_Record.
  loanReservationVersion: { type: Number, default: 0, required: true },
});

export type Reader = InferSchemaType<typeof readerSchema>;
export default model<Reader>("Reader", readerSchema);
