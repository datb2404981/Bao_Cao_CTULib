import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import PublisherTable from '../components/publisher/PublisherTable.vue';
import type { Publisher } from '../types/publisher';

const samplePublishers: Publisher[] = [
  {
    _id: '67cabe960354ac17e1a6b001',
    publisherCode: 'NXB-CTU',
    publisherName: 'Nhà xuất bản Đại học Cần Thơ',
    address: 'Khu II ĐHCT',
  },
  {
    _id: '67cabe960354ac17e1a6b002',
    publisherCode: 'NXB-GD',
    publisherName: 'Nhà xuất bản Giáo Dục',
    address: 'Hà Nội',
  },
];

describe('components/publisher/PublisherTable.vue - Unit Tests', () => {
  it('PUB-TBL-001: Hiển thị trạng thái loading', () => {
    const wrapper = mount(PublisherTable, {
      props: {
        publishers: [],
        loading: true,
      },
    });

    expect(wrapper.text()).toContain('Đang tải danh sách Nhà xuất bản');
    expect(wrapper.find('.spinner').exists()).toBe(true);
  });

  it('PUB-TBL-002: Hiển thị empty state khi danh sách rỗng', () => {
    const wrapper = mount(PublisherTable, {
      props: {
        publishers: [],
        loading: false,
      },
    });

    expect(wrapper.text()).toContain('Không tìm thấy nhà xuất bản nào');
    expect(wrapper.text()).toContain('Hệ thống hiện chưa có nhà xuất bản nào.');
  });

  it('PUB-TBL-003: Hiển thị thông báo tìm kiếm không khớp khi có searchQuery', () => {
    const wrapper = mount(PublisherTable, {
      props: {
        publishers: [],
        loading: false,
        searchQuery: 'Không tồn tại',
      },
    });

    expect(wrapper.text()).toContain('Không có kết quả nào khớp với từ khóa "Không tồn tại"');
  });

  it('PUB-TBL-004: Hiển thị chính xác danh sách nhà xuất bản', () => {
    const wrapper = mount(PublisherTable, {
      props: {
        publishers: samplePublishers,
        loading: false,
      },
    });

    expect(wrapper.text()).toContain('Nhà xuất bản Đại học Cần Thơ');
    expect(wrapper.text()).toContain('Khu II ĐHCT');
    expect(wrapper.text()).toContain('Nhà xuất bản Giáo Dục');
    expect(wrapper.text()).toContain('Hà Nội');
  });

  it('PUB-TBL-005: Phát ra sự kiện edit khi bấm nút chỉnh sửa', async () => {
    const wrapper = mount(PublisherTable, {
      props: {
        publishers: samplePublishers,
        loading: false,
      },
    });

    const editBtn = wrapper.find('.edit-btn');
    expect(editBtn.exists()).toBe(true);
    await editBtn.trigger('click');
    expect(wrapper.emitted('edit')).toBeTruthy();
    expect(wrapper.emitted('edit')?.[0]?.[0]).toEqual(samplePublishers[0]);
  });
});
