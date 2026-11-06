import { Schema,InferSchemaType, model } from "mongoose";

const permissionSchema = new Schema({
  permissionName: {type:String,required: true},
  description: { type: String, required: true }
});

export type Permission = InferSchemaType<typeof permissionSchema>
export default model<Permission>("Permission", permissionSchema)