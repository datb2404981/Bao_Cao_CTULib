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
  facultyId: {
    type: Schema.Types.ObjectId,
    ref: "Faculty",
    required: true,
  },
});

export type Reader = InferSchemaType<typeof readerSchema>;
export default model<Reader>("Reader", readerSchema);
