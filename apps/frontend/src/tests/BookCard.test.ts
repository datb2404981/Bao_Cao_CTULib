import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BookCard from '../components/catalog/BookCard.vue'
import type { Book } from '../types/book'

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
}

describe('BookCard.vue', () => {
  it('renders book title, metadata and formatted VNĐ price', () => {
    const wrapper = mount(BookCard, { props: { book: sampleBook } })
    expect(wrapper.find('.book-title').text()).toBe(sampleBook.title)
    expect(wrapper.text()).toContain('120.000')
    expect(wrapper.text()).toContain('2024')
    expect(wrapper.text()).toContain('NXB Đại học Cần Thơ')
  })

  it('renders "Còn X bản" when availableCopies > 0', () => {
    const wrapper = mount(BookCard, { props: { book: sampleBook } })
    const badge = wrapper.find('.badge-copies')
    expect(badge.exists()).toBe(true)
    expect(badge.text()).toContain('Còn 15 bản')
  })

  it('renders "Hết sách" and out-of-stock class when availableCopies === 0', () => {
    const wrapper = mount(BookCard, {
      props: { book: { ...sampleBook, availableCopies: 0 } },
    })
    const badge = wrapper.find('.badge-copies')
    expect(badge.text()).toContain('Hết sách')
    expect(badge.classes()).toContain('out-of-stock')
  })

  it('renders fallback icon when coverImageUrl is empty', () => {
    const wrapper = mount(BookCard, { props: { book: sampleBook } })
    expect(wrapper.find('svg.cover-placeholder-icon').exists()).toBe(true)
  })

  it('renders book type badge correctly', () => {
    const wrapper = mount(BookCard, { props: { book: sampleBook } })
    expect(wrapper.find('.badge').text()).toBe('Giáo trình')
  })

  it('emits select event with bookId on button click', async () => {
    const wrapper = mount(BookCard, { props: { book: sampleBook } })
    const btn = wrapper.find('button.btn-view')
    await btn.trigger('click')
    expect(wrapper.emitted('select')).toBeTruthy()
    expect(wrapper.emitted('select')![0]).toEqual([sampleBook.bookId])
  })

  it('exposes cover and title as keyboard-focusable buttons that open details', async () => {
    const wrapper = mount(BookCard, { props: { book: sampleBook } })
    const cover = wrapper.find('button.cover')
    const title = wrapper.find('h3.book-title button.book-title-action')

    expect(cover.exists()).toBe(true)
    expect(title.exists()).toBe(true)
    expect(cover.attributes('aria-label')).toContain(sampleBook.title)
    expect(cover.attributes('tabindex')).toBeUndefined()
    expect(title.attributes('tabindex')).toBeUndefined()

    await cover.trigger('click')
    await title.trigger('click')
    expect(wrapper.emitted('select')).toEqual([[sampleBook.bookId], [sampleBook.bookId]])
  })
})
