import { InferSchemaType, model, Schema } from "mongoose";

const bookSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    bookType: { type: String, enum: ["TEXTBOOK", "REFERENCE"], required: true },
    publisher: { type: String, default: "" },
    publicationYear: { type: Number, default: () => new Date().getFullYear() },
    coverPrice: { type: Number, required: true, min: 0 },
    totalCopies: { type: Number, required: true, min: 0 },
    availableCopies: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator: function (this: any, value: number) {
          return value <= (this.totalCopies ?? 0);
        },
        message: "Số bản có sẵn không được vượt quá tổng số bản",
      },
    },
    coverImageURL: { type: String, default: "" },
    isAvailableForCirculation: { type: Boolean, default: true },
    facultyId: { type: Schema.Types.ObjectId, ref: "Faculty", required: true },
    authorIds: [{
      type: Schema.Types.ObjectId, ref: "Author", required: true
    }]
  },
  {
    timestamps: true,
  },
);

export type Book = InferSchemaType<typeof bookSchema>;
export const BookModel = model("Book", bookSchema);

