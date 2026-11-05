import { InferRawDocType, InferSchemaType, model, Schema } from "mongoose";

const facultySchema = new Schema({
  facultyName: { type: String, required: true, unique: true },
  description: { type: String },
});

export type Faculty = InferSchemaType<typeof facultySchema>;
export default model("Faculty", facultySchema);
