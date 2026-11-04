<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue';

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

function onSearchInput(event: Event) {
  const target = event.target as HTMLInputElement;
  localSearch.value = target.value;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    emit('update:search', localSearch.value);
  }, props.debounceMs);
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
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="m16 16 4.5 4.5" />
          </svg>
          <input
            v-model="localSearch"
            type="search"
            name="search"
            aria-label="Tìm tên sách hoặc tác giả"
            placeholder="Tìm tên sách hoặc tác giả"
            :disabled="isLoading"
            @input="onSearchInput"
          />
        </div>
      </div>
      <button
        class="btn primary btn-search"
        type="submit"
        :disabled="isLoading"
      >
        Tìm kiếm
      </button>
    </div>

    <details class="extra-filters">
      <summary>Lọc theo khoa, loại sách, sắp xếp</summary>
      <div class="filter-grid">
        <label class="field">
          <span>Khoa/Viện</span>
          <select
            v-model="localFacultyId"
            class="faculty-select"
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
        </label>

        <label class="field">
          <span>Loại sách</span>
          <select
            v-model="localBookType"
            class="kind-select"
            name="kind"
            :disabled="isLoading"
            @change="onBookTypeChange"
          >
            <option value="">Tất cả loại</option>
            <option value="TEXTBOOK">Giáo trình</option>
            <option value="REFERENCE">Sách tham khảo</option>
          </select>
        </label>
      </div>

      <div class="row end" style="margin-top: 14px">
        <button
          class="btn quiet btn-reset"
          type="button"
          data-reset-filter
          :disabled="isLoading"
          @click="onReset"
        >
          Xóa bộ lọc
        </button>
        <button class="btn" type="submit" :disabled="isLoading">
          Áp dụng
        </button>
      </div>
    </details>
  </form>
</template>
