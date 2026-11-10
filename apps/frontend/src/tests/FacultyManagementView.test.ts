import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import FacultyManagementView from '../views/FacultyManagementView.vue';
import * as facultyService from '../services/faculty';
import type { Faculty } from '../types/faculty';

const mockFacultiesList: Faculty[] = [
  {
    _id: '69cabe960354ac17e1a6b400',
    facultyName: 'Khoa Công nghệ Thông tin & Truyền thông',
    description: 'Chuyên ngành CNTT',
  },
  {
    _id: '2f4d9cfb1e1f495d1a54c5c9',
    facultyName: 'Khoa Kinh tế',
    description: 'Chuyên ngành Kinh tế & Quản trị',
  },
];

// Mock currentUser với quyền EMPLOYEE
vi.mock('@/services/auth', () => ({
  currentUser: {
    value: {
      ctuIdentifier: 'CB00001',
      role: 'EMPLOYEE',
      permissions: ['MANAGE_FACULTIES'],
    },
  },
}));

describe('FacultyManagementView.vue', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('VIEW-001: Tải và hiển thị danh sách Khoa/Viện lên bảng SC15', async () => {
    vi.spyOn(facultyService, 'getAllFaculties').mockResolvedValueOnce(mockFacultiesList);

    const wrapper = mount(FacultyManagementView);
    await flushPromises();

    expect(facultyService.getAllFaculties).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).toContain('Khoa Công nghệ Thông tin & Truyền thông');
    expect(wrapper.text()).toContain('Khoa Kinh tế');
    expect(wrapper.text()).toContain('Hiển thị 2 / 2 khoa/viện');
  });

  it('VIEW-002: Lọc danh sách khoa realtime theo từ khóa tìm kiếm', async () => {
    vi.spyOn(facultyService, 'getAllFaculties').mockResolvedValueOnce(mockFacultiesList);

    const wrapper = mount(FacultyManagementView);
    await flushPromises();

    const searchInput = wrapper.find<HTMLInputElement>('input[type="search"]');
    await searchInput.setValue('Kinh tế');

    expect(wrapper.text()).toContain('Khoa Kinh tế');
    expect(wrapper.text()).not.toContain('Khoa Công nghệ Thông tin & Truyền thông');
    expect(wrapper.text()).toContain('Hiển thị 1 / 2 khoa/viện');
  });

  it('VIEW-003: Mở modal thêm khoa khi bấm nút "Thêm khoa/viện"', async () => {
    vi.spyOn(facultyService, 'getAllFaculties').mockResolvedValueOnce(mockFacultiesList);

    const wrapper = mount(FacultyManagementView);
    await flushPromises();

    const addBtn = wrapper.find('button.add-btn');
    await addBtn.trigger('click');

    expect(wrapper.find('dialog').exists()).toBe(true);
    expect(wrapper.find('h1#faculty-dialog-title').text()).toBe('Thêm khoa/viện');
  });

  it('VIEW-004: Mở modal chỉnh sửa khi bấm nút "Chỉnh sửa" trên hàng', async () => {
    vi.spyOn(facultyService, 'getAllFaculties').mockResolvedValueOnce(mockFacultiesList);

    const wrapper = mount(FacultyManagementView);
    await flushPromises();

    const editButtons = wrapper.findAll('button.edit-btn');
    expect(editButtons.length).toBeGreaterThanOrEqual(1);
    await editButtons[0]!.trigger('click');

    expect(wrapper.find('dialog').exists()).toBe(true);
    expect(wrapper.find('h1#faculty-dialog-title').text()).toBe('Chỉnh sửa khoa/viện');
  });

  it('VIEW-005: Gọi createFaculty khi submit form thêm khoa thành công', async () => {
    vi.spyOn(facultyService, 'getAllFaculties').mockResolvedValue(mockFacultiesList);
    const createSpy = vi.spyOn(facultyService, 'createFaculty').mockResolvedValueOnce({
      _id: 'new-faculty-id-1234567890',
      facultyName: 'Khoa Mới',
      description: 'Mô tả khoa mới',
    });

    const wrapper = mount(FacultyManagementView);
    await flushPromises();

    // Mở modal
    await wrapper.find('button.add-btn').trigger('click');

    // Điền form
    await wrapper.find('input[name="facultyName"]').setValue('Khoa Mới');
    await wrapper.find('form#faculty-form').trigger('submit.prevent');
    await flushPromises();

    expect(createSpy).toHaveBeenCalledWith({
      facultyName: 'Khoa Mới',
      description: undefined,
    });
    expect(wrapper.text()).toContain('Đã thêm khoa "Khoa Mới" mới thành công.');
  });
});

