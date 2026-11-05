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

function resetAllAndScrollTop() {
  onResetFilters();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function focusSearchInput() {
  const el = document.getElementById('catalog-search-input');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.focus();
  }
}

defineExpose({
  resetAllAndScrollTop,
  focusSearchInput,
});

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
    <!-- Hero Header: Tối giản, thanh lịch, chuẩn nhận diện Đại học Cần Thơ -->
    <div class="page-head catalog-hero-banner">
      <div class="hero-left">
        <div class="hero-brand-mark">
          <img src="/ctu-logo.png" alt="Logo Đại học Cần Thơ" class="ctu-crest-img" />
        </div>
        <div class="hero-banner-content">
          <div class="hero-subtitle">Mục lục trực tuyến OPAC · Đại học Cần Thơ</div>
          <h1>Tra cứu Học liệu & Giáo trình</h1>
          <p>
            Cổng kết nối nguồn học liệu số, giáo trình chính quy và tài liệu nghiên cứu chuyên sâu.
          </p>
        </div>
      </div>
    </div>

    <BookFilters
      v-model:search="filters.search"
      v-model:faculty-id="filters.facultyId"
      v-model:book-type="filters.bookType"
      :faculties="facultyOptions"
      :is-loading="loading"
      @submit="onSearch"
      @reset="onResetFilters"
    />

    <p v-if="!loading && !error" class="results-line">
      Tìm thấy <strong class="num">{{ pagination.totalItems }}</strong> ấn phẩm phù hợp.
    </p>

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

<style scoped>
.catalog-hero-banner {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 22px 26px;
  margin-bottom: 22px;
  display: flex;
  align-items: center;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
}

.hero-left {
  display: flex;
  align-items: center;
  gap: 18px;
  min-width: 0;
}

.hero-brand-mark {
  width: 58px;
  height: 58px;
  border-radius: 14px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  padding: 6px;
}

.ctu-crest-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.hero-banner-content {
  min-width: 0;
}

.hero-subtitle {
  font-size: 12.5px;
  font-weight: 600;
  color: #1d4ed8;
  margin-bottom: 4px;
  letter-spacing: -0.01em;
}

.hero-banner-content h1 {
  font-size: 22px;
  line-height: 1.3;
  font-weight: 750;
  color: #0f172a;
  letter-spacing: -0.02em;
  margin: 0 0 4px;
}

.hero-banner-content p {
  font-size: 13.5px;
  line-height: 1.5;
  color: #64748b;
  margin: 0;
  max-width: 680px;
}

@media (max-width: 640px) {
  .catalog-hero-banner {
    padding: 16px;
  }

  .hero-left {
    gap: 14px;
  }

  .hero-brand-mark {
    width: 48px;
    height: 48px;
    border-radius: 10px;
    padding: 5px;
  }

  .hero-banner-content h1 {
    font-size: 19px;
  }

  .hero-banner-content p {
    font-size: 12.5px;
  }
}
</style>
