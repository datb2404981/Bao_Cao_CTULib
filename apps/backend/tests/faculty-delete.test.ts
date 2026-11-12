import assert from "node:assert/strict";
import { afterEach, mock, test } from "node:test";
import bookModel from "../src/models/book.model.js";
import facultyModel from "../src/models/faculty.model.js";
import readerModel from "../src/models/reader.model.js";
import { deleteFaculaty } from "../src/services/faculty.service.js";

const facultyId = "507f1f77bcf86cd799439011";

afterEach(() => mock.restoreAll());

test("xóa khoa từ chối mã không hợp lệ trước khi truy vấn", async () => {
  const exists = mock.method(facultyModel, "exists", async () => null);
  await assert.rejects(deleteFaculaty("wrong-id"), { statusCode: 400 });
  assert.equal(exists.mock.callCount(), 0);
});

test("xóa khoa trả 404 khi khoa không tồn tại", async () => {
  mock.method(facultyModel, "exists", async () => null);
  const remove = mock.method(facultyModel, "findByIdAndDelete", async () => null);
  await assert.rejects(deleteFaculaty(facultyId), { statusCode: 404 });
  assert.equal(remove.mock.callCount(), 0);
});

test("không xóa khoa đang được sách hoặc độc giả tham chiếu", async () => {
  for (const dependent of ["book", "reader"] as const) {
    mock.method(facultyModel, "exists", async () => ({ _id: facultyId }));
    const books = mock.method(bookModel, "exists", async () => dependent === "book" ? { _id: "book-id" } : null);
    const readers = mock.method(readerModel, "exists", async () => dependent === "reader" ? { _id: "reader-id" } : null);
    const remove = mock.method(facultyModel, "findByIdAndDelete", async () => null);

    await assert.rejects(deleteFaculaty(facultyId), { statusCode: 409 });
    assert.deepEqual(books.mock.calls[0]?.arguments[0], { facultyId });
    assert.deepEqual(readers.mock.calls[0]?.arguments[0], { facultyId });
    assert.equal(remove.mock.callCount(), 0);
    mock.restoreAll();
  }
});

test("chỉ xóa khoa không còn sách và độc giả liên kết", async () => {
  mock.method(facultyModel, "exists", async () => ({ _id: facultyId }));
  mock.method(bookModel, "exists", async () => null);
  mock.method(readerModel, "exists", async () => null);
  const deleted = { _id: facultyId, facultyName: "Khoa kiểm thử" };
  const remove = mock.method(facultyModel, "findByIdAndDelete", async () => deleted);

  assert.deepEqual(await deleteFaculaty(facultyId), deleted);
  assert.equal(remove.mock.callCount(), 1);
  assert.equal(remove.mock.calls[0]?.arguments[0], facultyId);
});
