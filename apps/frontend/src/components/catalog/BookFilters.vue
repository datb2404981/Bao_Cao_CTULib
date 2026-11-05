<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue';

export interface FacultyOption {
  _id: string;
  facultyName: string;
}

const props = withDefaults(
  defineProps<{
    search?: string;
    facultyId?: string;
    bookType?: string;
    faculties: FacultyOption[];
    isLoading?: boolean;
    debounceMs?: number;
  }>(),
  {
    search: '',
    facultyId: '',
    bookType: '',
    isLoading: false,
    debounceMs: 300,
  }
);

const emit = defineEmits<{
  (e: 'update:search', value: string): void;
  (e: 'update:facultyId', value: string): void;
  (e: 'update:bookType', value: string): void;
  (e: 'submit'): void;
  (e: 'reset'): void;
}>();

const localSearch = ref(props.search);
const localFacultyId = ref(props.facultyId);
const localBookType = ref(props.bookType);

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

onBeforeUnmount(() => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
});

const activeFilterCount = computed(() => {
  let count = 0;
  if (localFacultyId.value) count++;
  if (localBookType.value) count++;
  return count;
});

function onSearchInput(event: Event) {
  const target = event.target as HTMLInputElement;
  localSearch.value = target.value;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    emit('update:search', localSearch.value);
  }, props.debounceMs);
}

function clearSearch() {
  localSearch.value = '';
  if (debounceTimer) clearTimeout(debounceTimer);
  emit('update:search', '');
}

function onFacultyChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  localFacultyId.value = target.value;
  emit('update:facultyId', localFacultyId.value);
}

function onBookTypeChange(event: Event) {
  const target = event.target as HTMLSelectElement;
  localBookType.value = target.value;
  emit('update:bookType', localBookType.value);
}

function onSubmit() {
  if (debounceTimer) clearTimeout(debounceTimer);
  emit('update:search', localSearch.value);
  emit('submit');
}

function onReset() {
  if (debounceTimer) clearTimeout(debounceTimer);
  localSearch.value = '';
  localFacultyId.value = '';
  localBookType.value = '';
  emit('update:search', '');
  emit('update:facultyId', '');
  emit('update:bookType', '');
  emit('reset');
}

watch(
  () => props.search,
  (val) => {
    localSearch.value = val || '';
  }
);

watch(
  () => props.facultyId,
  (val) => {
    localFacultyId.value = val || '';
  }
);

watch(
  () => props.bookType,
  (val) => {
    localBookType.value = val || '';
  }
);
</script>

<template>
  <form class="filters" data-catalog-filter @submit.prevent="onSubmit">
    <div class="filter-row">
      <div class="field search-field">
        <div class="search-box">
          <svg
            class="search-icon"
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            id="catalog-search-input"
            ref="searchInputRef"
            v-model="localSearch"
            type="search"
            name="search"
            aria-label="Tìm tên sách hoặc tác giả"
            placeholder="Tìm tên sách, tác giả hoặc từ khóa tài liệu…"
            :disabled="isLoading"
            @input="onSearchInput"
          />
          <button
            v-if="localSearch"
            type="button"
            class="clear-search-btn"
            aria-label="Xóa nội dung tìm kiếm"
            @click="clearSearch"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
      <button
        class="btn primary btn-search"
        type="submit"
        :disabled="isLoading"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <span>Tìm kiếm</span>
      </button>
    </div>

    <!-- KHỐI BỘ LỌC NÂNG CAO (KHOA/VIỆN VÀ LOẠI ẤN PHẨM) -->
    <details class="extra-filters">
      <summary>
        <div class="summary-left">
          <svg class="summary-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          <span class="summary-title">Bộ lọc nâng cao</span>
          <span v-if="activeFilterCount > 0" class="active-count-tag num">{{ activeFilterCount }}</span>
        </div>
        <div class="summary-right">
          <span class="summary-hint">{{ activeFilterCount > 0 ? 'Đang lọc ' + activeFilterCount + ' tiêu chí' : 'Khoa / Viện, Loại ấn phẩm' }}</span>
          <svg class="chevron-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </summary>

      <div class="filter-panel-body">
        <div class="filter-grid">
          <!-- Trường 1: Khoa / Viện đào tạo -->
          <div class="filter-col">
            <label class="field-label" for="filter-faculty-select">
              <svg class="field-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3" />
              </svg>
              <span>Khoa / Viện đào tạo</span>
            </label>
            <div class="custom-select-wrapper">
              <select
                id="filter-faculty-select"
                v-model="localFacultyId"
                class="faculty-select custom-select"
                name="faculty"
                :disabled="isLoading"
                @change="onFacultyChange"
              >
                <option value="">Tất cả khoa</option>
                <option
                  v-for="faculty in faculties"
                  :key="faculty._id"
                  :value="faculty._id"
                >
                  {{ faculty.facultyName }}
                </option>
              </select>
              <svg class="select-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
          </div>

          <!-- Trường 2: Loại ấn phẩm -->
          <div class="filter-col">
            <label class="field-label" for="filter-kind-select">
              <svg class="field-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
              <span>Loại ấn phẩm</span>
            </label>
            <div class="custom-select-wrapper">
              <select
                id="filter-kind-select"
                v-model="localBookType"
                class="kind-select custom-select"
                name="kind"
                :disabled="isLoading"
                @change="onBookTypeChange"
              >
                <option value="">Tất cả loại</option>
                <option value="TEXTBOOK">Giáo trình</option>
                <option value="REFERENCE">Sách tham khảo</option>
              </select>
              <svg class="select-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
          </div>
        </div>

        <!-- Hàng nút hành động -->
        <div class="row end filter-actions">
          <button
            class="btn quiet btn-reset"
            type="button"
            data-reset-filter
            :disabled="isLoading"
            @click="onReset"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            <span>Xóa bộ lọc</span>
          </button>
          <button class="btn primary btn-apply" type="submit" :disabled="isLoading">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>Áp dụng</span>
          </button>
        </div>
      </div>
    </details>
  </form>
