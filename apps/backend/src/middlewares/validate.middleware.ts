import { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodType } from 'zod';
export const validate = (schema: ZodType): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)
    
    if (!result.success) {
      const errors = result.error.issues.flatMap((issue) => {
        if (issue.code === "unrecognized_keys") {
          return issue.keys.map((key) => ({
            field: key,
            message: "Trường này không được phép gửi",
          }))
        }

        return [{
          field: issue.path.join(".") || "body",
          message: issue.message,
        }]
      });

      res.status(400).json({
        status: "error",
        message: "Dữ liệu gửi lên không hợp lệ",
        data: null,
      })
      return;
    }
    
    req.body = result.data;
    next()
  }
}