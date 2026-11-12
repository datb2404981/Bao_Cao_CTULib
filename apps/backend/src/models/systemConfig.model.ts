import { model, Schema } from "mongoose";

const systemConfigSchema = new Schema({
  key: {
    type: String,
    required: true,
    unique: true,
  },
  value: {
    type: Schema.Types.Mixed,
    required: true,
  },
  description: {
    type: String
  },
}, { timestamps: true });

export default model("SystemConfig", systemConfigSchema);
