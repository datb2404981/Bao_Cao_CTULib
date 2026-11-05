import { InferRawDocType, InferSchemaType, model, Schema } from "mongoose";

const facultySchema = new Schema({
  facultyName: { type: String, require: true, unique: true },
  description: {type:String}
})

export type Faculty = InferSchemaType<typeof facultySchema>
export const facultyModel = model("Faculty", facultySchema)