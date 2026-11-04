<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    currentPage: number;
    totalPages: number;
    totalItems: number;
    limit: number;
    disabled?: boolean;
    isLoading?: boolean;
  }>(),
  {
    disabled: false,
    isLoading: false,
  }
);

const emit = defineEmits<{
  (e: 'change-page', page: number): void;
  (e: 'page-change', page: number): void;
  (e: 'change-limit', limit: number): void;
}>();

const isDisabled = computed(() => props.disabled || props.isLoading);

const pages = computed(() => {
  const current = props.currentPage;
  const total = props.totalPages;
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  const result: (number | 'ellipsis')[] = [1];
  if (current > 3) result.push('ellipsis');
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) {
    result.push(i);
  }
  if (current < total - 2) result.push('ellipsis');
  if (total > 1) result.push(total);
  return result;
});

function goToPage(page: number) {
  if (isDisabled.value || page < 1 || page > props.totalPages || page === props.currentPage) return;
  emit('change-page', page);
  emit('page-change', page);
}

function prevPage() {
  if (isDisabled.value || props.currentPage <= 1) return;
  const p = props.currentPage - 1;
  emit('change-page', p);
  emit('page-change', p);
}

function nextPage() {
  if (isDisabled.value || props.currentPage >= props.totalPages) return;
  const p = props.currentPage + 1;
  emit('change-page', p);
  emit('page-change', p);
}

function onLimitChange(e: Event) {
  const target = e.target as HTMLSelectElement;
  emit('change-limit', Number(target.value));
}
</script>

<template>
  <div v-if="totalPages > 0" class="pagination-bar">
    <div class="pagination-info">
      <span class="num">{{ totalItems }}</span> sách · Trang
      <span class="num">{{ currentPage }}</span> / <span class="num">{{ totalPages }}</span>
    </div>

    <div class="pagination-controls">
      <label class="limit-selector">
        <select :value="limit" :disabled="isDisabled" @change="onLimitChange">
          <option :value="10">10 / trang</option>
          <option :value="12">12 / trang</option>
          <option :value="24">24 / trang</option>
          <option :value="48">48 / trang</option>
        </select>
      </label>

      <nav class="pagination" aria-label="Phân trang">
        <button
          class="page-nav-btn btn-prev"
          type="button"
          aria-label="Trang trước"
          :disabled="isDisabled || currentPage <= 1"
          @click="prevPage"
        >
          ‹
        </button>

        <template v-for="(p, idx) in pages" :key="idx">
          <span v-if="p === 'ellipsis'" class="page-ellipsis">…</span>
          <button
            v-else
            type="button"
            class="page-num-btn"
            :class="{ active: p === currentPage }"
            :aria-current="p === currentPage ? 'page' : undefined"
            :disabled="isDisabled"
            @click="goToPage(p)"
          >
            {{ p }}
          </button>
        </template>

        <button
          class="page-nav-btn btn-next"
          type="button"
          aria-label="Trang sau"
          :disabled="isDisabled || currentPage >= totalPages"
          @click="nextPage"
        >
          ›
        </button>
      </nav>
    </div>
  </div>
</template>

<style scoped>
.pagination-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  margin-top: 24px;
  padding-top: 18px;
  border-top: 1px solid var(--line);
}
.pagination-info {
  font-size: 13px;
  color: var(--muted);
}
.pagination-controls {
  display: flex;
  align-items: center;
  gap: 16px;
}
.limit-selector select {
  font-size: 13px;
  padding: 6px 10px;
  border-radius: 5px;
  border: 1px solid #cbd5e1;
  background: #fff;
}
.pagination {
  display: flex;
  align-items: center;
  gap: 4px;
}
.page-nav-btn,
.page-num-btn {
  min-width: 34px;
  min-height: 34px;
  display: grid;
  place-items: center;
  border-radius: 5px;
  border: 1px solid transparent;
  background: transparent;
  color: #64748b;
  font-size: 14px;
  cursor: pointer;
}
.page-nav-btn:hover:not(:disabled),
.page-num-btn:hover:not(:disabled) {
  background: #f1f5f9;
}
.page-num-btn.active {
  background: #edf3ff;
  color: var(--blue);
  font-weight: 600;
}
.page-ellipsis {
  padding: 0 4px;
  color: #94a3b8;
}
</style>
