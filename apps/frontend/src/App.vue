<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { authenticate, AuthError, currentUser, logout, refreshSession } from './services/auth'

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
  } catch (cause) { error.value = cause instanceof Error ? cause.message : 'Không thể đăng xuất. Vui lòng thử lại.' }
  finally { busy.value = false }
}
onMounted(async () => {
  try { await refreshSession() }
  catch (cause) {
    if (!(cause instanceof AuthError && cause.status === 401)) error.value = cause instanceof Error ? cause.message : 'Không thể khôi phục phiên đăng nhập.'
  } finally { starting.value = false }
})
</script>

<template>
  <div class="page-shell">
    <header class="site-header">
      <a class="brand" href="/" aria-label="CTULib — trang chủ">
        <img src="/ctu-logo.png" alt="Logo Đại học Cần Thơ" width="52" height="52" />
        <span><strong>CTULib<span class="brand-dot">.</span></strong><small>THƯ VIỆN ĐẠI HỌC CẦN THƠ</small></span>
      </a>
      <a class="university-link" href="https://www.ctu.edu.vn/" target="_blank" rel="noopener noreferrer">Đại học Cần Thơ <span aria-hidden="true">↗</span></a>
    </header>

    <main class="auth-layout">
      <section class="intro" aria-labelledby="intro-title">
        <div class="eyebrow"><span></span> KHÔNG GIAN TRI THỨC CỦA BẠN</div>
        <h1 id="intro-title">Mở trang sách.<br />Mở <em>tương lai.</em></h1>
        <p class="intro-description">Kết nối với thư viện Đại học Cần Thơ.<br />Đồng hành cùng bạn trên mỗi hành trình học tập<br class="desktop-break" /> và khám phá tri thức.</p>
        <div class="book-scene" aria-hidden="true">
          <div class="orbit orbit-one"></div><div class="orbit orbit-two"></div>
          <span class="spark spark-one">✦</span><span class="spark spark-two">✧</span>
          <div class="book book-back"><span>KHÁM PHÁ</span></div>
          <div class="book book-middle"><span>HỌC TẬP</span></div>
          <div class="book book-front"><span class="book-label">CTU<br />LIBRARY</span><span class="book-mark">✳</span><span class="book-caption">Tri thức mở lối</span></div>
          <div class="book-base"></div>
          <div class="scene-tag"><span>✦</span> Một tài khoản. Ngàn khám phá.</div>
        </div>
        <div class="intro-bottom"><span class="line"></span> HỌC TẬP · KẾT NỐI · PHÁT TRIỂN</div>
      </section>

      <section class="form-panel" aria-label="Xác thực tài khoản">
        <div v-if="starting" class="loading-state" role="status"><span class="spinner"></span> Đang kiểm tra phiên đăng nhập…</div>
        <template v-else-if="currentUser">
          <div class="section-kicker">TÀI KHOẢN CTULIB</div>
          <div class="success-icon" aria-hidden="true">✓</div>
          <h2>Chào mừng bạn trở lại!</h2>
          <p class="form-description">Bạn đã đăng nhập vào CTULib thành công.</p>
          <dl class="account-details"><div><dt>Mã định danh</dt><dd>{{ currentUser.ctuIdentifier }}</dd></div><div v-if="currentUser.email"><dt>Email</dt><dd>{{ currentUser.email }}</dd></div><div><dt>Vai trò</dt><dd>{{ role }}</dd></div></dl>
          <p v-if="error" class="alert error" role="alert">{{ error }}</p>
          <button class="primary-button" :disabled="busy" @click="signOut">{{ busy ? 'Đang đăng xuất…' : 'Đăng xuất' }} <span aria-hidden="true">↗</span></button>
        </template>
        <template v-else>
          <h2>{{ registering ? 'Tạo tài khoản mới' : 'Đăng nhập CTULib' }}</h2>
          <p class="form-description">{{ registering ? 'Tạo tài khoản thư viện Đại học Cần Thơ.' : 'Sử dụng tài khoản thư viện Đại học Cần Thơ.' }}</p>
          <div class="mode-switch" aria-label="Chọn hình thức xác thực">
            <button :class="{ active: !registering }" :aria-pressed="!registering" :disabled="busy" @click="switchMode('login')">Đăng nhập</button>
            <button :class="{ active: registering }" :aria-pressed="registering" :disabled="busy" @click="switchMode('register')">Đăng ký</button>
          </div>
          <p v-if="error" class="alert error" role="alert">{{ error }}</p>
          <form novalidate @submit.prevent="submit">
            <fieldset :disabled="busy">
              <div class="field"><label for="identifier">Mã số sinh viên / cán bộ</label><input id="identifier" v-model="identifier" name="ctuIdentifier" autocomplete="username" placeholder="Mã số sinh viên hoặc cán bộ" required :aria-invalid="!!fields.ctuIdentifier" aria-describedby="identifier-error" /><p v-if="fields.ctuIdentifier" id="identifier-error" class="field-error" aria-live="polite">{{ fields.ctuIdentifier }}</p></div>
              <div v-if="registering" class="field"><label for="email">Địa chỉ email</label><input id="email" v-model="email" type="email" name="email" autocomplete="email" placeholder="ban@example.com" required :aria-invalid="!!fields.email" aria-describedby="email-error" /><p v-if="fields.email" id="email-error" class="field-error" aria-live="polite">{{ fields.email }}</p></div>
              <div class="field"><label for="password">Mật khẩu</label><div class="password-input"><input id="password" v-model="password" :type="visible ? 'text' : 'password'" name="password" :autocomplete="registering ? 'new-password' : 'current-password'" :placeholder="registering ? 'Tối thiểu 8 ký tự' : 'Nhập mật khẩu'" required :aria-invalid="!!fields.password" aria-describedby="password-error" /><button type="button" :aria-label="visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'" :aria-pressed="visible" @mousedown.prevent @click="togglePassword">{{ visible ? 'Ẩn' : 'Hiện' }}</button></div><p v-if="fields.password" id="password-error" class="field-error" aria-live="polite">{{ fields.password }}</p></div>
              <div v-if="registering" class="field"><label for="confirmation">Nhập lại mật khẩu</label><input id="confirmation" v-model="confirmation" :type="visible ? 'text' : 'password'" autocomplete="new-password" placeholder="Xác nhận mật khẩu của bạn" required :aria-invalid="!!fields.confirmation" aria-describedby="confirmation-error" /><p v-if="fields.confirmation" id="confirmation-error" class="field-error" aria-live="polite">{{ fields.confirmation }}</p></div>
              <button class="primary-button" type="submit"><span>{{ busy ? 'Đang xử lý…' : registering ? 'Tạo tài khoản' : 'Đăng nhập' }}</span><span v-if="busy" class="spinner" aria-hidden="true"></span><span v-else aria-hidden="true">→</span></button>
            </fieldset>
          </form>
        </template>
      </section>
    </main>
    <footer><span>© {{ new Date().getFullYear() }} CTULib · Đại học Cần Thơ</span><span>Đồng hành cùng hành trình tri thức của bạn.</span></footer>
  </div>
</template>