</template>

<style scoped>
.filters {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 16px 20px;
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.filters:focus-within {
  border-color: #cbd5e1;
}

.filter-row {
  display: flex;
  gap: 12px;
  align-items: center;
}

.filter-row .search-field {
  flex: 1;
}

.btn-search {
  min-height: 44px;
  padding: 0 20px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  border-radius: 6px;
  background-color: var(--primary, #1d4ed8);
  color: #ffffff;
  border: none;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.btn-search:hover:not(:disabled) {
  background-color: var(--primary-hover, #1e40af);
}

.search-box {
  position: relative;
  width: 100%;
}

.search-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: #64748b;
  pointer-events: none;
}

#catalog-search-input {
  width: 100%;
  min-height: 44px;
  padding: 10px 40px 10px 42px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #ffffff;
  font-size: 14px;
  color: #172033;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

#catalog-search-input:focus {
  border-color: #1d4ed8;
  outline: none;
  box-shadow: 0 0 0 3px rgba(29, 78, 216, 0.12);
}

.clear-search-btn {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #e2e8f0;
  color: #475569;
  display: grid;
  place-items: center;
  cursor: pointer;
  border: none;
  padding: 0;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.clear-search-btn:hover {
  background: #cbd5e1;
  color: #0f172a;
}

/* KHỐI BỘ LỌC NÂNG CAO */
.extra-filters {
  margin-top: 14px;
  border-top: 1px solid #e2e8f0;
  padding-top: 12px;
}

.extra-filters summary {
  font-size: 13.5px;
  font-weight: 500;
  color: #475569;
  cursor: pointer;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 4px;
  border-radius: 6px;
  list-style: none;
  transition: color 0.15s ease, background-color 0.15s ease;
}

.extra-filters summary::-webkit-details-marker {
  display: none;
}

.extra-filters summary:hover {
  color: #1d4ed8;
  background: #f8fafc;
}

.summary-left {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.summary-icon {
  color: #1d4ed8;
}

.summary-title {
  font-weight: 600;
}

.summary-right {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}

.summary-hint {
  font-size: 12.5px;
  color: #64748b;
  font-weight: normal;
}

.active-count-tag {
  font-variant-numeric: tabular-nums;
  background: #1d4ed8;
  color: #ffffff;
  font-size: 11px;
  font-weight: 700;
  padding: 1px 7px;
  border-radius: 12px;
  line-height: 1.4;
}

.chevron-icon {
  color: #64748b;
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.extra-filters[open] .chevron-icon {
  transform: rotate(180deg);
}

.filter-panel-body {
  margin-top: 12px;
  padding: 18px 20px;
  background: #f8fafc;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.filter-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}

.filter-col {
  display: flex;
  flex-direction: column;
}

.field-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #334155;
  margin-bottom: 8px;
}

.field-icon {
  color: #1d4ed8;
  flex-shrink: 0;
}

/* CUSTOM DROPDOWN STYLE ĐỒNG BỘ CTULIB */
.custom-select-wrapper {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}

.custom-select {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  width: 100%;
  min-height: 44px;
  height: 44px;
  padding: 0 40px 0 14px;
  background: #ffffff;
  color: #172033;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
}

.custom-select:hover:not(:disabled) {
  border-color: #94a3b8;
  background-color: #ffffff;
}

.custom-select:focus {
  border-color: #1d4ed8;
  outline: none;
  box-shadow: 0 0 0 3px rgba(29, 78, 216, 0.14);
  background-color: #ffffff;
}

.custom-select:disabled {
  background-color: #f1f5f9;
  color: #94a3b8;
  cursor: not-allowed;
  border-color: #e2e8f0;
}

.custom-select-wrapper .select-chevron {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  color: #64748b;
  pointer-events: none;
  transition: color 0.15s ease;
}

.custom-select-wrapper:focus-within .select-chevron {
  color: #1d4ed8;
}

/* NÚT THAO TÁC BỘ LỌC */
.filter-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;
}

.btn-reset {
  min-height: 40px;
  padding: 0 16px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13.5px;
  font-weight: 500;
  color: #475569;
  background: transparent;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-reset:hover:not(:disabled) {
  background: #f1f5f9;
  color: #0f172a;
  border-color: #94a3b8;
}

.btn-apply {
  min-height: 40px;
  padding: 0 20px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13.5px;
  font-weight: 600;
  border-radius: 6px;
  background-color: var(--primary, #1d4ed8);
  color: #ffffff;
  border: none;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.btn-apply:hover:not(:disabled) {
  background-color: var(--primary-hover, #1e40af);
}

@media (max-width: 640px) {
  .filter-grid {
    grid-template-columns: 1fr;
    gap: 14px;
  }

  .filter-row {
    flex-direction: column;
    align-items: stretch;
  }

  .btn-search {
    justify-content: center;
  }
}
</style>
