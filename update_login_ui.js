const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

// A. Tambahkan CSS Islamic Pattern & Hero Glow jika belum ada
const patternCss = `    /* Subtle Islamic geometric pattern overlay */
    .bg-islamic-pattern {
      background-image: radial-gradient(rgba(255, 255, 255, 0.08) 1.5px, transparent 1.5px),
                        radial-gradient(rgba(255, 255, 255, 0.05) 1.5px, transparent 1.5px);
      background-size: 32px 32px;
      background-position: 0 0, 16px 16px;
    }
    .hero-glow {
      background: radial-gradient(circle at 50% 20%, rgba(131, 197, 190, 0.25) 0%, rgba(0, 109, 119, 0) 70%);
    }`;

if (!html.includes('.bg-islamic-pattern')) {
  html = html.replace('</style>', patternCss + '\n  </style>');
  console.log('✓ Ditambahkan CSS pattern & glow hero.');
}

// B. Template Baru: Responsive Desktop Split & Mobile Ambient Login
const newLoginHtml = `    <!-- ========================================================================= -->
    <!-- WORLD-CLASS RESPONSIVE LOGIN SCREEN (DESKTOP SPLIT & MOBILE AMBIENT)       -->
    <!-- ========================================================================= -->
    <div id="login-screen" class="min-h-screen w-full flex flex-col justify-between bg-slate-50 text-slate-800 antialiased selection:bg-teal-500 selection:text-white">
      
      <main class="flex-1 flex w-full min-h-screen">
        <!-- BEGIN: LeftHeroSection (Desktop / Laptop Only - Split Screen) -->
        <section class="hidden lg:flex lg:w-7/12 xl:w-3/5 bg-gradient-to-br from-[#0B3C49] via-[#006D77] to-[#028090] text-white flex-col justify-between p-12 xl:p-16 relative overflow-hidden select-none" data-purpose="brand-hero">
          <!-- Ambient background decoration -->
          <div class="absolute inset-0 bg-islamic-pattern pointer-events-none opacity-40"></div>
          <div class="absolute inset-0 hero-glow pointer-events-none"></div>

          <!-- Top Branding: Logo & Tagline -->
          <div class="relative z-10 flex items-center gap-4">
            <div class="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-[#fde047] shadow-lg">
              <svg class="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/></svg>
            </div>
            <div>
              <span class="inline-block px-3 py-1 bg-white/15 backdrop-blur-sm border border-white/20 text-xs font-semibold uppercase tracking-wider rounded-full text-teal-100">
                Kementerian Agama RI
              </span>
              <p class="text-xs text-teal-100/80 mt-1 font-medium tracking-wide">Kantor Wilayah Kabupaten Majalengka</p>
            </div>
          </div>

          <!-- Central Hero Content: Title & Digital Education Graphics -->
          <div class="relative z-10 my-auto py-6">
            <!-- Big Brand Title -->
            <div class="text-left mb-6">
              <h1 class="text-6xl xl:text-7xl font-extrabold tracking-tight text-white mb-2 leading-none flex items-center gap-3">
                <span class="text-[#fde047]">A</span>JAR
              </h1>
              <p class="text-lg xl:text-xl font-medium text-teal-100 leading-snug">
                Administrasi &amp; Jurnal Aktivitas Mengajar
              </p>
              <p class="text-base font-semibold tracking-wider text-teal-200 mt-1 uppercase">
                MAN 1 MAJALENGKA
              </p>
            </div>

            <!-- Modern Educational Digital Illustration -->
            <div class="mt-6 max-w-lg bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20 shadow-2xl relative" data-purpose="hero-illustration">
              <div class="bg-slate-900/40 rounded-2xl p-5 border border-white/10 backdrop-blur-sm">
                <div class="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                  <div class="flex gap-2">
                    <div class="w-3 h-3 rounded-full bg-rose-500/80"></div>
                    <div class="w-3 h-3 rounded-full bg-amber-500/80"></div>
                    <div class="w-3 h-3 rounded-full bg-emerald-500/80"></div>
                  </div>
                  <div class="flex items-center gap-2 text-xs text-teal-200/80 font-mono">
                    <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                    Portal Guru Aktif
                  </div>
                </div>

                <!-- Workspace Mock -->
                <div class="grid grid-cols-12 gap-3 items-center">
                  <div class="col-span-8 bg-slate-800/90 rounded-xl p-3 border border-teal-500/30">
                    <div class="h-24 bg-gradient-to-tr from-teal-950 to-slate-800 rounded-lg flex items-center justify-center relative overflow-hidden">
                      <div class="flex flex-col items-center">
                        <div class="w-9 h-9 rounded-full bg-teal-500/30 border border-teal-300 flex items-center justify-center text-[#fde047] mb-1">
                          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                        </div>
                        <span class="text-[10px] text-teal-200 font-medium">Bpk. H. Ahmad Fauzi, M.Pd</span>
                      </div>
                      <div class="absolute right-2 top-2 bg-emerald-500/20 px-2 py-0.5 rounded text-[9px] text-emerald-300 font-mono border border-emerald-500/30">
                        Jurnal #084
                      </div>
                    </div>
                    <div class="mt-2 flex items-center justify-between text-[11px] text-slate-300">
                      <span>Materi: Fikih Madrasah</span>
                      <span class="text-emerald-400 font-medium">Terverifikasi ✓</span>
                    </div>
                  </div>

                  <div class="col-span-4 flex flex-col gap-2">
                    <div class="bg-teal-700/40 border border-teal-400/20 p-2.5 rounded-xl text-center">
                      <span class="block text-xl font-bold text-white">100%</span>
                      <span class="text-[10px] text-teal-200">Presensi Guru</span>
                    </div>
                    <div class="bg-teal-700/40 border border-teal-400/20 p-2.5 rounded-xl text-center">
                      <span class="block text-xl font-bold text-amber-300">42</span>
                      <span class="text-[10px] text-teal-200">Rombel Belajar</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Bottom floating badge -->
              <div class="mt-4 flex items-center justify-between text-xs text-teal-100/90 px-1">
                <span class="flex items-center gap-1.5">
                  <svg class="w-4 h-4 text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path clip-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" fill-rule="evenodd"/></svg>
                  Sistem Jurnal Terintegrasi EMIS &amp; Simpatika
                </span>
                <span class="text-[11px] bg-amber-400/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-400/30 font-semibold">T.A 2026/2027</span>
              </div>
            </div>
          </div>

          <!-- Hero Footer Quote -->
          <div class="relative z-10 pt-4 border-t border-white/10 flex items-center justify-between">
            <p class="text-xs text-teal-100 italic">
              “Mewujudkan Madrasah Mandiri Berprestasi, Maju, Bermutu, dan Mendunia.”
            </p>
          </div>
        </section>
        <!-- END: LeftHeroSection -->

        <!-- BEGIN: RightAuthSection (Desktop & Mobile) -->
        <section class="w-full lg:w-5/12 xl:w-2/5 flex flex-col justify-between p-5 sm:p-8 md:p-10 lg:p-12 bg-gradient-to-b from-[#EBF5FB] via-[#F4F9FD] to-[#E5EFF8] lg:bg-slate-50 relative overflow-hidden" data-purpose="login-form-container">
          <!-- Ambient Background Accents for Mobile -->
          <div aria-hidden="true" class="lg:hidden absolute -top-20 -right-20 w-72 h-72 bg-gradient-to-br from-cyan-200/40 to-teal-400/20 rounded-full blur-3xl pointer-events-none"></div>
          <div aria-hidden="true" class="lg:hidden absolute top-1/3 -left-28 w-64 h-64 bg-teal-200/25 rounded-full blur-3xl pointer-events-none"></div>

          <!-- Mobile School Header (Visible on smaller screens only) -->
          <header class="lg:hidden relative z-10 flex flex-col items-center text-center pt-4 pb-4" data-purpose="mobile-header">
            <h1 class="text-4xl font-extrabold tracking-tight text-slate-800">
              <span class="text-[#0A4D68]">A</span><span class="text-[#088395]">JAR</span>
            </h1>
            <p class="text-[12.5px] font-semibold text-slate-600 mt-1 max-w-[260px] leading-snug">
              Administrasi &amp; Jurnal Aktivitas Mengajar
            </p>
            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/5 border border-slate-300/40 shadow-xs mt-2">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span class="text-[11px] font-bold tracking-wider uppercase text-slate-700">MAN 1 MAJALENGKA</span>
            </div>
          </header>

          <!-- Center Wrapper for Clean Auth Card -->
          <div class="relative z-10 my-auto w-full max-w-md mx-auto">
            <div class="bg-white/95 backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-white/80 ring-1 ring-slate-100 shadow-2xl">
              <!-- Title & Subtitle -->
              <div class="mb-5 text-center sm:text-left">
                <h2 class="text-2xl font-bold text-slate-800 tracking-tight">Welcome</h2>
                <p class="text-xs text-slate-500 mt-0.5">Akses Guru &amp; Tenaga Pendidik</p>
              </div>

              <!-- Login Form Element -->
              <form id="auth-form" class="space-y-4" onsubmit="event.preventDefault(); doLogin();">
                <!-- Username / NIP Field -->
                <div class="space-y-1.5">
                  <label class="block text-xs font-semibold text-slate-700" for="login-nip">Username / NIP</label>
                  <div class="relative rounded-2xl shadow-xs transition-all focus-within:ring-2 focus-within:ring-[#088395]/40">
                    <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" viewBox="0 0 24 24"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </div>
                    <input id="login-nip" name="username" type="text" required placeholder="Masukkan NIP" autocomplete="username" class="block w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-10 pr-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-[#088395] focus:bg-white focus:outline-none transition duration-150">
                  </div>
                </div>

                <!-- Password Field -->
                <div class="space-y-1.5">
                  <label class="block text-xs font-semibold text-slate-700" for="login-password">Password</label>
                  <div class="relative rounded-2xl shadow-xs transition-all focus-within:ring-2 focus-within:ring-[#088395]/40">
                    <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <svg class="h-5 w-5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" viewBox="0 0 24 24"><rect height="11" rx="2" ry="2" width="18" x="3" y="11"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    </div>
                    <input id="login-password" name="password" type="password" required placeholder="••••••••••••" autocomplete="current-password" class="block w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-10 pr-11 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-[#088395] focus:bg-white focus:outline-none transition duration-150">
                    <!-- Password Toggle Visibility Button -->
                    <button id="togglePassword" type="button" aria-label="Tampilkan atau sembunyikan kata sandi" class="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none">
                      <svg id="eyeOffIcon" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" stroke-linecap="round" stroke-linejoin="round"/></svg>
                      <svg id="eyeOnIcon" class="h-5 w-5 hidden" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" stroke-linecap="round" stroke-linejoin="round"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>
                  </div>
                </div>

                <!-- Options Row: Remember Me -->
                <div class="flex items-center justify-between pt-1 text-xs">
                  <label class="flex items-center gap-2 cursor-pointer select-none text-slate-600 hover:text-slate-900">
                    <input id="login-remember" name="rememberMe" type="checkbox" class="w-4 h-4 rounded border-slate-300 text-[#088395] focus:ring-[#088395]/30 focus:ring-offset-0 transition">
                    <span>Ingat Saya</span>
                  </label>
                </div>

                <!-- Submit Button -->
                <button id="btn-login-submit" type="submit" class="w-full mt-2 py-3.5 px-4 rounded-xl font-semibold text-white bg-gradient-to-r from-[#088395] to-[#0C92A6] hover:from-[#077484] hover:to-[#088395] active:scale-[0.985] shadow-lg shadow-teal-700/25 transition duration-200 flex items-center justify-center gap-2 text-base">
                  <span id="btn-login-text">Masuk ke Portal</span>
                  <svg class="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
              </form>

              <!-- Alternative Action / Register Link -->
              <div class="mt-6 pt-5 border-t border-slate-100 text-center text-xs text-slate-500">
                Belum punya akun?
                <a href="javascript:void(0)" onclick="showModernToast('Silakan hubungi Administrator/Wakamad Kurikulum MAN 1 Majalengka untuk pendaftaran akun guru.', 'info', 5000)" class="font-semibold text-[#088395] hover:text-[#0A4D68] hover:underline ml-1">
                  Daftar Akun
                </a>
              </div>
            </div>
          </div>

          <!-- Legal Institutional Footer -->
          <footer class="relative z-10 pt-4 pb-2 text-center text-xs text-slate-400" data-purpose="app-footer">
            <p>© 2026 <strong>MAN 1 Majalengka</strong></p>
            <p class="text-[11px] text-slate-400/80 mt-0.5">Sistem Administrasi &amp; Jurnal Aktivitas Mengajar</p>
          </footer>
        </section>
        <!-- END: RightAuthSection -->
      </main>
    </div>`;

