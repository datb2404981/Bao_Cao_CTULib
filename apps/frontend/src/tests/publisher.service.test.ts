import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getAllPublishers,
  getPublisherById,
  createPublisher,
  updatePublisher,
  deletePublisher,
  PublisherApiError,
} from '../services/publisher';
import type { Publisher } from '../types/publisher';

vi.mock('@/services/auth', () => ({
  getAccessToken: vi.fn().mockResolvedValue('mock-jwt-token-123'),
}));

const mockPublisher: Publisher = {
  _id: '67cabe960354ac17e1a6b456',
  publisherCode: 'NXB-CTU',
  publisherName: 'Nhà xuất bản Đại học Cần Thơ',
  address: 'Khu II, đường 3/2, P. Xuân Khánh, Q. Ninh Kiều, TP. Cần Thơ',
};

describe('services/publisher.ts - Unit Tests', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe('getAllPublishers', () => {
    it('PUB-SVC-001: Lấy danh sách NXB thành công (200 OK)', async () => {
      const mockResponseData = {
        status: 'success',
        data: [mockPublisher],
      };

      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(JSON.stringify(mockResponseData), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

      const result = await getAllPublishers();

      expect(fetch).toHaveBeenCalledTimes(1);
      const [url, options] = vi.mocked(fetch).mock.calls[0]!;
      expect(String(url)).toBe('/api/v1/publisher');
      expect(options?.method).toBe('GET');
      expect(result).toHaveLength(1);
      expect(result[0]?._id).toBe(mockPublisher._id);
      expect(result[0]?.publisherName).toBe(mockPublisher.publisherName);
    });

    it('PUB-SVC-002: Ném PublisherApiError khi máy chủ trả về lỗi 500', async () => {
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

      await expect(getAllPublishers()).rejects.toThrow(PublisherApiError);
    });
  });

  describe('getPublisherById', () => {
    it('PUB-SVC-003: Lấy chi tiết NXB theo ID thành công', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'success',
            data: mockPublisher,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const result = await getPublisherById('67cabe960354ac17e1a6b456');
      expect(result._id).toBe(mockPublisher._id);
      expect(result.publisherName).toBe(mockPublisher.publisherName);
    });

    it('PUB-SVC-004: Ném lỗi khi id rỗng', async () => {
      await expect(getPublisherById('   ')).rejects.toThrow('Mã nhà xuất bản không hợp lệ.');
    });
  });

  describe('createPublisher', () => {
    it('PUB-SVC-005: Tạo NXB thành công', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'success',
            data: mockPublisher,
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const result = await createPublisher({
        publisherName: 'Nhà xuất bản Đại học Cần Thơ',
        address: 'Khu II ĐHCT',
      });

      expect(result.publisherName).toBe(mockPublisher.publisherName);
    });
  });

  describe('updatePublisher & deletePublisher', () => {
    it('PUB-SVC-006: Cập nhật NXB thành công', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'success',
            data: { ...mockPublisher, publisherName: 'NXB Giáo Dục' },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const result = await updatePublisher(mockPublisher._id, {
        publisherName: 'NXB Giáo Dục',
      });

      expect(result.publisherName).toBe('NXB Giáo Dục');
    });

    it('PUB-SVC-007: Xóa NXB thành công', async () => {
      vi.mocked(fetch).mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 'success',
            data: mockPublisher,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      );

      const result = await deletePublisher(mockPublisher._id);
      expect(result._id).toBe(mockPublisher._id);
    });
  });
});
