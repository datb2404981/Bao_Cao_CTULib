import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import BookFormModal from '../components/management/BookFormModal.vue';
import BookCatalogView from '../views/BookCatalogView.vue';
import * as bookService from '@/services/book';
import type { CreateBookPayload, Book } from '../types/book';

vi.mock('@/services/book', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/book')>();
  return {
    ...actual,
    getAllBooks: vi.fn(),
  };
});

describe('Challenger Iteration 2: Stress Testing Suite', () => {
  const faculties = [{ _id: 'faculty-01', facultyName: 'Khoa Công nghệ Thông tin' }];
  const authors = [{ _id: 'author-01', fullName: 'GS. Nguyễn Văn A' }];

  describe('1. BookFormModal - Publication Year Stress Tests', () => {
    async function setupValidForm(publicationYearValue: any) {
      const wrapper = mount(BookFormModal, {
        props: {
          isOpen: true,
          faculties,
          authors,
          isSubmitting: false,
          serverError: null,
          serverFieldErrors: {},
        },
      });

      await wrapper.find('input[name="title"]').setValue('Nhập môn Công nghệ phần mềm');
      await wrapper.find('select[name="facultyId"]').setValue(faculties[0]._id);
      await wrapper.find('select[name="authorIds"]').setValue([authors[0]._id]);
      await wrapper.find('input[name="totalCopies"]').setValue('10');
      await wrapper.find('input[name="coverPrice"]').setValue('75000');
      await wrapper.find('input[name="publicationYear"]').setValue(publicationYearValue);
      return wrapper;
    }

    it('rejects publicationYear = 0 with "Năm xuất bản phải là số dương"', async () => {
      const wrapper = await setupValidForm('0');
      await wrapper.find('form').trigger('submit.prevent');
      await flushPromises();

      expect(wrapper.emitted('submit')).toBeFalsy();
      expect(wrapper.text()).toContain('Năm xuất bản phải là số dương');
      const input = wrapper.find('input[name="publicationYear"]');
      expect(input.attributes('aria-invalid')).toBe('true');
    });

    it('rejects publicationYear = -5 (negative number)', async () => {
      const wrapper = await setupValidForm('-5');
      await wrapper.find('form').trigger('submit.prevent');
      await flushPromises();

      expect(wrapper.emitted('submit')).toBeFalsy();
      expect(wrapper.text()).toContain('Năm xuất bản phải là số dương');
      const input = wrapper.find('input[name="publicationYear"]');
      expect(input.attributes('aria-invalid')).toBe('true');
    });

    it('rejects publicationYear = 2099 (future year beyond next year)', async () => {
      const currentYear = new Date().getFullYear();
      const wrapper = await setupValidForm('2099');
      await wrapper.find('form').trigger('submit.prevent');
      await flushPromises();

      expect(wrapper.emitted('submit')).toBeFalsy();
      expect(wrapper.text()).toContain(`Năm xuất bản không được lớn hơn ${currentYear + 1}`);
      const input = wrapper.find('input[name="publicationYear"]');
      expect(input.attributes('aria-invalid')).toBe('true');
    });

    it('rejects non-numeric publicationYear via initialData or model state', async () => {
      const wrapper = mount(BookFormModal, {
        props: {
          isOpen: true,
          faculties,
          authors,
          initialData: {
            title: 'Sách kiểm tra năm không phải số',
            facultyId: faculties[0]._id,
            authorIds: [authors[0]._id],
            totalCopies: 5,
            coverPrice: 50000,
            publicationYear: 'abc' as any,
          },
        },
      });

      await wrapper.find('form').trigger('submit.prevent');
      await flushPromises();

      expect(wrapper.emitted('submit')).toBeFalsy();
      expect(wrapper.text()).toContain('Năm xuất bản phải là số nguyên');
    });

    it('rejects non-integer publicationYear (e.g. 2024.5)', async () => {
      const wrapper = await setupValidForm('2024.5');
      await wrapper.find('form').trigger('submit.prevent');
      await flushPromises();

      expect(wrapper.emitted('submit')).toBeFalsy();
      expect(wrapper.text()).toContain('Năm xuất bản phải là số nguyên');
    });

    it('accepts empty string publicationYear and emits payload with publicationYear = undefined', async () => {
      const wrapper = await setupValidForm('');
      await wrapper.find('form').trigger('submit.prevent');
      await flushPromises();

      expect(wrapper.emitted('submit')).toBeTruthy();
      const payload = wrapper.emitted('submit')![0]![0] as CreateBookPayload;
      expect(payload.publicationYear).toBeUndefined();
    });

    it('accepts whitespace-only publicationYear and emits payload with publicationYear = undefined', async () => {
      const wrapper = await setupValidForm('   ');
      await wrapper.find('form').trigger('submit.prevent');
      await flushPromises();

      expect(wrapper.emitted('submit')).toBeTruthy();
      const payload = wrapper.emitted('submit')![0]![0] as CreateBookPayload;
      expect(payload.publicationYear).toBeUndefined();
    });

    it('accepts valid boundary publicationYear = currentYear + 1', async () => {
      const nextYear = new Date().getFullYear() + 1;
      const wrapper = await setupValidForm(String(nextYear));
      await wrapper.find('form').trigger('submit.prevent');
      await flushPromises();

      expect(wrapper.emitted('submit')).toBeTruthy();
      const payload = wrapper.emitted('submit')![0]![0] as CreateBookPayload;
      expect(payload.publicationYear).toBe(nextYear);
    });

    it('rejects boundary publicationYear = currentYear + 2', async () => {
      const maxPlusOne = new Date().getFullYear() + 2;
      const wrapper = await setupValidForm(String(maxPlusOne));
      await wrapper.find('form').trigger('submit.prevent');
      await flushPromises();

      expect(wrapper.emitted('submit')).toBeFalsy();
      expect(wrapper.text()).toContain(`Năm xuất bản không được lớn hơn ${new Date().getFullYear() + 1}`);
    });

    it('accepts lowest positive integer publicationYear = 1', async () => {
      const wrapper = await setupValidForm('1');
      await wrapper.find('form').trigger('submit.prevent');
      await flushPromises();

      expect(wrapper.emitted('submit')).toBeTruthy();
      const payload = wrapper.emitted('submit')![0]![0] as CreateBookPayload;
      expect(payload.publicationYear).toBe(1);
    });
  });

  describe('2. BookCatalogView - Filter, Pagination, Empty Search & Rapid Debounce Stress Tests', () => {
    const sampleBooks: Book[] = [
      {
        bookId: 'b01',
        title: 'Giáo trình Mạng Máy Tính',
        bookType: 'TEXTBOOK',
        facultyId: 'faculty-01',
        authorIds: ['author-01'],
        totalCopies: 10,
        availableCopies: 8,
        coverPrice: 85000,
        isAvailableForCirculation: true,
      },
      {
        bookId: 'b02',
        title: 'Tài liệu Tham Khảo An Ninh Mạng',
        bookType: 'REFERENCE',
        facultyId: 'faculty-01',
        authorIds: ['author-01'],
        totalCopies: 5,
        availableCopies: 3,
        coverPrice: 150000,
        isAvailableForCirculation: true,
      },
    ];

    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('stress tests bookType filtering with pagination synchronization', async () => {
      const listSpy = vi.spyOn(bookService, 'getAllBooks').mockImplementation(async (params) => ({
        items: params?.bookType ? sampleBooks.filter(book => book.bookType === params.bookType) : sampleBooks,
        meta: { totalItems: params?.bookType ? 1 : 2, totalPages: 1, currentPage: 1, limit: 12 },
      }));

      const wrapper = mount(BookCatalogView);
      await flushPromises();

      // Initial state: shows 2 books
      expect(wrapper.findAll('.book-card').length).toBe(2);
      expect(wrapper.find('.results-line').text()).toContain('2 ấn phẩm');

      // Filter by TEXTBOOK
      await wrapper.find('select.kind-select').setValue('TEXTBOOK');
      await wrapper.find('form.filters').trigger('submit.prevent');
      await flushPromises();
      expect(listSpy).toHaveBeenCalledWith(expect.objectContaining({ bookType: 'TEXTBOOK' }));

      // Only 1 book card rendered
      expect(wrapper.findAll('.book-card').length).toBe(1);
      expect(wrapper.text()).toContain('Giáo trình Mạng Máy Tính');
      expect(wrapper.text()).not.toContain('Tài liệu Tham Khảo An Ninh Mạng');
      // Count synchronised to 1
      expect(wrapper.find('.results-line').text()).toContain('1 ấn phẩm');

      // Wait 60ms to exceed search throttle
      await new Promise((r) => setTimeout(r, 60));

      // Không còn sách khớp điều kiện thì API trả đúng danh sách trống và tổng = 0.
      vi.spyOn(bookService, 'getAllBooks').mockResolvedValue({
        items: [],
        meta: { totalItems: 0, totalPages: 0, currentPage: 1, limit: 12 },
      });
      await wrapper.find('select.kind-select').setValue('REFERENCE');
      await wrapper.find('form.filters').trigger('submit.prevent');
      await flushPromises();

      // Empty state displayed, results-line shows 0
      expect(wrapper.find('.empty-state').exists()).toBe(true);
      expect(wrapper.find('.results-line').text()).toContain('0 ấn phẩm');
      expect(wrapper.find('.pagination-bar').exists()).toBe(false); // pagination hidden when 0 items
    });

    it('stress tests empty searches: space-only search sanitizes to undefined', async () => {
      const getAllSpy = vi.spyOn(bookService, 'getAllBooks').mockResolvedValue({
        items: sampleBooks,
        meta: { totalItems: 2, totalPages: 1, currentPage: 1, limit: 12 },
      });

      const wrapper = mount(BookCatalogView);
      await flushPromises();
      expect(getAllSpy).toHaveBeenCalledWith({
        page: 1,
        limit: 12,
        search: undefined,
        facultyId: undefined,
      });

      // User enters whitespace-only search
      const searchInput = wrapper.find('input[type="search"]');
      await searchInput.setValue('     ');
      await wrapper.find('form.filters').trigger('submit.prevent');
      await flushPromises();

      // search param should be sanitized to undefined (not sending literal spaces)
      expect(getAllSpy).toHaveBeenLastCalledWith({
        page: 1,
        limit: 12,
        search: undefined,
        facultyId: undefined,
      });
    });

    it('stress tests rapid debounce typing: only triggers single search after 300ms idle', async () => {
      const getAllSpy = vi.spyOn(bookService, 'getAllBooks').mockResolvedValue({
        items: sampleBooks,
        meta: { totalItems: 2, totalPages: 1, currentPage: 1, limit: 12 },
      });

      const wrapper = mount(BookCatalogView);
      await flushPromises();
      expect(getAllSpy).toHaveBeenCalledTimes(1);

      const searchInput = wrapper.find('input[type="search"]');

      // Simulate rapid keystrokes within 50ms intervals
      await searchInput.setValue('C');
      await new Promise((r) => setTimeout(r, 40));
      await searchInput.setValue('CT');
      await new Promise((r) => setTimeout(r, 40));
      await searchInput.setValue('CTU');
      await new Promise((r) => setTimeout(r, 40));
      await searchInput.setValue('CTULib');

      // Before 300ms expires, no extra API calls
      await new Promise((r) => setTimeout(r, 100));
      await flushPromises();
      expect(getAllSpy).toHaveBeenCalledTimes(1);

      // After 300ms debounce expires (total > 350ms since last input)
      await new Promise((r) => setTimeout(r, 250));
      await flushPromises();
      expect(getAllSpy).toHaveBeenCalledTimes(2);
      expect(getAllSpy).toHaveBeenLastCalledWith({
        page: 1,
        limit: 12,
        search: 'CTULib',
        facultyId: undefined,
      });
    });

    it('stress tests rapid debounce typing followed immediately by Enter submit: throttled to 1 API call', async () => {
      const getAllSpy = vi.spyOn(bookService, 'getAllBooks').mockResolvedValue({
        items: sampleBooks,
        meta: { totalItems: 2, totalPages: 1, currentPage: 1, limit: 12 },
      });

      const wrapper = mount(BookCatalogView);
      await flushPromises();
      expect(getAllSpy).toHaveBeenCalledTimes(1);

      const searchInput = wrapper.find('input[type="search"]');
      await searchInput.setValue('Kỹ thuật');
      // User immediately submits form without waiting for debounce
      await wrapper.find('form.filters').trigger('submit.prevent');
      await flushPromises();

      // Wait 350ms to verify debounce doesn't trigger a duplicate second call
      await new Promise((r) => setTimeout(r, 350));
      await flushPromises();

      // Exactly 1 additional call made, not 2
      expect(getAllSpy).toHaveBeenCalledTimes(2);
      expect(getAllSpy).toHaveBeenLastCalledWith({
        page: 1,
        limit: 12,
        search: 'Kỹ thuật',
        facultyId: undefined,
      });
    });

    it('stress tests onResetFilters: resets search, bookType, facultyId, and pagination', async () => {
      const getAllSpy = vi.spyOn(bookService, 'getAllBooks').mockResolvedValue({
        items: sampleBooks,
        meta: { totalItems: 2, totalPages: 1, currentPage: 1, limit: 12 },
      });

      const wrapper = mount(BookCatalogView);
      await flushPromises();

      // Set some filters
      await wrapper.find('input[type="search"]').setValue('Mạng');
      await wrapper.find('select.kind-select').setValue('TEXTBOOK');
      await wrapper.find('form.filters').trigger('submit.prevent');
      await flushPromises();

      // Click "Xóa bộ lọc"
      await wrapper.find('button[data-reset-filter]').trigger('click');
      await flushPromises();

      // Form inputs should be cleared
      expect((wrapper.find('input[type="search"]').element as HTMLInputElement).value).toBe('');
      expect((wrapper.find('select.kind-select').element as HTMLSelectElement).value).toBe('');

      // Last call to API has clean params
      expect(getAllSpy).toHaveBeenLastCalledWith({
        page: 1,
        limit: 12,
        search: undefined,
        facultyId: undefined,
      });
    });
  });
});
