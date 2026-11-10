import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import AuthorManagementView from '../views/AuthorManagementView.vue';
import * as authorService from '../services/author';
import type { Author } from '../types/author';

const mockAuthorsList: Author[] = [
  {
    _id: '67cabe960354ac17e1a6b001',
    fullName: 'Nguyễn Văn An',
    affiliation: 'Trường CNTT&TT - ĐH Cần Thơ',
    notes: 'Chuyên gia Trí tuệ nhân tạo',
  },
  {
    _id: '67cabe960354ac17e1a6b002',
    fullName: 'Trần Minh Hòa',
    affiliation: 'Khoa Kinh tế',
    notes: 'Tiến sĩ Quản trị',
  },
];

vi.mock('@/services/auth', () => ({
  currentUser: {
    value: {
      ctuIdentifier: 'CB00001',
      role: 'EMPLOYEE',
      permissions: ['MANAGE_AUTHORS'],
    },
  },
}));

describe('views/AuthorManagementView.vue - Unit Tests', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('VIEW-AUT-001: Tải và hiển thị danh sách Tác giả lên bảng SC16', async () => {
    vi.spyOn(authorService, 'getAllAuthors').mockResolvedValueOnce(mockAuthorsList);

    const wrapper = mount(AuthorManagementView);
    await flushPromises();

    expect(authorService.getAllAuthors).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('Nguyễn Văn An');
    expect(wrapper.text()).toContain('Trần Minh Hòa');
    expect(wrapper.text()).toContain('Hiển thị 2 / 2 tác giả');
  });

  it('VIEW-AUT-002: Lọc danh sách tác giả realtime theo từ khóa tìm kiếm', async () => {
    vi.spyOn(authorService, 'getAllAuthors').mockResolvedValueOnce(mockAuthorsList);

    const wrapper = mount(AuthorManagementView);
    await flushPromises();

    const searchInput = wrapper.find<HTMLInputElement>('input[type="search"]');
    await searchInput.setValue('Kinh tế');

    expect(wrapper.text()).toContain('Trần Minh Hòa');
    expect(wrapper.text()).not.toContain('Nguyễn Văn An');
    expect(wrapper.text()).toContain('Hiển thị 1 / 2 tác giả');
  });

  it('VIEW-AUT-003: Mở modal thêm tác giả khi click nút Thêm tác giả', async () => {
    vi.spyOn(authorService, 'getAllAuthors').mockResolvedValueOnce(mockAuthorsList);

    const wrapper = mount(AuthorManagementView);
    await flushPromises();

    const addBtn = wrapper.find('.add-btn');
    expect(addBtn.exists()).toBe(true);

    await addBtn.trigger('click');

    expect(wrapper.find('dialog').exists()).toBe(true);
    expect(wrapper.find('dialog h1').text()).toBe('Thêm tác giả');
  });

  it('VIEW-AUT-003a: Hiện lỗi tên trống bằng xác thực Vue và liên kết với trường nhập', async () => {
    vi.spyOn(authorService, 'getAllAuthors').mockResolvedValueOnce(mockAuthorsList);
    const createSpy = vi.spyOn(authorService, 'createAuthor').mockResolvedValueOnce(mockAuthorsList[0]!);

    const wrapper = mount(AuthorManagementView);
    await flushPromises();
    await wrapper.get('.add-btn').trigger('click');

    const form = wrapper.get('form#author-form');
    expect(form.attributes('novalidate')).toBeDefined();
    await form.trigger('submit');
    await flushPromises();

    const name = wrapper.get('input[name="fullName"]');
    expect(name.attributes('aria-invalid')).toBe('true');
    expect(name.attributes('aria-describedby')).toBe('author-fullName-error');
    expect(wrapper.get('#author-fullName-error').text()).toContain('không được để trống');
    expect(createSpy).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it('VIEW-AUT-004: Mở modal chỉnh sửa khi click nút Chỉnh sửa trên dòng bảng', async () => {
    vi.spyOn(authorService, 'getAllAuthors').mockResolvedValueOnce(mockAuthorsList);

    const wrapper = mount(AuthorManagementView);
    await flushPromises();

    const editBtn = wrapper.find('.edit-btn');
    await editBtn.trigger('click');

    expect(wrapper.find('dialog').exists()).toBe(true);
    expect(wrapper.find('dialog h1').text()).toBe('Chỉnh sửa tác giả');
    expect(wrapper.find<HTMLInputElement>('input[name="fullName"]').element.value).toBe('Nguyễn Văn An');
  });

  it('VIEW-AUT-005: Hiển thị banner lỗi khi gọi getAllAuthors thất bại', async () => {
    vi.spyOn(authorService, 'getAllAuthors').mockRejectedValueOnce(
      new authorService.AuthorApiError('Máy chủ không phản hồi', 500)
    );

    const wrapper = mount(AuthorManagementView);
    await flushPromises();

    expect(wrapper.find('.notice.error').exists()).toBe(true);
    expect(wrapper.text()).toContain('Máy chủ không phản hồi');
  });
});

