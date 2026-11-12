import z from "zod";

export const registerSchema = z.strictObject({
  ctuIdentifier: z
    .string({ error: "Mã định danh phải là chuỗi" })
    .trim()
    .toUpperCase()
    .min(1, "Vui lòng nhập mã định danh")
    .max(10, "Mã định danh không được vượt quá 10 ký tự")
    .regex(/^(B\d{7}|CB\d{5}|ADMIN\d*)$/, "Mã định danh không đúng định dạng"),

  email: z
    .string({ error: "Email phải là chuỗi" })
    .trim()
    .min(1, "Vui lòng nhập email")
    .email("Email không đúng định dạng")
    .refine((value) => /[a-z]/i.test(value.split("@")[1]?.split(".")[0] ?? ""), "Tên miền email phải có chữ cái"),

  password: z
    .string({ error: "Mật khẩu phải là chuỗi" })
    .min(8, "Mật khẩu phải từ 8 kí tự")
    .refine((value) => value.trim().length >= 8, "Mật khẩu phải có ít nhất 8 ký tự không tính khoảng trắng ở đầu/cuối"),
});

export const loginSchema = z.strictObject({
  ctuIdentifier: z
    .string({ error: "Mã định danh phải là chuỗi" })
    .trim()
    .toUpperCase()
    .min(1, "Vui lòng nhập mã định danh"),

  password: z
    .string({ error: "Mật khẩu phải là chuỗi" })
    .min(1, "Vui lòng nhập mật khẩu"),
});
