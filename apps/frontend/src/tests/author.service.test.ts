import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getAllAuthors,
  getAuthorById,
  createAuthor,
  updateAuthor,
  deleteAuthor,
  AuthorApiError,
} from '../services/author';
import type { Author } from '../types/author';

vi.mock('@/services/auth', () => ({
  getAccessToken: vi.fn().mockResolvedValue('mock-jwt-token-123'),
}));

const mockAuthor: Author = {
  _id: '67cabe960354ac17e1a6b123',
  fullName: 'PGS.TS Nguyễn Văn An',
  affiliation: 'Trường CNTT&TT - ĐH Cần Thơ',
  notes: 'Chuyên gia Mạng máy tính',
};

describe('services/author.ts - Unit Tests', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('getAllAuthors', () => {
    it('AUT-SVC-001: Lấy toàn bộ danh sách tác giả thành công (200 OK)', async () => {
      const mockResponseData = {
        status: 'success',
        data: [mockAuthor],
      };

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponseData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await getAllAuthors();

      expect(fetch).toHaveBeenCalledTimes(1);
      const [url, options] = vi.mocked(fetch).mock.calls[0]!;
      expect(String(url)).toBe('/api/v1/author');
      expect(options?.method).toBe('GET');
      expect(result).toHaveLength(1);
      expect(result[0]?._id).toBe(mockAuthor._id);
      expect(result[0]?.fullName).toBe(mockAuthor.fullName);
    });

    it('AUT-SVC-002: Ném lỗi AuthorApiError khi máy chủ trả về lỗi 500', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'error',
            message: 'Internal Server Error',
            data: null,
          }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        )
      );

      await expect(getAllAuthors()).rejects.toThrowError(AuthorApiError);
    });

    it('AUT-SVC-003: Ném lỗi AuthorApiError khi mất kết nối mạng', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await expect(getAllAuthors()).rejects.toThrowError(AuthorApiError);
    });
  });

  describe('getAuthorById', () => {
    it('AUT-SVC-004: Lấy chi tiết tác giả thành công theo ID', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'success',
            data: mockAuthor,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const result = await getAuthorById(mockAuthor._id);
      expect(result.fullName).toBe(mockAuthor.fullName);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/v1/author/${mockAuthor._id}`),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('AUT-SVC-005: Báo lỗi 400 nếu truyền ID rỗng', async () => {
      await expect(getAuthorById('   ')).rejects.toThrow('Mã tác giả không hợp lệ.');
    });
  });

  describe('createAuthor', () => {
    it('AUT-SVC-006: Tạo mới tác giả thành công (201 Created)', async () => {
      const payload = {
        fullName: 'Trần Minh Hòa',
        affiliation: 'Khoa Kinh tế',
      };

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'success',
            data: { _id: 'new-author-id', ...payload },
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const result = await createAuthor(payload);
      expect(result.fullName).toBe(payload.fullName);
      expect(fetch).toHaveBeenCalledWith(
        '/api/v1/author',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(payload),
        })
      );
    });

    it('AUT-SVC-007: Xử lý lỗi trùng lặp tác giả (409 Conflict)', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'error',
            message: 'Tác giả đã tồn tại',
            data: null,
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } }
        )
      );

      await expect(createAuthor({ fullName: 'Nguyễn Văn An' })).rejects.toThrow(
        'Tác giả đã tồn tại'
      );
    });
  });

  describe('updateAuthor', () => {
    it('AUT-SVC-008: Cập nhật thông tin tác giả thành công', async () => {
      const updateData = {
        fullName: 'PGS.TS Nguyễn Văn An (Updated)',
        affiliation: 'Viện Công nghệ Thông tin',
      };

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'success',
            data: { _id: mockAuthor._id, ...updateData },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const result = await updateAuthor(mockAuthor._id, updateData);
      expect(result.fullName).toBe(updateData.fullName);
      expect(fetch).toHaveBeenCalledWith(
        `/api/v1/author/${mockAuthor._id}`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(updateData),
        })
      );
    });
  });

  describe('deleteAuthor', () => {
    it('AUT-SVC-009: Xóa tác giả thành công', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'success',
            data: mockAuthor,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const result = await deleteAuthor(mockAuthor._id);
      expect(result._id).toBe(mockAuthor._id);
      expect(fetch).toHaveBeenCalledWith(
        `/api/v1/author/${mockAuthor._id}`,
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });
});

