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
      <div v-for="n in 8" :key="n" class="book-card skeleton-card">
        <div class="book-card-top">
          <div class="skeleton-box skeleton-cover"></div>
          <div style="flex:1">
            <div class="skeleton-box skeleton-badge"></div>
            <div class="skeleton-box skeleton-title"></div>
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
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.7"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <div>
        <strong>Không thể tải danh sách sách</strong>
        <p>{{ error }}</p>
        <button class="btn small btn-retry" type="button" style="margin-top:8px" @click="emit('retry')">
          Thử lại
        </button>
      </div>
    </div>

    <!-- 3. Trạng thái Không có dữ liệu (Empty State) -->
    <div v-else-if="!books || books.length === 0" class="empty-state" data-catalog-empty>
      <h3>Không tìm thấy sách phù hợp</h3>
      <p>Thử từ khóa khác hoặc xóa bộ lọc.</p>
      <button class="btn" type="button" data-reset-filter @click="emit('reset-filters')">
        Xóa bộ lọc
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
  opacity: 0.7;
}
.skeleton-box {
  background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
  background-size: 200% 100%;
  animation: skeleton-pulse 1.5s infinite;
  border-radius: 4px;
}
.skeleton-cover {
  width: 54px;
  height: 74px;
}
.skeleton-badge {
  width: 70px;
  height: 18px;
  margin-bottom: 8px;
}
.skeleton-title {
  width: 90%;
  height: 16px;
  margin-bottom: 6px;
}
.skeleton-author {
  width: 60%;
  height: 14px;
}
.skeleton-meta {
  width: 80%;
  height: 14px;
}
.skeleton-button {
  width: 100%;
  height: 36px;
  margin-top: auto;
}
@keyframes skeleton-pulse {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
