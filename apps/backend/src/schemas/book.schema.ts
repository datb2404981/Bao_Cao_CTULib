import z from "zod";

const objectIdRegex = /^[a-fA-F0-9]{24}$/;

export const createBookSchema = z.object({
  title: z.string().trim().min(1, { message: "Vui lòng nhập tên sách" }),
  facultyId: z.string().regex(objectIdRegex, { message: "Mã khoa không hợp lệ" }),
  authorIds: z
    .array(z.string().regex(objectIdRegex, { message: "Mã tác giả không hợp lệ" }))
    .min(1, { message: "Sách phải có ít nhất một tác giả" })
    .refine((ids) => new Set(ids).size === ids.length, {
      message: "Danh sách tác giả không được trùng lặp",
    }),
  bookType: z
    .enum(["TEXTBOOK", "REFERENCE"], {
      message: "Loại sách phải là TEXTBOOK hoặc REFERENCE",
    })
    .optional()
    .default("TEXTBOOK"),
  totalCopies: z
    .number({ message: "Vui lòng nhập tổng số bản" })
    .int({ message: "Tổng số bản phải là số nguyên" })
    .min(0, { message: "Tổng số bản không được âm" }),
  coverPrice: z
    .number({ message: "Vui lòng nhập giá bìa" })
    .min(0, { message: "Giá bìa không được âm" }),
  publisher: z.string().trim().optional(),
  publicationYear: z
    .number()
    .int({ message: "Năm xuất bản phải là số nguyên" })
    .positive({ message: "Năm xuất bản phải là số dương" })
    .max(new Date().getFullYear() + 1, {
      message: `Năm xuất bản không được lớn hơn ${new Date().getFullYear() + 1}`,
    })
    .optional(),
  coverImageUrl: z
    .string()
    .url({ message: "Đường dẫn ảnh bìa không hợp lệ" })
    .optional(),
  coverImageURL: z
    .string()
    .url({ message: "Đường dẫn ảnh bìa không hợp lệ" })
    .optional(),
  isAvailableForCirculation: z.boolean().optional().default(true),
  availableCopies: z.number().optional(),
});

export const bookSchema = createBookSchema;
