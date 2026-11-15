<script setup lang="ts">
import type { Publisher } from '../../types/publisher';

defineProps<{
  publishers: Publisher[];
  loading: boolean;
  searchQuery?: string;
}>();

const emit = defineEmits<{
  (e: 'edit', publisher: Publisher): void;
}>();
</script>

<template>
  <section class="panel table-panel" aria-label="Danh sách Nhà xuất bản">
    <div class="table-wrap">
      <!-- Loading Skeleton -->
      <div v-if="loading" class="table-loading-state" role="status">
        <span class="spinner" aria-hidden="true"></span>
        <p>Đang tải danh sách Nhà xuất bản…</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="publishers.length === 0" class="table-empty-state">
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
        <p class="empty-title">Không tìm thấy nhà xuất bản nào</p>
        <p v-if="searchQuery" class="empty-sub">
          Không có kết quả nào khớp với từ khóa "<strong>{{ searchQuery }}</strong>". Hãy thử tìm kiếm bằng từ khóa khác.
        </p>
        <p v-else class="empty-sub">
          Hệ thống hiện chưa có nhà xuất bản nào. Hãy thêm nhà xuất bản mới để bắt đầu.
        </p>
      </div>

      <!-- Bảng danh sách Responsive -->
      <table v-else class="responsive-table">
        <thead>
          <tr>
            <th scope="col">Tên Nhà xuất bản</th>
            <th scope="col">Địa chỉ</th>
            <th scope="col" class="text-right">Hành động</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="pub in publishers" :key="pub._id">
            <td data-label="Nhà xuất bản" class="col-name">
              <span class="publisher-name-text">{{ pub.publisherName }}</span>
            </td>
            <td data-label="Địa chỉ" class="col-address">
              <span class="address-text" :class="{ 'is-muted': !pub.address }">
                {{ pub.address || 'Chưa cập nhật' }}
              </span>
            </td>
            <td data-label="Hành động" class="col-action text-right">
              <button
                class="btn small edit-btn"
                type="button"
                @click="emit('edit', pub)"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                <span>Chỉnh sửa</span>
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.table-panel {
  overflow: hidden;
}

.table-loading-state,
.table-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
  gap: 12px;
  color: var(--muted);
}

.table-empty-state svg {
  color: #94a3b8;
}

.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
  margin: 0;
}

.empty-sub {
  font-size: 13.5px;
  color: var(--muted);
  max-width: 420px;
  margin: 0;
  line-height: 1.5;
}

.publisher-name-text {
  font-weight: 600;
  color: var(--text);
}

.address-text.is-muted {
  color: var(--muted);
  font-style: italic;
}

.text-right {
  text-align: right;
}

.edit-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border-radius: var(--radius-sm);
  transition: all 0.15s ease;
}

.edit-btn:hover {
  background: var(--blue-light);
  color: var(--blue);
  border-color: var(--blue-border);
}
</style>