// C. Temukan blok login lama dan ganti dengan blok login baru
const loginRegex = /<div id="login-screen"[\s\S]*?<\/div>\s*(?=<div id="app-container")/i;

if (loginRegex.test(html)) {
  html = html.replace(loginRegex, newLoginHtml + '\n\n    ');
  console.log('✓ Berhasil mengganti halaman login dengan desain Responsive Desktop & Mobile baru!');
} else {
  // Jika tag diawali comment atau variasi lain
  const altRegex = /<!-- =+ LOGIN SCREEN =+ -->[\s\S]*?(?=<div id="app-container")/i;
  if (altRegex.test(html)) {
    html = html.replace(altRegex, newLoginHtml + '\n\n    ');
    console.log('✓ Berhasil mengganti halaman login (alternatif pola)!');
  } else {
    console.warn('Pola login tidak cocok, mencari container login...');
    const startIdx = html.indexOf('id="login-screen"');
    const endIdx = html.indexOf('id="app-container"');
    if (startIdx !== -1 && endIdx !== -1) {
      const beforeLogin = html.lastIndexOf('<div', startIdx);
      const beforeApp = html.lastIndexOf('<div', endIdx);
      html = html.substring(0, beforeLogin) + newLoginHtml + '\n\n    ' + html.substring(beforeApp);
      console.log('✓ Berhasil mengganti container login via slice!');
    }
  }
}

// D. Pastikan Skrip Toggle Password Tersedia
const toggleJs = `
    // TOGGLE PASSWORD VISIBILITY
    document.addEventListener('DOMContentLoaded', () => {
      const togglePasswordBtn = document.getElementById('togglePassword');
      const passwordInput = document.getElementById('login-password');
      const eyeOffIcon = document.getElementById('eyeOffIcon');
      const eyeOnIcon = document.getElementById('eyeOnIcon');

      if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener('click', () => {
          const isPassword = passwordInput.type === 'password';
          passwordInput.type = isPassword ? 'text' : 'password';
          if (eyeOffIcon) eyeOffIcon.classList.toggle('hidden', isPassword);
          if (eyeOnIcon) eyeOnIcon.classList.toggle('hidden', !isPassword);
        });
      }
    });
`;

if (!html.includes('TOGGLE PASSWORD VISIBILITY')) {
  html = html.replace('</body>', '<script>' + toggleJs + '</script>\n</body>');
  console.log('✓ Skrip toggle password disematkan.');
}

fs.writeFileSync('index.html', html, 'utf8');
console.log('✓ File index.html berhasil diperbarui (' + html.length + ' bytes)!');
