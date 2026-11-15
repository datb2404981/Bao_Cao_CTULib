import { InferSchemaType, model, Schema } from "mongoose";

const publisherSchema = new Schema(
  {
    publisherCode: { type: String, trim: true, uppercase: true, unique: true, sparse: true },
    publisherName: { type: String, required: true, trim: true },
    address: { type: String, trim: true },
  },
  {
    timestamps: true,
  }
);

export type Publisher = InferSchemaType<typeof publisherSchema>;
export default model<Publisher>("Publisher", publisherSchema);
