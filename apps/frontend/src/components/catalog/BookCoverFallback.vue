<script setup lang="ts">
import type { Book } from '../../types/book';

defineProps<{
  title: Book['title'];
  bookType: Book['bookType'];
}>();
</script>

<template>
  <div
    class="cover-fallback academic-fallback"
    :class="{ 'is-reference': bookType !== 'TEXTBOOK' }"
    role="img"
    :aria-label="`Chưa có ảnh bìa của ${title}`"
  >
    <div class="spine-strip"></div>
    <div class="fallback-canvas">
      <div class="academic-crest">
        <svg
          class="cover-placeholder-icon"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      </div>
      <div class="book-spine-label">
        <span class="univ-stamp">CTULIB</span>
        <span class="sub-stamp">{{ bookType === 'TEXTBOOK' ? 'GIÁO TRÌNH' : 'THAM KHẢO' }}</span>
      </div>
    </div>
    <div class="book-edge-shadow"></div>
  </div>
</template>

<style scoped>
.academic-fallback {
  width: 100%;
  height: 100%;
  background: linear-gradient(145deg, #f0f7ff 0%, #e0edff 100%);
  display: flex;
  position: relative;
  overflow: hidden;
}

.academic-fallback.is-reference {
  background: linear-gradient(145deg, #fffbeb 0%, #fef3c7 100%);
}

.spine-strip {
  width: 6px;
  height: 100%;
  background: linear-gradient(180deg, #1d4ed8 0%, #1e40af 100%);
  flex-shrink: 0;
  box-shadow: 1px 0 2px rgba(0, 0, 0, 0.08);
}

.is-reference .spine-strip {
  background: linear-gradient(180deg, #d97706 0%, #b45309 100%);
}

.fallback-canvas {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 10px 4px;
  gap: 8px;
  z-index: 2;
}

.academic-crest {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  background: #ffffff;
  display: grid;
  place-items: center;
  box-shadow: 0 2px 6px rgba(29, 78, 216, 0.12);
}

.is-reference .academic-crest {
  box-shadow: 0 2px 6px rgba(217, 119, 6, 0.15);
}

.cover-placeholder-icon {
  color: #1d4ed8;
}

.is-reference .cover-placeholder-icon {
  color: #b45309;
}

.book-spine-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
}

.univ-stamp {
  font-size: 10px;
  font-weight: 850;
  letter-spacing: 0.12em;
  color: #1e3a8a;
}

.is-reference .univ-stamp {
  color: #78350f;
}

.sub-stamp {
  font-size: 7.5px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #3b82f6;
}

.is-reference .sub-stamp {
  color: #b45309;
}

.book-edge-shadow {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 3px;
  background: linear-gradient(90deg, transparent, rgba(0, 0, 0, 0.05));
  pointer-events: none;
}
</style>
