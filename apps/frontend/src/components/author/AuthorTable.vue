<script setup lang="ts">
import type { Author } from '../../types/author';

defineProps<{
  authors: Author[];
  loading: boolean;
  searchQuery?: string;
}>();

const emit = defineEmits<{
  (e: 'edit', author: Author): void;
}>();
</script>

<template>
  <section class="panel table-panel" aria-label="Danh sách Tác giả">
    <div class="table-wrap">
      <!-- Loading Skeleton -->
      <div v-if="loading" class="table-loading-state" role="status">
        <span class="spinner" aria-hidden="true"></span>
        <p>Đang tải danh sách Tác giả…</p>
      </div>

      <!-- Empty State -->
      <div v-else-if="authors.length === 0" class="table-empty-state">
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
          <circle cx="9" cy="8" r="3" />
          <path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v3" />
        </svg>
        <p class="empty-title">Không tìm thấy tác giả nào</p>
        <p v-if="searchQuery" class="empty-sub">
          Không có kết quả nào khớp với từ khóa "<strong>{{ searchQuery }}</strong>". Hãy thử tìm kiếm bằng từ khóa khác.
        </p>
        <p v-else class="empty-sub">
          Hệ thống hiện chưa có tác giả nào. Hãy thêm tác giả mới để bắt đầu.
        </p>
      </div>

      <!-- Bảng danh sách Responsive SC16 -->
      <table v-else class="responsive-table">
        <thead>
          <tr>
            <th scope="col">Tác giả</th>
            <th scope="col">Đơn vị công tác</th>
            <th scope="col" class="text-right">Hành động</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="author in authors" :key="author._id">
            <td data-label="Tác giả" class="col-name">
              <span class="author-name-text">{{ author.fullName }}</span>
            </td>
            <td data-label="Đơn vị công tác" class="col-affiliation">
              <span class="affiliation-text" :class="{ 'is-muted': !author.affiliation }">
                {{ author.affiliation || 'Chưa cập nhật' }}
              </span>
            </td>
            <td data-label="Hành động" class="col-action text-right">
              <button
                class="btn small edit-btn"
                type="button"
                @click="emit('edit', author)"
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

.author-name-text {
  font-weight: 600;
  color: var(--text, #0f172a);
}

.author-code-tag {
  display: inline-flex;
  align-items: center;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--primary, #1e3a8a);
  background: #eff6ff;
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid #dbeafe;
}

.affiliation-text {
  color: var(--text-secondary, #334155);
}

.affiliation-text.is-muted {
  color: var(--muted, #94a3b8);
  font-style: italic;
}

.col-action {
  white-space: nowrap;
}

.edit-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.text-right {
  text-align: right;
}
</style>

