import { model, Schema, InferSchemaType } from "mongoose";

const employeeSchema = new Schema({
  _id: {
    type: Schema.Types.ObjectId,
    ref: "Account",
    required: true
  },
  fullName: { type: String },
  position: { type: String },
  phoneNumber: { type: String },
  address: { type: String },
  permissionIds:[{type: Schema.Types.ObjectId, required: true}]
})

export type Employee = InferSchemaType<typeof employeeSchema>;
export default model<Employee>("Employee", employeeSchema); 