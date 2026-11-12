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
  };
});

vi.mock('@/services/book', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/book')>();
  return {
    ...actual,
    getBookById: vi.fn(),
  };
});

describe('BookDetailModal.vue', () => {
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

  it('does not render modal content when isOpen is false', () => {
    const wrapper = mount(BookDetailModal, {
      props: {
        isOpen: false,
        bookId: null,
      },
    });
    expect(wrapper.find('dialog').exists()).toBe(false);
  });

  it('renders book metadata when isOpen is true and initialBook is provided', () => {
    const wrapper = mount(BookDetailModal, {
      props: {
        isOpen: true,
        bookId: sampleBook.bookId,
        initialBook: sampleBook,
        facultyName: 'Khoa Kỹ thuật Phần mềm',
        authorNames: 'GS. Nguyễn Văn A',
      },
    });

    expect(wrapper.find('h1#dialog-title').text()).toBe('Chi tiết sách');
    expect(wrapper.find('h2').text()).toBe(sampleBook.title);
    expect(wrapper.text()).toContain('Khoa Kỹ thuật Phần mềm');
    expect(wrapper.text()).toContain('GS. Nguyễn Văn A');
    expect(wrapper.text()).toContain('Giáo trình');
    expect(wrapper.text()).toContain('NXB Đại học Cần Thơ');
    expect(wrapper.text()).toContain('2024');
  });

  it('uses the same academic book cover placeholder as the catalog when no cover exists', () => {
    const wrapper = mount(BookDetailModal, {
      props: { isOpen: true, bookId: sampleBook.bookId, initialBook: sampleBook },
    });

    const cover = wrapper.get('.record-hero .academic-fallback');
    expect(cover.attributes('aria-label')).toBe(`Chưa có ảnh bìa của ${sampleBook.title}`);
    expect(cover.find('.spine-strip').exists()).toBe(true);
    expect(cover.find('.cover-placeholder-icon').exists()).toBe(true);
    expect(cover.find('.univ-stamp').text()).toBe('CTULIB');
    expect(cover.find('.sub-stamp').text()).toBe('GIÁO TRÌNH');
  });

  it('shows the reference-book variant in the detail cover placeholder', () => {
    const referenceBook: Book = { ...sampleBook, bookType: 'REFERENCE' };
    const wrapper = mount(BookDetailModal, {
      props: { isOpen: true, bookId: referenceBook.bookId, initialBook: referenceBook },
    });

    const cover = wrapper.get('.record-hero .academic-fallback');
    expect(cover.classes()).toContain('is-reference');
    expect(cover.find('.sub-stamp').text()).toBe('THAM KHẢO');
  });

  it('formats coverPrice = 120000 correctly as "120.000 đồng"', () => {
    const wrapper = mount(BookDetailModal, {
      props: {
        isOpen: true,
        bookId: sampleBook.bookId,
        initialBook: sampleBook,
      },
    });
    expect(wrapper.find('dd.num').text()).toBe('120.000 đồng');
  });

  it('formats coverPrice = 0 correctly as "0 đồng"', () => {
    const freeBook: Book = { ...sampleBook, coverPrice: 0 };
    const wrapper = mount(BookDetailModal, {
      props: {
        isOpen: true,
        bookId: freeBook.bookId,
        initialBook: freeBook,
      },
    });
    expect(wrapper.find('dd.num').text()).toBe('0 đồng');
  });

  it('formats coverPrice = null to "Chưa cập nhật"', () => {
    const nullPriceBook = { ...sampleBook, coverPrice: null as unknown as number };
    const wrapper = mount(BookDetailModal, {
      props: {
        isOpen: true,
        bookId: nullPriceBook.bookId,
        initialBook: nullPriceBook,
      },
    });
    expect(wrapper.find('dd.num').text()).toBe('Chưa cập nhật');
  });

  it('formats coverPrice = undefined to "Chưa cập nhật"', () => {
    const undefinedPriceBook = { ...sampleBook, coverPrice: undefined as unknown as number };
    const wrapper = mount(BookDetailModal, {
      props: {
        isOpen: true,
        bookId: undefinedPriceBook.bookId,
        initialBook: undefinedPriceBook,
      },
    });
    expect(wrapper.find('dd.num').text()).toBe('Chưa cập nhật');
  });

  it('shows availability badge: "15 bản" when availableCopies > 0', () => {
    const wrapper = mount(BookDetailModal, {
      props: {
        isOpen: true,
        bookId: sampleBook.bookId,
        initialBook: sampleBook,
      },
    });
    const availabilitySpan = wrapper.find('.availability');
    expect(availabilitySpan.text()).toBe('15 bản');
    expect(availabilitySpan.classes()).not.toContain('empty');
  });

  it('shows availability badge: "Hết bản khả dụng" when availableCopies === 0', () => {
    const outOfStockBook: Book = { ...sampleBook, availableCopies: 0 };
    const wrapper = mount(BookDetailModal, {
      props: {
        isOpen: true,
        bookId: outOfStockBook.bookId,
        initialBook: outOfStockBook,
      },
    });
    const availabilitySpan = wrapper.find('.availability');
    expect(availabilitySpan.text()).toBe('Hết bản khả dụng');
    expect(availabilitySpan.classes()).toContain('empty');
    expect(wrapper.find('button.primary').attributes('disabled')).toBeDefined();
  });

  it('shows login notice and button "Đăng nhập để mượn" when unauthenticated', async () => {
    mockCurrentUser.value = null;
    const wrapper = mount(BookDetailModal, {
      props: {
        isOpen: true,
        bookId: sampleBook.bookId,
        initialBook: sampleBook,
      },
    });

    expect(wrapper.find('.notice.info').exists()).toBe(true);
    expect(wrapper.text()).toContain('Bạn cần đăng nhập tài khoản CTULib để thực hiện chức năng mượn sách.');
    const actionBtn = wrapper.find('button.primary');
    expect(actionBtn.text()).toBe('Đăng nhập để mượn');

    await actionBtn.trigger('click');
    expect(wrapper.emitted('require-login')).toBeTruthy();
  });

  it('lets guests view the catalog book without calling a protected endpoint', async () => {
    const getSpy = vi.spyOn(bookService, 'getBookById');
    const wrapper = mount(BookDetailModal, {
      props: { isOpen: true, bookId: sampleBook.bookId, initialBook: sampleBook },
    });
    await flushPromises();
    expect(wrapper.text()).toContain(sampleBook.title);
    expect(getSpy).not.toHaveBeenCalled();
  });

  it('shows button "Đặt mượn" and emits borrow event when authenticated', async () => {
    mockCurrentUser.value = {
      ctuIdentifier: 'B9900001',
      role: 'READER',
      isActive: true,
    };
    const wrapper = mount(BookDetailModal, {
      props: {
        isOpen: true,
        bookId: sampleBook.bookId,
        initialBook: sampleBook,
      },
    });

    expect(wrapper.find('.notice.info').exists()).toBe(false);
    const actionBtn = wrapper.find('button.primary');
    expect(actionBtn.text()).toBe('Đặt mượn');

    await actionBtn.trigger('click');
    expect(wrapper.emitted('borrow')).toBeTruthy();
    expect(wrapper.emitted('borrow')![0]![0]).toEqual(sampleBook);
  });

  it('emits close event on close button click and backdrop click', async () => {
    const wrapper = mount(BookDetailModal, {
      props: {
        isOpen: true,
        bookId: sampleBook.bookId,
        initialBook: sampleBook,
      },
    });

    // Close icon button in header
    await wrapper.find('button.icon-btn').trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(1);

    // Footer "Đóng" button
    const footerCloseBtn = wrapper.findAll('footer button').find(b => b.text() === 'Đóng');
    await footerCloseBtn?.trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(2);

    // Click backdrop
    await wrapper.find('.modal-backdrop').trigger('click');
    expect(wrapper.emitted('close')).toHaveLength(3);
  });

  it('fetches book detail from API when bookId is provided and isOpen is true', async () => {
    vi.spyOn(bookService, 'getBookById').mockResolvedValue(sampleBook);

    mount(BookDetailModal, {
      props: {
        isOpen: true,
        bookId: sampleBook.bookId,
      },
    });
    await flushPromises();

    expect(bookService.getBookById).toHaveBeenCalledWith(sampleBook.bookId);
  });
});
