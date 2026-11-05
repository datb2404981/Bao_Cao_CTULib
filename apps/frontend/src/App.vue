<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { authenticate, AuthError, currentUser, logout, refreshSession } from './services/auth'
import BookCatalogView from './views/BookCatalogView.vue'
import BookManagementView from './views/BookManagementView.vue'

export type AppView = 'catalog' | 'management' | 'auth'

// View routing state
const currentView = ref<AppView>('catalog')
const mobileMenuOpen = ref(false)

const canManageBooks = computed(() => {
  return !!currentUser.value && currentUser.value.role !== 'READER'
})

const userInitials = computed(() => {
  const id = currentUser.value?.ctuIdentifier || 'U'
  return id.slice(0, 2).toUpperCase()
})

function syncViewFromHash() {
  const hash = window.location.hash.toLowerCase()
  if (hash === '#/manage' || hash === '#/management') {
    if (canManageBooks.value) {
      currentView.value = 'management'
    } else {
      currentView.value = 'catalog'
      window.location.hash = '#/catalog'
    }
  } else if (hash === '#/auth' || hash === '#/login' || hash === '#/register') {
    currentView.value = 'auth'
  } else {
    currentView.value = 'catalog'
  }
}

function navigateTo(view: AppView) {
  if (view === 'management' && !canManageBooks.value) {
    view = 'auth'
  }
  currentView.value = view
  mobileMenuOpen.value = false
  if (view === 'catalog') window.location.hash = '#/catalog'
  else if (view === 'management') window.location.hash = '#/manage'
  else if (view === 'auth') window.location.hash = '#/auth'
}

function toggleMobileMenu() {
  mobileMenuOpen.value = !mobileMenuOpen.value
}

// Authentication state
const mode = ref<'login' | 'register'>('login')
const identifier = ref('')
const email = ref('')
const password = ref('')
const confirmation = ref('')
const visible = ref(false)
const busy = ref(false)
const starting = ref(true)
const error = ref('')
const fields = ref<Record<string, string>>({})
const registering = computed(() => mode.value === 'register')
const role = computed(() => ({ READER: 'Bạn đọc', EMPLOYEE: 'Nhân viên', ADMIN: 'Quản trị viên' })[currentUser.value?.role || ''] || currentUser.value?.role)

function switchMode(next: 'login' | 'register') {
  mode.value = next
  password.value = confirmation.value = error.value = ''
  visible.value = false
  fields.value = {}
}

async function togglePassword() {
  const input = document.getElementById('password') as HTMLInputElement | null
  const start = input?.selectionStart ?? 0
  const end = input?.selectionEnd ?? 0
  visible.value = !visible.value
  await nextTick()
  input?.focus()
  input?.setSelectionRange(start, end)
}

async function submit() {
  if (busy.value) return
  error.value = ''
  fields.value = {}
  const ctuIdentifier = identifier.value.trim().toUpperCase()
  if (!ctuIdentifier) fields.value.ctuIdentifier = 'Vui lòng nhập mã định danh.'
  if (registering.value && !/^(B\d{7}|CB\d{5}|ADMIN\d*)$/.test(ctuIdentifier)) fields.value.ctuIdentifier = 'Mã số sinh viên hoặc cán bộ không hợp lệ.'
  if (ctuIdentifier.length > 10 && registering.value) fields.value.ctuIdentifier = 'Mã định danh không được vượt quá 10 ký tự.'
  if (!password.value) fields.value.password = 'Vui lòng nhập mật khẩu.'
  else if (registering.value && password.value.length < 8) fields.value.password = 'Mật khẩu phải từ 8 kí tự.'
  if (registering.value && confirmation.value !== password.value) fields.value.confirmation = 'Mật khẩu nhập lại chưa khớp.'
  if (registering.value) {
    if (!email.value.trim()) fields.value.email = 'Vui lòng nhập địa chỉ email.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) fields.value.email = 'Địa chỉ email không hợp lệ.'
    if (!confirmation.value) fields.value.confirmation = 'Vui lòng xác nhận mật khẩu.'
  }
  if (Object.keys(fields.value).length) {
    await nextTick()
    document.querySelector<HTMLInputElement>('input[aria-invalid="true"]')?.focus()
    return
  }
  busy.value = true
  try {
    await authenticate(mode.value, { ctuIdentifier, password: password.value, ...(registering.value ? { email: email.value.trim() } : {}) })
    password.value = confirmation.value = ''
    visible.value = false
    if (window.location.hash === '#/manage' && canManageBooks.value) {
      currentView.value = 'management'
    } else {
      navigateTo('catalog')
    }
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Đã xảy ra lỗi. Vui lòng thử lại.'
    if (cause instanceof AuthError) fields.value = cause.fields
  } finally { busy.value = false }
}

