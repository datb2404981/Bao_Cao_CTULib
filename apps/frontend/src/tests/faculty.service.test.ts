import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getAllFaculties,
  getFacultyById,
  createFaculty,
  updateFaculty,
  deleteFaculty,
  FacultyApiError,
} from '../services/faculty';
import type { Faculty } from '../types/faculty';

vi.mock('@/services/auth', () => ({
  getAccessToken: vi.fn().mockResolvedValue('mock-jwt-token-123'),
}));

const mockFaculty: Faculty = {
  _id: '69cabe960354ac17e1a6b400',
  facultyName: 'Khoa Công nghệ Thông tin & Truyền thông',
  description: 'Đào tạo ngành CNTT và truyền thông.',
};

describe('services/faculty.ts - Unit Tests', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('getAllFaculties', () => {
    it('FAC-SVC-001: Lấy toàn bộ danh sách khoa thành công (200 OK)', async () => {
      const mockResponseData = {
        status: 'success',
        data: [mockFaculty],
      };

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponseData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await getAllFaculties();

      expect(fetch).toHaveBeenCalledTimes(1);
      const [url, options] = vi.mocked(fetch).mock.calls[0]!;
      expect(String(url)).toBe('/faculty');
      expect(options?.method).toBe('GET');
      expect(result).toHaveLength(1);
      expect(result[0]?._id).toBe(mockFaculty._id);
      expect(result[0]?.facultyName).toBe(mockFaculty.facultyName);
    });

    it('FAC-SVC-002: Ném lỗi FacultyApiError khi máy chủ trả về lỗi 500', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({ status: 'error', message: 'Lỗi hệ thống máy chủ' }),
          { status: 500 }
        )
      );

      await expect(getAllFaculties()).rejects.toThrow(FacultyApiError);
    });

    it('FAC-SVC-003: Ném lỗi khi mất kết nối mạng', async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      await expect(getAllFaculties()).rejects.toThrow(FacultyApiError);
    });
  });

  describe('getFacultyById', () => {
    it('FAC-SVC-004: Lấy chi tiết khoa thành công theo ID hợp lệ', async () => {
      const mockResponseData = {
        status: 'success',
        data: mockFaculty,
      };

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponseData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await getFacultyById(mockFaculty._id);

      expect(fetch).toHaveBeenCalledTimes(1);
      const [url] = vi.mocked(fetch).mock.calls[0]!;
      expect(String(url)).toBe(`/faculty/${mockFaculty._id}`);
      expect(result._id).toBe(mockFaculty._id);
    });

    it('FAC-SVC-005: Ném lỗi 400 nếu truyền ID rỗng', async () => {
      await expect(getFacultyById('   ')).rejects.toThrowError('Mã khoa không hợp lệ.');
      expect(fetch).not.toHaveBeenCalled();
    });

    it('FAC-SVC-006: Ném lỗi 404 khi không tìm thấy khoa', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({ status: 'error', message: 'Khoa không tồn tại' }),
          { status: 404 }
        )
      );

      await expect(getFacultyById('000000000000000000000000')).rejects.toThrow(
        'Khoa không tồn tại'
      );
    });
  });

  describe('createFaculty', () => {
    it('FAC-SVC-007: Tạo mới khoa thành công (201 Created)', async () => {
      const payload = {
        facultyName: 'Khoa Kỹ thuật Phần mềm',
        description: 'Chuyên ngành CNPM',
      };

      const mockCreated = {
        _id: 'ee584419975de7543b8c2fd2',
        ...payload,
      };

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({ status: 'success', data: mockCreated }),
          { status: 201 }
        )
      );

      const result = await createFaculty(payload);

      expect(fetch).toHaveBeenCalledTimes(1);
      const [url, options] = vi.mocked(fetch).mock.calls[0]!;
      expect(String(url)).toBe('/faculty');
      expect(options?.method).toBe('POST');
      expect(JSON.parse(String(options?.body))).toEqual(payload);
      expect(result._id).toBe(mockCreated._id);
      expect(result.facultyName).toBe(mockCreated.facultyName);
    });

    it('FAC-SVC-008: Bắt lỗi 409 khi tên khoa đã tồn tại', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({ status: 'error', message: 'Khoa đã tồn tại' }),
          { status: 409 }
        )
      );

      await expect(
        createFaculty({ facultyName: 'Khoa Công nghệ Thông tin & Truyền thông' })
      ).rejects.toThrow('Khoa đã tồn tại');
    });

    it('FAC-SVC-009: Trích xuất đúng danh sách lỗi validate từ trường data', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'error',
            message: 'Dữ liệu gửi lên không hợp lệ.',
            data: [
              { field: 'facultyName', message: 'Tên khoa không được để trống' },
            ],
          }),
          { status: 400 }
        )
      );

      try {
        await createFaculty({ facultyName: '' });
        expect.unreachable('Cần ném ra lỗi validation');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(FacultyApiError);
        const apiErr = err as FacultyApiError;
        expect(apiErr.status).toBe(400);
        expect(apiErr.fields.facultyName).toBe('Tên khoa không được để trống');
      }
    });
  });

  describe('updateFaculty', () => {
    it('FAC-SVC-010: Cập nhật thông tin khoa thành công', async () => {
      const updateData = {
        facultyName: 'Khoa CNTT&TT Cải tiến',
        description: 'Mô tả cập nhật',
      };

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'success',
            data: { _id: mockFaculty._id, ...updateData },
          }),
          { status: 200 }
        )
      );

      const result = await updateFaculty(mockFaculty._id, updateData);

      expect(fetch).toHaveBeenCalledTimes(1);
      const [url, options] = vi.mocked(fetch).mock.calls[0]!;
      expect(String(url)).toBe(`/faculty/${mockFaculty._id}`);
      expect(options?.method).toBe('PUT');
      expect(result.facultyName).toBe(updateData.facultyName);
    });
  });

  describe('deleteFaculty', () => {
    it('FAC-SVC-011: Xóa khoa thành công', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'success',
            data: mockFaculty,
          }),
          { status: 200 }
        )
      );

      const result = await deleteFaculty(mockFaculty._id);

      expect(fetch).toHaveBeenCalledTimes(1);
      const [url, options] = vi.mocked(fetch).mock.calls[0]!;
      expect(String(url)).toBe(`/faculty/${mockFaculty._id}`);
      expect(options?.method).toBe('DELETE');
      expect(result._id).toBe(mockFaculty._id);
    });
  });
});

