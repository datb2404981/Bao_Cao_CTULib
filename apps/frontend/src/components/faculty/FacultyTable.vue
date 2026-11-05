<script setup lang="ts">
import type { Faculty } from '../../types/faculty';

defineProps<{
  faculties: Faculty[];
  loading: boolean;
  searchQuery?: string;
}>();

const emit = defineEmits<{
  (e: 'edit', faculty: Faculty): void;
}>();

function formatFacultyCode(id: string): string {
  if (!id) return '---';
  // Hiển thị 6 ký tự cuối của ObjectId dưới dạng mã code dễ nhìn, kèm tooltip full id
  return `KH-${id.slice(-6).toUpperCase()}`;
}
</script>

<template>
  <section class="panel table-panel" aria-label="Danh sách Khoa/Viện">
    <div class="table-wrap">
      <!-- Loading Skeleton -->
      <div v-if="loading" class="table-loading-state" role="status">
        <span class="spinner" aria-hidden="true"></span>
        <p>Đang tải danh sách Khoa/Viện…</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="faculties.length === 0" class="table-empty-state">
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
          <path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />
        </svg>
        <p class="empty-title">Không tìm thấy khoa/viện nào</p>
        <p v-if="searchQuery" class="empty-sub">
          Không có kết quả nào khớp với từ khóa "<strong>{{ searchQuery }}</strong>". Hãy thử tìm kiếm bằng từ khóa khác.
        </p>
        <p v-else class="empty-sub">
          Hệ thống hiện chưa có khoa/viện nào. Hãy thêm khoa mới để bắt đầu.
        </p>
      </div>

      <!-- Bảng danh sách Responsive SC15 -->
      <table v-else class="responsive-table">
        <thead>
          <tr>
            <th scope="col">Khoa/Viện</th>
            <th scope="col">Mã khoa</th>
            <th scope="col">Mô tả</th>
            <th scope="col" class="text-right">Hành động</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="faculty in faculties" :key="faculty._id">
            <td data-label="Khoa/Viện" class="col-name">
              <span class="faculty-name-text">{{ faculty.facultyName }}</span>
            </td>
            <td data-label="Mã khoa" class="col-code">
              <span class="faculty-code-tag" :title="`ID: ${faculty._id}`">
                {{ formatFacultyCode(faculty._id) }}
              </span>
            </td>
            <td data-label="Mô tả" class="col-desc">
              <span class="desc-text" :class="{ 'is-muted': !faculty.description }">
                {{ faculty.description || 'Chưa cập nhật' }}
              </span>
            </td>
            <td data-label="Hành động" class="col-action text-right">
              <button
                class="btn small edit-btn"
                type="button"
                @click="emit('edit', faculty)"
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
  border-radius: var(--radius-lg, 12px);
  border: 1px solid var(--line-light, #e2e8f0);
  background: var(--surface, #ffffff);
}

.table-wrap {
  width: 100%;
  overflow-x: auto;
}

.table-loading-state,
.table-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;
  color: var(--muted, #64748b);
  gap: 12px;
}

.empty-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text, #0f172a);
  margin: 0;
}

.empty-sub {
  font-size: 13.5px;
  color: var(--muted, #64748b);
  max-width: 420px;
  margin: 0;
}

.faculty-name-text {
  font-weight: 600;
  color: var(--text, #0f172a);
}

.faculty-code-tag {
  display: inline-block;
  padding: 2px 8px;
  background: var(--ground, #f1f5f9);
  color: var(--muted, #475569);
  border-radius: var(--radius-sm, 6px);
  font-family: monospace;
  font-size: 12px;
  font-weight: 600;
}

.desc-text {
  color: var(--text, #334155);
  font-size: 13.5px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.desc-text.is-muted {
  color: var(--muted, #94a3b8);
  font-style: italic;
}

.col-action {
  white-space: nowrap;
}

.text-right {
  text-align: right;
}

.edit-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
</style>

