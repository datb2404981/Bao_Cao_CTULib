import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import BookDetailModal from '@/components/catalog/BookDetailModal.vue';
import * as bookService from '@/services/book';
import type { Book } from '@/types/book';

const { mockCurrentUser } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ref: vueRef } = require('vue');
  return {
    mockCurrentUser: vueRef<any>(null),
  };
});

vi.mock('@/services/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/auth')>();
  return {
    ...actual,
    currentUser: mockCurrentUser,
    refreshSession: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('@/services/book', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/book')>();
  return {
    ...actual,
    getBookById: vi.fn(),
  };
});

describe('Challenger Iteration 2: Empirical Verification of BookDetailModal & State Transitions', () => {
  const sampleBook: Book = {
    bookId: '56e6630ff48c0647904890f3',
    title: 'Lập trình Web với Node.js và TypeScript',
    bookType: 'TEXTBOOK',
    facultyId: 'ee584419975de7543b8c2fd2',
    authorIds: ['3028c4b741766ed91a3b43ac'],
    totalCopies: 20,
    availableCopies: 15,
    coverPrice: 120000,
    publicationYear: 2024,
    publisher: 'NXB Đại học Cần Thơ',
    isAvailableForCirculation: true,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    mockCurrentUser.value = null;
  });

  // =========================================================================
  // 1. EXACT PRICE FORMATTING TESTS (null, undefined, 0, 150000)
  // =========================================================================
  describe('1. Price Formatting Matrix (null, undefined, 0, 150000)', () => {
    it('formats coverPrice = 150000 correctly as "150.000 đồng"', () => {
      const book150k: Book = { ...sampleBook, coverPrice: 150000 };
      const wrapper = mount(BookDetailModal, {
        props: {
          isOpen: true,
          bookId: book150k.bookId,
          initialBook: book150k,
        },
      });
      expect(wrapper.find('dd.num').text()).toBe('150.000 đồng');
    });

    it('formats coverPrice = 0 correctly as "0 đồng"', () => {
      const book0: Book = { ...sampleBook, coverPrice: 0 };
      const wrapper = mount(BookDetailModal, {
        props: {
          isOpen: true,
          bookId: book0.bookId,
          initialBook: book0,
        },
      });
      expect(wrapper.find('dd.num').text()).toBe('0 đồng');
    });

    it('formats coverPrice = null to "Chưa cập nhật"', () => {
      const bookNull: Book = { ...sampleBook, coverPrice: null as unknown as number };
      const wrapper = mount(BookDetailModal, {
        props: {
          isOpen: true,
          bookId: bookNull.bookId,
          initialBook: bookNull,
        },
      });
      expect(wrapper.find('dd.num').text()).toBe('Chưa cập nhật');
    });

    it('formats coverPrice = undefined to "Chưa cập nhật"', () => {
      const bookUndefined: Book = { ...sampleBook, coverPrice: undefined as unknown as number };
      const wrapper = mount(BookDetailModal, {
        props: {
          isOpen: true,
          bookId: bookUndefined.bookId,
          initialBook: bookUndefined,
        },
      });
      expect(wrapper.find('dd.num').text()).toBe('Chưa cập nhật');
    });
  });

  // =========================================================================
  // 2. STATE TRANSITIONS & LIFECYCLE TESTS
  // =========================================================================
  describe('2. State Transitions & Lifecycle', () => {
    it('State Transition: opens with initialBook immediately, then updates with fetched book', async () => {
      mockCurrentUser.value = { role: 'READER' };
      const fetchedBook: Book = {
        ...sampleBook,
        title: 'Tựa đề mới từ API',
        coverPrice: 180000,
      };
      vi.spyOn(bookService, 'getBookById').mockResolvedValue(fetchedBook);

      const wrapper = mount(BookDetailModal, {
        props: {
          isOpen: true,
          bookId: sampleBook.bookId,
          initialBook: sampleBook,
        },
      });

      // Initially displays initialBook title
      expect(wrapper.find('h2').text()).toBe(sampleBook.title);
      expect(wrapper.find('dd.num').text()).toBe('120.000 đồng');

      await flushPromises();

      // After API resolves, displays updated title and price
      expect(wrapper.find('h2').text()).toBe('Tựa đề mới từ API');
      expect(wrapper.find('dd.num').text()).toBe('180.000 đồng');
    });

    it('State Transition: bookId switch while modal is open fetches new book', async () => {
      mockCurrentUser.value = { role: 'READER' };
      const bookA: Book = { ...sampleBook, bookId: 'book-A', title: 'Sách A' };
      const bookB: Book = { ...sampleBook, bookId: 'book-B', title: 'Sách B' };

      vi.spyOn(bookService, 'getBookById').mockImplementation(async (id: string) => {
        if (id === 'book-A') return bookA;
        if (id === 'book-B') return bookB;
        throw new Error('Not found');
      });

      const wrapper = mount(BookDetailModal, {
        props: {
          isOpen: true,
          bookId: 'book-A',
          initialBook: bookA,
        },
      });
      await flushPromises();
      expect(wrapper.find('h2').text()).toBe('Sách A');

      // Now switch bookId to 'book-B'
      await wrapper.setProps({
        bookId: 'book-B',
        initialBook: bookB,
      });
      await flushPromises();

      expect(wrapper.find('h2').text()).toBe('Sách B');
      expect(bookService.getBookById).toHaveBeenCalledWith('book-B');
    });

    it('State Transition: recovers initialBook and fetches book when isOpen transitions false -> true with pre-set bookId', async () => {
      mockCurrentUser.value = { role: 'READER' };
      vi.spyOn(bookService, 'getBookById').mockResolvedValue(sampleBook);

      const wrapper = mount(BookDetailModal, {
        props: {
          isOpen: false,
          bookId: sampleBook.bookId,
          initialBook: sampleBook,
        },
      });

      // When isOpen is false, dialog should not be rendered
      expect(wrapper.find('dialog').exists()).toBe(false);

      // Now set isOpen to true (while bookId remains unchanged)
      await wrapper.setProps({ isOpen: true });
      await flushPromises();

      // The dialog opens
      expect(wrapper.find('dialog').exists()).toBe(true);

      // Verified fix: Because watch observes [() => props.bookId, () => props.isOpen],
      // activeBook is restored and loadDetail is called.
      const isRendered = wrapper.find('h2').exists();
      expect(isRendered).toBe(true);
      expect(wrapper.find('h2').text()).toBe(sampleBook.title);
      expect(bookService.getBookById).toHaveBeenCalledWith(sampleBook.bookId);
    });

    it('State Transition: 401 error on getBookById falls back to initialBook', async () => {
      vi.spyOn(bookService, 'getBookById').mockRejectedValue({
        status: 401,
        message: 'Chưa đăng nhập',
      });

      const wrapper = mount(BookDetailModal, {
        props: {
          isOpen: true,
          bookId: sampleBook.bookId,
          initialBook: sampleBook,
        },
      });
      await flushPromises();

      // No error notice shown, initialBook kept
      expect(wrapper.find('.notice.error').exists()).toBe(false);
      expect(wrapper.find('h2').text()).toBe(sampleBook.title);
    });

    it('State Transition: 500 error on getBookById without initialBook displays error notice', async () => {
      vi.spyOn(bookService, 'getBookById').mockRejectedValue({
        status: 500,
        message: 'Lỗi máy chủ nội bộ 500',
      });

      const wrapper = mount(BookDetailModal, {
        props: {
          isOpen: true,
          bookId: sampleBook.bookId,
          initialBook: null,
        },
      });
      await flushPromises();

      expect(wrapper.find('.notice.error').exists()).toBe(true);
      expect(wrapper.text()).toContain('Lỗi máy chủ nội bộ 500');
    });

    it('State Transition: closing modal emits close event', async () => {
      const wrapper = mount(BookDetailModal, {
        props: {
          isOpen: true,
          bookId: sampleBook.bookId,
          initialBook: sampleBook,
        },
      });

      await wrapper.find('button.icon-btn').trigger('click');
      expect(wrapper.emitted('close')).toBeTruthy();
    });

    it('Borrowing Transition: emits require-login when unauthenticated, borrow when authenticated', async () => {
      // 1. Unauthenticated
      mockCurrentUser.value = null;
      const wrapper = mount(BookDetailModal, {
        props: {
          isOpen: true,
          bookId: sampleBook.bookId,
          initialBook: sampleBook,
        },
      });

      const borrowBtn = wrapper.find('button.primary');
      expect(borrowBtn.text()).toBe('Đăng nhập để mượn');
      await borrowBtn.trigger('click');
      expect(wrapper.emitted('require-login')).toBeTruthy();
      expect(wrapper.emitted('borrow')).toBeFalsy();

      // 2. Authenticated
      mockCurrentUser.value = { ctuIdentifier: 'B9900001', role: 'READER' };
      const wrapperAuth = mount(BookDetailModal, {
        props: {
          isOpen: true,
          bookId: sampleBook.bookId,
          initialBook: sampleBook,
        },
      });

      const borrowBtnAuth = wrapperAuth.find('button.primary');
      expect(borrowBtnAuth.text()).toBe('Đặt mượn');
      await borrowBtnAuth.trigger('click');
      expect(wrapperAuth.emitted('borrow')).toBeTruthy();
      expect(wrapperAuth.emitted('borrow')![0]![0]).toEqual(sampleBook);
    });
  });
});
