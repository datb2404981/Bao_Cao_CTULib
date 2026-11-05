<script setup lang="ts">
import BookCard from './BookCard.vue';
import type { Book } from '../../types/book';

defineProps<{
  books: Book[];
  loading: boolean;
  error?: string | null;
  facultiesMap?: Record<string, string>;
  authorsMap?: Record<string, string>;
}>();

const emit = defineEmits<{
  (e: 'select-book', book: Book): void;
  (e: 'retry'): void;
  (e: 'reset-filters'): void;
}>();

function resolveAuthorNames(authorIds?: string[], authorsMap?: Record<string, string>): string {
  if (!authorIds || !authorIds.length || !authorsMap) return '';
  return authorIds
    .map((id) => authorsMap[id] || id)
    .filter(Boolean)
    .join(', ');
}
</script>

<template>
  <div class="catalog-grid-wrapper">
    <!-- 1. Trạng thái Đang tải (Loading Skeleton) -->
    <div v-if="loading" class="book-grid loading-skeleton" data-loading-grid>
      <div v-for="n in 6" :key="n" class="book-card skeleton-card">
        <div class="book-card-top">
          <div class="skeleton-box skeleton-cover"></div>
          <div style="flex: 1">
            <div class="skeleton-box skeleton-badge"></div>
            <div class="skeleton-box skeleton-title"></div>
            <div class="skeleton-box skeleton-title-sub"></div>
            <div class="skeleton-box skeleton-author"></div>
          </div>
        </div>
        <div class="skeleton-box skeleton-meta"></div>
        <div class="skeleton-box skeleton-button"></div>
      </div>
    </div>

    <!-- 2. Trạng thái Báo lỗi (Error Banner) -->
    <div v-else-if="error" class="notice error error-banner" role="alert">
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <div class="error-content">
        <strong>Không thể tải danh sách sách</strong>
        <p>{{ error }}</p>
        <button class="btn small primary btn-retry" type="button" @click="emit('retry')">
          <span>Thử lại</span>
        </button>
      </div>
    </div>

    <!-- 3. Trạng thái Không có dữ liệu (Empty State) -->
    <div v-else-if="!books || books.length === 0" class="empty-state" data-catalog-empty>
      <div class="empty-icon-wrapper" aria-hidden="true">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
        </svg>
      </div>
      <h3>Không tìm thấy sách phù hợp</h3>
      <p>Thử từ khóa khác hoặc xóa bộ lọc.</p>
      <button class="btn primary" type="button" data-reset-filter @click="emit('reset-filters')">
        <span>Xóa bộ lọc</span>
      </button>
    </div>

    <!-- 4. Trạng thái Có dữ liệu (Data Grid) -->
    <div v-else class="book-grid" data-book-grid>
      <BookCard
        v-for="book in books"
        :key="book.bookId"
        :book="book"
        :faculty-name="facultiesMap?.[book.facultyId]"
        :author-names="resolveAuthorNames(book.authorIds, authorsMap)"
        @select="emit('select-book', book)"
      />
    </div>
  </div>
</template>

<style scoped>
.skeleton-card {
  pointer-events: none;
}

.skeleton-box {
  background: var(--raised);
  animation: skeleton-fade 1.4s ease-in-out infinite;
  border-radius: 4px;
}

.skeleton-cover {
  width: 68px;
  height: 96px;
}

.skeleton-badge {
  width: 72px;
  height: 18px;
  margin-bottom: 8px;
}

.skeleton-title {
  width: 92%;
  height: 15px;
  margin-bottom: 6px;
}

.skeleton-title-sub {
  width: 68%;
  height: 15px;
  margin-bottom: 8px;
}

.skeleton-author {
  width: 48%;
  height: 13px;
}

.skeleton-meta {
  width: 100%;
  height: 36px;
}

.skeleton-button {
  width: 100%;
  height: 32px;
  margin-top: auto;
}

@keyframes skeleton-fade {
  0%, 100% {
    opacity: 0.9;
  }
  50% {
    opacity: 0.45;
  }
}

.error-banner {
  border-radius: var(--radius);
  padding: 18px 20px;
  align-items: flex-start;
}

.error-content {
  flex: 1;
}

.error-content strong {
  font-size: 14.5px;
  color: var(--pill-negative-ink);
}

.error-content p {
  color: var(--pill-negative-ink);
  margin: 4px 0 12px;
  font-size: 13.5px;
}

.empty-state {
  text-align: center;
  padding: 48px 24px;
  color: var(--muted);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
}

.empty-icon-wrapper {
  color: var(--muted);
  display: inline-flex;
  margin: 0 auto 12px;
}

.empty-state h3 {
  color: var(--text);
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
}

.empty-state p {
  color: var(--muted);
  font-size: 13.5px;
  margin: 0 0 16px;
}
</style>
