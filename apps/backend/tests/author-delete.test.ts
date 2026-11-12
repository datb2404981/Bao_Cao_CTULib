import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import authorModel from "../src/models/author.model.js";
import bookModel from "../src/models/book.model.js";
import { deleteAuthor } from "../src/services/author.service.js";

const authorId = "507f1f77bcf86cd799439011";

afterEach(() => mock.restoreAll());

test("xóa tác giả từ chối mã không hợp lệ trước khi truy vấn", async () => {
  const exists = mock.method(authorModel, "exists", async () => null);
  const remove = mock.method(authorModel, "findByIdAndDelete", async () => null);

  await assert.rejects(deleteAuthor("wrong-id"), { statusCode: 400 });
  assert.equal(exists.mock.callCount(), 0);
  assert.equal(remove.mock.callCount(), 0);
});

test("xóa tác giả trả 404 nếu không tồn tại", async () => {
  mock.method(authorModel, "exists", async () => null);
  const books = mock.method(bookModel, "exists", async () => null);
  const remove = mock.method(authorModel, "findByIdAndDelete", async () => null);

  await assert.rejects(deleteAuthor(authorId), { statusCode: 404 });
  assert.equal(books.mock.callCount(), 0);
  assert.equal(remove.mock.callCount(), 0);
});

test("không xóa tác giả có sách liên kết trong authorIds", async () => {
  mock.method(authorModel, "exists", async () => ({ _id: authorId }));
  const books = mock.method(bookModel, "exists", async () => ({ _id: "book-id" }));
  const remove = mock.method(authorModel, "findByIdAndDelete", async () => null);

  await assert.rejects(deleteAuthor(authorId), {
    statusCode: 409,
    message: "Không thể xóa tác giả đang có sách liên kết.",
  });
  assert.deepEqual(books.mock.calls[0]?.arguments[0], { authorIds: authorId });
  assert.equal(remove.mock.callCount(), 0);
});

test("chỉ xóa tác giả không còn sách liên kết", async () => {
  mock.method(authorModel, "exists", async () => ({ _id: authorId }));
  mock.method(bookModel, "exists", async () => null);
  const deleted = { _id: authorId, fullName: "Tác giả kiểm thử" };
  const remove = mock.method(authorModel, "findByIdAndDelete", async () => deleted);

  assert.deepEqual(await deleteAuthor(authorId), deleted);
  assert.equal(remove.mock.callCount(), 1);
  assert.equal(remove.mock.calls[0]?.arguments[0], authorId);
});
