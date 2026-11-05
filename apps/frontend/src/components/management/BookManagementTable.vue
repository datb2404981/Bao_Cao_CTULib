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
            <td colspan="8" style="text-align:center;padding:32px">
              <span class="spinner"></span> Đang tải dữ liệu quản lý…
            </td>
          </tr>
          <tr v-else-if="!books || books.length === 0">
            <td colspan="8" style="text-align:center;padding:32px;color:var(--muted)">
              Không có dữ liệu sách trong hệ thống.
            </td>
          </tr>
          <tr v-else v-for="book in books" :key="book.bookId">
            <td data-label="Tên sách">
              <span class="title">{{ book.title }}</span>
              <span class="secondary">
                {{ book.bookId }} · {{ book.bookType === 'TEXTBOOK' ? 'Giáo trình' : 'Sách tham khảo' }}
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
              <button class="row-link btn quiet small" type="button" @click="emit('view', book)">
                Xem sách
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
