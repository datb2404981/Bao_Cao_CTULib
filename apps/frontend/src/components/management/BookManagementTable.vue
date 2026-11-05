<script setup lang="ts">
import type { Book } from '../../types/book';

defineProps<{
  books: Book[];
  loading: boolean;
  facultiesMap?: Record<string, string>;
}>();

const emit = defineEmits<{
  (e: 'view', book: Book): void;
  (e: 'edit', book: Book): void;
}>();
</script>

<template>
  <section class="panel table-panel">
    <div class="table-wrap">
      <table class="responsive-table">
        <thead>
          <tr>
            <th class="col-stt">STT</th>
            <th>Tên sách</th>
            <th>Khoa/Viện</th>
            <th>Tổng</th>
            <th>Khả dụng</th>
            <th>Giữ chỗ</th>
            <th>Đang mượn</th>
            <th>Lưu hành</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="9" style="text-align:center;padding:32px">
              <span class="spinner"></span> Đang tải dữ liệu quản lý…
            </td>
          </tr>
          <tr v-else-if="!books || books.length === 0">
            <td colspan="9" style="text-align:center;padding:32px;color:var(--color-text-secondary, #475569)">
              Không có dữ liệu sách trong hệ thống.
            </td>
          </tr>
          <tr v-else v-for="(book, index) in books" :key="book.bookId" :data-book-id="book.bookId">
            <td data-label="STT" class="col-stt num">
              {{ index + 1 }}
            </td>
            <td data-label="Tên sách">
              <span class="title">{{ book.title }}</span>
              <span class="secondary">
                <span class="badge-mini" :class="book.bookType === 'TEXTBOOK' ? 'textbook' : 'reference'">
                  {{ book.bookType === 'TEXTBOOK' ? 'Giáo trình' : 'Tài liệu tham khảo' }}
                </span>
                <span v-if="book.publisher" class="meta-inline"> · {{ book.publisher }}</span>
                <span v-if="book.publicationYear" class="meta-inline"> ({{ book.publicationYear }})</span>
              </span>
            </td>
            <td data-label="Khoa/Viện">
              {{ facultiesMap?.[book.facultyId] || 'Chung' }}
            </td>
            <td data-label="Tổng" class="num">
              {{ book.totalCopies }}
            </td>
            <td data-label="Khả dụng" class="num">
              <strong>{{ book.availableCopies }}</strong>
            </td>
            <td data-label="Giữ chỗ" class="num">
              0
            </td>
            <td data-label="Đang mượn" class="num">
              {{ Math.max(0, book.totalCopies - book.availableCopies) }}
            </td>
            <td data-label="Lưu hành">
              <span class="badge" :class="book.isAvailableForCirculation ? 'green' : 'red'">
                {{ book.isAvailableForCirculation ? 'Lưu hành' : 'Ngừng lưu hành' }}
              </span>
            </td>
            <td data-label="Thao tác" class="right">
              <button
                class="row-link btn quiet small"
                type="button"
                :data-book-id="book.bookId"
                @click="emit('view', book)"
              >
                Xem sách
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.col-stt {
  width: 56px;
  text-align: center;
  font-variant-numeric: tabular-nums;
  color: var(--color-text-secondary, #475569);
  font-weight: 500;
}
.badge-mini {
  display: inline-block;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--color-primary, #1D4ED8);
}
.badge-mini.reference {
  color: var(--color-warning, #B45309);
}
.meta-inline {
  color: var(--color-text-secondary, #475569);
  font-size: 12px;
}
</style>