async function signOut() {
  busy.value = true
  error.value = ''
  try {
    await logout()
    switchMode('login')
    if (currentView.value === 'management') {
      navigateTo('catalog')
    }
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Không thể đăng xuất. Vui lòng thử lại.' }
  finally { busy.value = false }
}

onMounted(async () => {
  syncViewFromHash()
  window.addEventListener('hashchange', syncViewFromHash)
  try { await refreshSession() }
  catch {
    // Session restoration failure on initial mount is expected for guest visitors
  } finally {
    starting.value = false
    syncViewFromHash()
  }
})

onUnmounted(() => {
  window.removeEventListener('hashchange', syncViewFromHash)
})
</script>

<template>
  <div class="app">
    <!-- Topbar Navigation -->
    <header class="topbar">
      <div class="topbar-left">
        <button
          class="menu-button"
          type="button"
          aria-label="Mở điều hướng"
          @click="toggleMobileMenu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
        </button>

        <a class="brand" href="#/catalog" @click.prevent="navigateTo('catalog')">
          <svg class="brand-crest" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
            <path d="M6 6h10" />
            <path d="M6 10h10" />
          </svg>
          <span>CTULib</span>
        </a>

        <nav class="topnav" :class="{ 'is-open': mobileMenuOpen }">
          <a
            :class="{ active: currentView === 'catalog' }"
            href="#/catalog"
            @click.prevent="navigateTo('catalog')"
          >
            Tìm sách
          </a>
          <a
            v-if="canManageBooks"
            :class="{ active: currentView === 'management' }"
            href="#/manage"
            @click.prevent="navigateTo('management')"
          >
            Quản lý sách
          </a>
          <a
            :class="{ active: currentView === 'auth' }"
            href="#/auth"
            @click.prevent="navigateTo('auth')"
          >
            {{ currentUser ? 'Tài khoản' : 'Đăng nhập' }}
          </a>
        </nav>
      </div>

      <div class="topbar-right">
        <div
          v-if="currentUser"
          class="profile"
          style="cursor: pointer"
          role="button"
          tabindex="0"
          @click="navigateTo('auth')"
        >
          <span class="avatar">{{ userInitials }}</span>
          <span class="profile-name">{{ currentUser.ctuIdentifier }}</span>
          <span class="badge blue small">{{ role }}</span>
        </div>
        <button
          v-else
          class="btn small primary"
          type="button"
          @click="navigateTo('auth')"
        >
          Đăng nhập
        </button>
      </div>
    </header>

    <!-- Main Workspace Content according to Hash View -->
    <main id="main" class="container">
      <!-- 1. Catalog View (SC02) -->
      <section v-if="currentView === 'catalog'" aria-label="Tra cứu sách">
        <BookCatalogView @navigate="navigateTo" />
      </section>

      <!-- 2. Management View (SC12) -->
      <section v-else-if="currentView === 'management'" aria-label="Quản lý kho sách">
        <BookManagementView />
      </section>

      <!-- 3. Auth Layout (SC03 & SC04) - High-Craft Academic Portal Login -->
      <div v-else-if="currentView === 'auth'" class="auth-container">
        <section class="auth-panel" aria-label="Xác thực tài khoản">
          <div v-if="starting" class="loading-state" role="status">
            <span class="spinner"></span> Đang kiểm tra phiên đăng nhập…
          </div>

          <template v-else-if="currentUser">
            <div class="success-icon" aria-hidden="true">✓</div>
            <h1>Tài khoản CTULib</h1>
            <p class="intro">Bạn đã đăng nhập vào hệ thống thư viện thành công.</p>
            <dl class="account-details">
              <div>
                <dt>Mã định danh</dt>
                <dd class="num">{{ currentUser.ctuIdentifier }}</dd>
              </div>
              <div v-if="currentUser.email">
                <dt>Email</dt>
                <dd>{{ currentUser.email }}</dd>
              </div>
              <div>
                <dt>Vai trò</dt>
                <dd><span class="badge blue">{{ role }}</span></dd>
              </div>
            </dl>
            <p v-if="error" class="notice error" role="alert" style="margin-bottom: 16px">
              {{ error }}
            </p>
            <div class="form-actions">
              <button class="btn danger" :disabled="busy" @click="signOut">
                {{ busy ? 'Đang đăng xuất…' : 'Đăng xuất' }}
              </button>
            </div>
          </template>

          <template v-else>
            <h1>{{ registering ? 'Đăng ký tài khoản' : 'Đăng nhập' }}</h1>
            <p class="intro">{{ registering ? 'Đăng ký tài khoản thư viện Đại học Cần Thơ.' : 'Sử dụng tài khoản thư viện Đại học Cần Thơ của bạn.' }}</p>

            <div class="mode-switch" aria-label="Chọn hình thức xác thực">
              <button
                type="button"
                :class="{ active: !registering }"
                :aria-pressed="!registering"
                :disabled="busy"
                @click="switchMode('login')"
              >
                Đăng nhập
              </button>
              <button
                type="button"
                :class="{ active: registering }"
                :aria-pressed="registering"
                :disabled="busy"
                @click="switchMode('register')"
              >
                Đăng ký
              </button>
            </div>

            <p v-if="error" class="notice error" role="alert" style="margin-bottom: 16px">
              {{ error }}
            </p>

            <form class="stack" novalidate @submit.prevent="submit">
              <fieldset :disabled="busy" class="stack">
                <label class="field">
                  <span>Mã số sinh viên / cán bộ <b class="required">*</b></span>
                  <div class="input-with-icon">
                    <svg class="field-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    <input
                      id="identifier"
                      v-model="identifier"
                      name="ctuIdentifier"
                      autocomplete="username"
                      placeholder="MSSV hoặc MSCB"
                      required
                      :aria-invalid="!!fields.ctuIdentifier"
                      aria-describedby="identifier-error"
                    />
                  </div>
                  <p v-if="fields.ctuIdentifier" id="identifier-error" class="field-error" aria-live="polite">
                    {{ fields.ctuIdentifier }}
                  </p>
                </label>

                <label v-if="registering" class="field">
                  <span>Địa chỉ email <b class="required">*</b></span>
                  <div class="input-with-icon">
                    <svg class="field-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <rect width="20" height="16" x="2" y="4" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                    <input
                      id="email"
                      v-model="email"
                      type="email"
                      name="email"
                      autocomplete="email"
                      placeholder="ban@ctu.edu.vn"
                      required
                      :aria-invalid="!!fields.email"
                      aria-describedby="email-error"
                    />
                  </div>
                  <p v-if="fields.email" id="email-error" class="field-error" aria-live="polite">
                    {{ fields.email }}
                  </p>
                </label>

                <label class="field">
                  <span>Mật khẩu <b class="required">*</b></span>
                  <div class="password-field">
                    <input
                      id="password"
                      v-model="password"
                      :type="visible ? 'text' : 'password'"
                      name="password"
                      :autocomplete="registering ? 'new-password' : 'current-password'"
                      :placeholder="registering ? 'Tối thiểu 8 ký tự' : 'Nhập mật khẩu'"
                      required
                      :aria-invalid="!!fields.password"
                      aria-describedby="password-error"
                    />
                    <button
                      class="password-toggle"
                      type="button"
                      :aria-label="visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'"
                      :aria-pressed="visible"
                      @mousedown.prevent
                      @click="togglePassword"
                    >
                      <svg v-if="visible" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                      <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      <span>{{ visible ? 'Ẩn' : 'Hiện' }}</span>
                    </button>
                  </div>
                  <p v-if="fields.password" id="password-error" class="field-error" aria-live="polite">
                    {{ fields.password }}
                  </p>
                </label>

                <label v-if="registering" class="field">
                  <span>Nhập lại mật khẩu <b class="required">*</b></span>
                  <div class="password-field">
                    <input
                      id="confirmation"
                      v-model="confirmation"
                      :type="visible ? 'text' : 'password'"
                      autocomplete="new-password"
                      placeholder="Xác nhận mật khẩu của bạn"
                      required
                      :aria-invalid="!!fields.confirmation"
                      aria-describedby="confirmation-error"
                    />
                  </div>
                  <p v-if="fields.confirmation" id="confirmation-error" class="field-error" aria-live="polite">
                    {{ fields.confirmation }}
                  </p>
                </label>

                <button class="btn primary submit-btn" type="submit" :disabled="busy">
                  <span>{{ busy ? 'Đang xử lý…' : registering ? 'Tạo tài khoản' : 'Đăng nhập' }}</span>
                  <span v-if="busy" class="spinner" aria-hidden="true"></span>
                  <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </button>
              </fieldset>
            </form>

            <p class="small muted" style="margin-top: 24px; text-align: center">
              {{ registering ? 'Đã có tài khoản?' : 'Chưa có tài khoản?' }}
              <a href="#/auth" @click.prevent="switchMode(registering ? 'login' : 'register')">
                {{ registering ? 'Đăng nhập ngay' : 'Đăng ký độc giả' }}
              </a>
            </p>
          </template>
        </section>
      </div>
    </main>

    <!-- Mobile Navigation Bar (< 768px) -->
    <nav class="mobile-nav" aria-label="Điều hướng trên điện thoại">
      <a
        :class="{ active: currentView === 'catalog' }"
        href="#/catalog"
        @click.prevent="navigateTo('catalog')"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m16 16 4.5 4.5" />
        </svg>
        <span>Tìm sách</span>
      </a>
      <a
        v-if="canManageBooks"
        :class="{ active: currentView === 'management' }"
        href="#/manage"
        @click.prevent="navigateTo('management')"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-3H4z" />
          <path d="M20 4h-4a3 3 0 0 0-3 3v14a4 4 0 0 1 4-3h3z" />
        </svg>
        <span>Quản lý</span>
      </a>
      <a
        :class="{ active: currentView === 'auth' }"
        href="#/auth"
        @click.prevent="navigateTo('auth')"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="7" r="4" />
          <path d="M6 21v-2a4 4 0 0 1 8 0v2" />
        </svg>
        <span>{{ currentUser ? 'Tài khoản' : 'Đăng nhập' }}</span>
      </a>
    </nav>

    <!-- Footer -->
    <footer class="footer">
      <span>© {{ new Date().getFullYear() }} CTULib · Thư viện Đại học Cần Thơ</span>
      <span>Hệ thống quản lý và tra cứu học liệu số</span>
    </footer>
  </div>
</template>
