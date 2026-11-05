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
    <!-- Khung cổng CTU: Tiêu đề học thuật hiện đại → Lọc/Thao tác → Nội dung -->
    <div class="page-head catalog-hero-banner">
      <div class="hero-banner-content">
        <div class="hero-eyebrow">
          <span class="eyebrow-dot"></span>
          <span>MỤC LỤC TRỰC TUYẾN OPAC · ĐẠI HỌC CẦN THƠ</span>
        </div>
        <h1>Danh mục sách thư viện</h1>
        <p>Tra cứu học liệu, giáo trình và sách tham khảo theo khoa/viện tại Thư viện Đại học Cần Thơ.</p>
      </div>
      <div v-if="!loading && !error" class="hero-counter-card">
        <span class="counter-value num">{{ pagination.totalItems }}</span>
        <span class="counter-label">Ấn phẩm hiện hành</span>
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
  background: linear-gradient(135deg, #ffffff 0%, #f0f6ff 100%);
  border: 1px solid #dbeafe;
  border-radius: 16px;
  padding: 24px 28px;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  box-shadow: 0 2px 8px -2px rgba(29, 78, 216, 0.05);
}

.hero-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #1d4ed8;
  margin-bottom: 8px;
}

.eyebrow-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #2563eb;
}

.hero-counter-card {
  background: #ffffff;
  border: 1px solid #bfdbfe;
  border-radius: 12px;
  padding: 12px 20px;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(29, 78, 216, 0.06);
}

.counter-value {
  font-size: 26px;
  line-height: 1.15;
  font-weight: 800;
  color: #1d4ed8;
}

.counter-label {
  font-size: 12px;
  color: #64748b;
  font-weight: 600;
  margin-top: 2px;
}

@media (max-width: 767px) {
  .catalog-hero-banner {
    flex-direction: column;
    align-items: flex-start;
    padding: 18px 20px;
  }

  .hero-counter-card {
    align-items: flex-start;
    width: 100%;
  }
}
</style>
