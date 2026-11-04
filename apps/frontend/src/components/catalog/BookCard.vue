<script setup lang="ts">
import { ref, computed } from 'vue';
import type { Book } from '../../types/book';

const props = defineProps<{
  book: Book;
  facultyName?: string;
  authorNames?: string;
}>();

const emit = defineEmits<{
  (e: 'select', bookId: string): void;
}>();

const imageError = ref(false);

function handleImageError() {
  imageError.value = true;
}

const typeLabel = computed(() => {
  return props.book.bookType === 'TEXTBOOK' ? 'Giáo trình' : 'Tài liệu tham khảo';
});

const isAvailable = computed(() => {
  return props.book.availableCopies > 0 && props.book.isAvailableForCirculation;
});

const formattedPrice = computed(() => {
  if (props.book.coverPrice === undefined || props.book.coverPrice === null) return '';
  return new Intl.NumberFormat('vi-VN').format(props.book.coverPrice) + ' đ';
});
</script>

<template>
  <article
    class="book-card"
    :data-book-id="book.bookId"
    :data-title="book.title"
    :data-kind="typeLabel"
  >
    <div class="book-card-top">
      <div class="cover">
        <img
          v-if="book.coverImageUrl && !imageError"
          :src="book.coverImageUrl"
          :alt="book.title"
          class="cover-image"
          loading="lazy"
          @error="handleImageError"
        />
        <svg
          v-else
          class="cover-placeholder-icon"
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-3H4z" />
          <path d="M20 4h-4a3 3 0 0 0-3 3v14a4 4 0 0 1 4-3h3z" />
        </svg>
      </div>

      <div class="book-card-header">
        <div class="badge-wrapper">
          <span class="badge" :class="book.bookType === 'TEXTBOOK' ? 'blue' : 'orange'">
            {{ typeLabel }}
          </span>
        </div>
        <h3 class="book-title" :title="book.title">{{ book.title }}</h3>
        <p class="author">{{ authorNames || 'Chưa rõ tác giả' }}</p>
      </div>
    </div>

    <p class="meta">
      <span>{{ typeLabel }}</span>
      <span v-if="facultyName"> · {{ facultyName }}</span>
      <span v-if="book.publisher"> · {{ book.publisher }}</span>
      <span v-if="book.publicationYear"> · {{ book.publicationYear }}</span>
    </p>

    <div v-if="formattedPrice" class="card-price">
      <span class="price-label">Giá bìa:</span>
      <span class="num price-val">{{ formattedPrice }}</span>
    </div>

    <div class="bottom">
      <span
        class="availability badge-copies"
        :class="{ empty: !isAvailable, 'out-of-stock': !isAvailable }"
      >
        {{ isAvailable ? `Còn ${book.availableCopies} bản` : 'Hết sách' }}
      </span>
      <button
        class="btn small btn-view"
        type="button"
        @click="emit('select', book.bookId)"
      >
        Xem sách
      </button>
    </div>
  </article>
</template>

<style scoped>
.cover-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 3px;
}
.book-card-header {
  flex: 1;
  min-width: 0;
}
.badge-wrapper {
  margin-bottom: 6px;
}
.card-price {
  font-size: 13px;
  color: var(--muted);
  display: flex;
  gap: 6px;
}
.price-val {
  font-weight: 600;
  color: #172033;
}
</style>
