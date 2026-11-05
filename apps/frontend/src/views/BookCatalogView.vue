<script setup lang="ts">
import { ref, reactive, computed, onMounted, watch } from 'vue';
import { getAllBooks } from '@/services/book';
import type { Book, PaginationMeta } from '../types/book';
import { FACULTIES, AUTHORS } from '../types/book';
import BookFilters from '../components/catalog/BookFilters.vue';
import BookGrid from '../components/catalog/BookGrid.vue';
import BookPagination from '../components/catalog/BookPagination.vue';
import BookDetailModal from '../components/catalog/BookDetailModal.vue';

const emit = defineEmits<{
  (e: 'navigate', view: 'catalog' | 'management' | 'auth'): void;
}>();

const books = ref<Book[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

const pagination = reactive<PaginationMeta>({
  currentPage: 1,
  totalPages: 1,
  totalItems: 0,
  limit: 12,
});

const filters = reactive({
  search: '',
  facultyId: '',
  bookType: '',
});

let lastSearchTimestamp = 0;

// Modal state
const selectedBook = ref<Book | null>(null);
const isDetailModalOpen = ref(false);

const facultyOptions = computed(() => {
  return FACULTIES.map((f) => ({
    _id: f.facultyId,
    facultyName: f.facultyName,
  }));
});

const facultiesMap = computed(() => {
  const map: Record<string, string> = {};
  for (const f of FACULTIES) {
    map[f.facultyId] = f.facultyName;
  }
  return map;
});

const authorsMap = computed(() => {
  const map: Record<string, string> = {};
  for (const a of AUTHORS) {
    map[a.authorId] = a.fullName;
  }
  return map;
});

// Tự động kích hoạt tìm kiếm khi filters.search thay đổi sau debounce 300ms
watch(
  () => filters.search,
  (newVal, oldVal) => {
    if (newVal !== oldVal) {
      if (Date.now() - lastSearchTimestamp < 50) return;
      lastSearchTimestamp = Date.now();
      pagination.currentPage = 1;
      void loadBooks();
    }
  }
);

async function loadBooks() {
  loading.value = true;
  error.value = null;
  try {
    const res = await getAllBooks({
      page: pagination.currentPage,
      limit: pagination.limit,
      search: filters.search.trim() || undefined,
      facultyId: filters.facultyId || undefined,
    });

    let items: Book[] = res.items || [];
    // Client-side filter for bookType if specified
    if (filters.bookType) {
      items = items.filter((b: Book) => b.bookType === filters.bookType);
      books.value = items;
      pagination.totalItems = items.length;
      pagination.totalPages = items.length > 0 ? 1 : 0;
      pagination.currentPage = 1;
    } else {
      books.value = items;
      pagination.totalItems = res.meta?.totalItems ?? items.length;
      pagination.totalPages = res.meta?.totalPages ?? (items.length ? 1 : 0);
      pagination.currentPage = res.meta?.currentPage ?? 1;
    }
  } catch (err: unknown) {
    const errObj = err as { message?: string };
    error.value = errObj?.message || 'Không thể tải danh sách sách.';
    books.value = [];
  } finally {
    loading.value = false;
  }
}

function onSearch() {
  if (Date.now() - lastSearchTimestamp < 50) return;
  lastSearchTimestamp = Date.now();
  pagination.currentPage = 1;
  void loadBooks();
}

function onResetFilters() {
  lastSearchTimestamp = Date.now();
  filters.search = '';
  filters.facultyId = '';
  filters.bookType = '';
  pagination.currentPage = 1;
  void loadBooks();
}

function onPageChange(page: number) {
  pagination.currentPage = page;
  void loadBooks();
}

function onLimitChange(newLimit: number) {
  pagination.limit = newLimit;
  pagination.currentPage = 1;
  void loadBooks();
}

function openDetailModal(book: Book) {
  selectedBook.value = book;
  isDetailModalOpen.value = true;
}

function closeDetailModal() {
  isDetailModalOpen.value = false;
  selectedBook.value = null;
}

function onRequireLogin() {
  closeDetailModal();
  emit('navigate', 'auth');
}

onMounted(() => {
  void loadBooks();
});
</script>

<template>
  <div class="catalog-view container">
    <div class="page-head">
      <div>
        <h1>Tìm sách</h1>
        <p>Giáo trình và sách tham khảo tại CTULib.</p>
      </div>
    </div>

    <!-- Bộ lọc tìm kiếm -->
    <BookFilters
      v-model:search="filters.search"
      v-model:faculty-id="filters.facultyId"
      v-model:book-type="filters.bookType"
      :faculties="facultyOptions"
      :is-loading="loading"
      @submit="onSearch"
      @reset="onResetFilters"
    />

    <!-- Kết quả tìm kiếm và số lượng -->
    <p v-if="!loading && !error" class="results-line">
      Tìm thấy <strong class="num">{{ pagination.totalItems }}</strong> ấn phẩm phù hợp.
    </p>

    <!-- Lưới sách -->
    <BookGrid
      :books="books"
      :loading="loading"
      :error="error"
      :faculties-map="facultiesMap"
      :authors-map="authorsMap"
      @select-book="openDetailModal"
      @retry="loadBooks"
      @reset-filters="onResetFilters"
    />

    <!-- Phân trang -->
    <BookPagination
      v-if="!loading && !error && pagination.totalPages > 1"
      :current-page="pagination.currentPage"
      :total-pages="pagination.totalPages"
      :total-items="pagination.totalItems"
      :limit="pagination.limit"
      :is-loading="loading"
      @page-change="onPageChange"
      @change-limit="onLimitChange"
    />

    <!-- Modal chi tiết sách -->
    <BookDetailModal
      :is-open="isDetailModalOpen"
      :book-id="selectedBook?.bookId || null"
      :initial-book="selectedBook"
      :faculty-name="selectedBook ? facultiesMap[selectedBook.facultyId] : undefined"
      :author-names="selectedBook?.authorIds ? selectedBook.authorIds.map(id => authorsMap[id] || id).join(', ') : undefined"
      @close="closeDetailModal"
      @require-login="onRequireLogin"
    />
  </div>
</template>
