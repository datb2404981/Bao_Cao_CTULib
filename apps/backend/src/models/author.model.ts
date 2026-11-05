import { InferSchemaType, model, Schema } from "mongoose";

const authorSchema = new Schema({
  fullName: { type: String, required: true },
  affiliation: { type: String },
  notes: { type: String },
}, {
  timestamps:true
});

export type Author = InferSchemaType<typeof authorSchema>;
export default model<Author>("Author", authorSchema);