import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AuthorTable from '../components/author/AuthorTable.vue';
import type { Author } from '../types/author';

const sampleAuthors: Author[] = [
  {
    _id: '67cabe960354ac17e1a6b001',
    fullName: 'Nguyễn Văn An',
    affiliation: 'Trường Đại học — minh họa',
  },
  {
    _id: '67cabe960354ac17e1a6b002',
    fullName: 'Trần Minh Hòa',
    affiliation: 'Khoa Kinh tế — minh họa',
  },
];

describe('components/author/AuthorTable.vue - Unit Tests', () => {
  it('AUT-TBL-001: Hiển thị trạng thái loading khi loading = true', () => {
    const wrapper = mount(AuthorTable, {
      props: {
        authors: [],
        loading: true,
      },
    });

    expect(wrapper.text()).toContain('Đang tải danh sách Tác giả…');
    expect(wrapper.find('.spinner').exists()).toBe(true);
  });

  it('AUT-TBL-002: Hiển thị empty state khi danh sách rỗng', () => {
    const wrapper = mount(AuthorTable, {
      props: {
        authors: [],
        loading: false,
      },
    });

    expect(wrapper.text()).toContain('Không tìm thấy tác giả nào');
    expect(wrapper.text()).toContain('Hệ thống hiện chưa có tác giả nào.');
  });

  it('AUT-TBL-003: Hiển thị thông báo tìm kiếm không khớp khi có searchQuery', () => {
    const wrapper = mount(AuthorTable, {
      props: {
        authors: [],
        loading: false,
        searchQuery: 'Không tồn tại',
      },
    });

    expect(wrapper.text()).toContain('Không có kết quả nào khớp với từ khóa "Không tồn tại"');
  });

  it('AUT-TBL-004: Hiển thị chính xác danh sách tác giả và mã định dạng TG-XXXXXX', () => {
    const wrapper = mount(AuthorTable, {
      props: {
        authors: sampleAuthors,
        loading: false,
      },
    });

    expect(wrapper.text()).toContain('Nguyễn Văn An');
    expect(wrapper.text()).toContain('TG-A6B001');
    expect(wrapper.text()).toContain('Trường Đại học — minh họa');

    expect(wrapper.text()).toContain('Trần Minh Hòa');
    expect(wrapper.text()).toContain('TG-A6B002');
    expect(wrapper.text()).toContain('Khoa Kinh tế — minh họa');
  });

  it('AUT-TBL-005: Phát ra sự kiện edit khi bấm nút Chỉnh sửa', async () => {
    const wrapper = mount(AuthorTable, {
      props: {
        authors: sampleAuthors,
        loading: false,
      },
    });

    const editBtns = wrapper.findAll('.edit-btn');
    expect(editBtns.length).toBe(2);

    await editBtns[0]!.trigger('click');

    expect(wrapper.emitted('edit')).toBeTruthy();
    expect(wrapper.emitted('edit')?.[0]?.[0]).toEqual(sampleAuthors[0]);
  });
});

