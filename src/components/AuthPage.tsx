import React, { useState, useEffect } from 'react';
import {
  User as UserIcon,
  Lock,
  Briefcase,
  CreditCard,
  Eye,
  EyeOff,
  ArrowRight,
  Check,
} from 'lucide-react';
import { ReferencesMap, User } from '../types';
import { callGasApi, DEFAULT_REFERENCES, warmUpGasConnection, GasConnectionInfo } from '../services/gasApi';
import { NeuDropdown, NeuDropdownOption } from './NeuDropdown';
import { toProperCase, formatProperCaseLive } from '../utils/textUtils';
import { AjarBrandLogo } from './AjarBrandLogo';

interface AuthPageProps {
  references: ReferencesMap;
  onLoginSuccess: (user: User, token: string) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  gasConnection?: GasConnectionInfo | null;
}

export const AuthPage: React.FC<AuthPageProps> = ({ references, onLoginSuccess, showToast, gasConnection }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);

  // Pre-warming koneksi backend Google Apps Script secara spekulatif saat halaman dibuka
  useEffect(() => {
    warmUpGasConnection();
  }, []);

  // Login form state
  const [loginUsername, setLoginUsername] = useState(
    localStorage.getItem('remembered_username') || ''
  );
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Register form state
  const [regGelarDepan, setRegGelarDepan] = useState('');
  const [regNama, setRegNama] = useState('');
  const [regGelarBelakang, setRegGelarBelakang] = useState('');
  const [regNip, setRegNip] = useState('');
  const [regJabatan, setRegJabatan] = useState('Guru Mata Pelajaran');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [termsAgreed, setTermsAgreed] = useState(true);

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reference lists with fallbacks
  const listGelarDepan =
    references.GelarDepan && references.GelarDepan.length > 0
      ? references.GelarDepan
      : DEFAULT_REFERENCES.GelarDepan;

  const listGelarBelakang =
    references.GelarBelakang && references.GelarBelakang.length > 0
      ? references.GelarBelakang
      : DEFAULT_REFERENCES.GelarBelakang;

  const listJabatan =
    references.Jabatan && references.Jabatan.length > 0
      ? references.Jabatan
      : DEFAULT_REFERENCES.Jabatan;

  const optionsGelarDepan: NeuDropdownOption[] = listGelarDepan.map(g => ({
    value: g.code ?? '',
    label: g.name,
  }));

  const optionsGelarBelakang: NeuDropdownOption[] = listGelarBelakang.map(g => ({
    value: g.code ?? '',
    label: g.name,
  }));

  const optionsJabatan: NeuDropdownOption[] = listJabatan.map(j => ({
    value: j.id || j.code || j.name,
    label: toProperCase(j.name),
  }));

  const handleNipInput = (val: string) => {
    const cleanDigits = val.replace(/[^0-9]/g, '').slice(0, 18);
    setRegNip(cleanDigits);

    // Auto-sync password with NIP if not yet manually modified
    if (!regPassword || regPassword === regNip) {
      setRegPassword(cleanDigits);
    }

    if (errors['regNip']) {
      setErrors(prev => {
        const next = { ...prev };
        delete next['regNip'];
        return next;
      });
    }
  };

  const isNip18 = regNip.length === 18;
  const isLoginNip18 = loginUsername.replace(/[^0-9]/g, '').length === 18;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!loginUsername.trim()) newErrors.loginUsername = 'Username atau NIP wajib diisi!';
    if (!loginPassword) newErrors.loginPassword = 'Password wajib diisi!';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      showToast(newErrors.loginUsername || newErrors.loginPassword, 'warning');
      return;
    }

    setLoading(true);
    try {
      const res = await callGasApi('loginUser', [loginUsername.trim(), loginPassword]);
      if (res && res.success) {
        if (rememberMe) {
          localStorage.setItem('remembered_username', loginUsername.trim());
          localStorage.setItem('ajar_remember_login', 'true');
        }
        onLoginSuccess(res.user, res.token);
      } else {
        const msg = res?.message || 'Username/NIP atau Password salah!';
        showToast(msg, 'error');
        setErrors({ loginPassword: msg });
      }
    } catch {
      showToast('Gagal menghubungi server.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNama = toProperCase(regNama.trim());
    setRegNama(cleanNama);

    const newErrors: Record<string, string> = {};
    if (!cleanNama) newErrors.regNama = 'Nama lengkap wajib diisi!';
    if (!regNip.trim() || regNip.length !== 18)
      newErrors.regNip = 'NIP wajib 18 digit angka!';
    if (!regPassword || regPassword.length < 6)
      newErrors.regPassword = 'Password minimal 6 karakter!';
    if (!termsAgreed) newErrors.terms = 'Anda harus menyetujui kebijakan madrasah!';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      showToast(newErrors.regNama || newErrors.regNip || newErrors.regPassword, 'warning');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        gelarDepan: regGelarDepan.trim(),
        namaLengkap: cleanNama,
        gelarBelakang: regGelarBelakang.trim(),
        nip: regNip.trim(),
        jabatanId: regJabatan || 'Guru Mata Pelajaran',
        password: regPassword,
        confirmPassword: regPassword,
      };

      const res = await callGasApi('registerGuru', [payload]);
      if (res && res.success) {
        showToast(res.message || 'Pendaftaran berhasil! Silakan login.', 'success');
        setLoginUsername(regNip.trim());
        setLoginPassword(regPassword);
        setIsRegister(false);
      } else {
        showToast(res?.message || 'Gagal melakukan pendaftaran.', 'error');
      }
    } catch {
      showToast('Gagal melakukan pendaftaran.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 h-full h-[100dvh] w-full overflow-hidden bg-[#EBF0F8] flex items-center justify-center p-0 sm:p-6 lg:p-8 text-slate-800 antialiased selection:bg-blue-200">
      {/* Background Ambient Lighting & 3D Glowing Glass Spheres */}
      <div
        aria-hidden="true"
        className="fixed -top-16 -left-20 w-80 h-80 rounded-full bg-gradient-to-br from-blue-300/40 via-sky-200/20 to-transparent blur-3xl pointer-events-none"
      />
      <div
        aria-hidden="true"
        className="fixed -top-10 -left-12 w-48 h-48 rounded-full soft-ring pointer-events-none"
      />
      <div
        aria-hidden="true"
        className="fixed top-24 -right-16 w-80 h-80 rounded-full bg-gradient-to-l from-blue-200/50 to-transparent blur-3xl pointer-events-none"
      />
      <div
        aria-hidden="true"
        className="fixed top-32 -right-8 w-32 h-32 rounded-full soft-ring pointer-events-none opacity-85"
      />
      <div
        aria-hidden="true"
        className="fixed top-6 right-8 w-10 h-10 rounded-full soft-ring opacity-60 pointer-events-none"
      />
      <div
        aria-hidden="true"
        className="fixed -bottom-20 -right-10 w-96 h-96 rounded-full bg-gradient-to-t from-blue-200/40 via-indigo-100/30 to-transparent blur-3xl pointer-events-none"
      />

      {/* Main Container: Fullscreen on mobile (0 margins, 100dvh), centered elevated card on desktop */}
      <main className="relative z-10 w-full h-full h-[100dvh] sm:h-auto sm:max-h-[92vh] sm:max-w-[450px] md:max-w-[480px] bg-[#EAF0F9] overflow-y-auto no-scrollbar overscroll-none flex flex-col justify-between px-6 py-6 sm:px-9 sm:py-8 neu-raised-card sm:rounded-[42px] transition-all">
        {/* Decorative Ambient Rings inside Card */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 -left-16 w-56 h-56 rounded-full border-[18px] border-white/50 blur-[1px] opacity-70"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-12 -right-20 w-64 h-64 rounded-full border-[22px] border-white/60 blur-[1px] opacity-70"
        />

        {/* Content Section */}
        <div className="relative z-10 w-full flex flex-col items-center my-auto">
          {/* 3D Neumorphic Logo Squircle Pedestal */}
          <section className="flex flex-col items-center mb-5 shrink-0">
            <div className="neu-logo-tile w-24 h-24 sm:w-28 sm:h-28 rounded-[30px] sm:rounded-[36px] flex items-center justify-center p-2.5 relative group transition-transform duration-300 hover:scale-[1.02]">
              <AjarBrandLogo idPrefix="auth" className="w-14 h-14 sm:w-16 sm:h-16" />
            </div>
          </section>

          {/* Header Title & Subtitle */}
          <section className="text-center mb-5 shrink-0 flex flex-col items-center">
            <h1 className="text-[26px] sm:text-[30px] font-extrabold tracking-tight text-[#0D162B]">
              {isRegister ? 'Daftar Akun' : 'Welcome Back'}
            </h1>
            <p className="text-slate-500 font-medium text-[12px] sm:text-[13px] tracking-wide mt-0.5">
              {isRegister
                ? 'Lengkapi data diri tenaga pendidik untuk mendaftar'
                : 'Sign in to continue'}
            </p>
          </section>

          {/* ==================== LOGIN VIEW ==================== */}
          {!isRegister ? (
            <form onSubmit={handleLoginSubmit} className="w-full space-y-4">
              {/* NIP / Username Input */}
              <div className="neu-input-pill h-[52px] sm:h-[54px] rounded-2xl flex items-center px-4 space-x-3.5 relative">
                <UserIcon className="w-5 h-5 text-slate-500 shrink-0" />
                <input
                  type="text"
                  autoComplete="username"
                  value={loginUsername}
                  onFocus={() => warmUpGasConnection()}
                  onChange={e => {
                    setLoginUsername(e.target.value);
                    if (errors.loginUsername) setErrors(prev => ({ ...prev, loginUsername: '' }));
                  }}
                  placeholder="Masukkan NIP"
                  disabled={loading}
                  className="w-full bg-transparent border-none p-0 text-slate-800 placeholder-slate-400 text-[14px] font-medium focus:ring-0 focus:outline-none"
                />
                {isLoginNip18 && (
                  <span className="nip-valid-pop flex items-center gap-1 text-[11px] font-extrabold text-emerald-600 bg-emerald-100/80 px-2 py-0.5 rounded-full shrink-0">
                    <Check className="w-3 h-3 stroke-[3]" />
                    <span>NIP</span>
                  </span>
                )}
              </div>
              {errors.loginUsername && (
                <p className="text-[11px] text-rose-500 font-bold px-2 -mt-2">
                  {errors.loginUsername}
                </p>
              )}

              {/* Password Input */}
              <div className="neu-input-pill h-[52px] sm:h-[54px] rounded-2xl flex items-center px-4 space-x-3.5 relative">
                <Lock className="w-5 h-5 text-slate-500 shrink-0" />
                <input
                  type={showLoginPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={loginPassword}
                  onFocus={() => warmUpGasConnection()}
                  onChange={e => {
                    setLoginPassword(e.target.value);
                    if (errors.loginPassword) setErrors(prev => ({ ...prev, loginPassword: '' }));
                  }}
                  placeholder="Masukkan Password"
                  disabled={loading}
                  className="w-full bg-transparent border-none p-0 text-slate-800 placeholder-slate-400 text-[14px] font-medium focus:ring-0 focus:outline-none tracking-normal pr-7"
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  aria-label="Toggle password visibility"
                  disabled={loading}
                  className="text-slate-400 hover:text-slate-600 focus:outline-none p-1 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {showLoginPassword ? (
                    <Eye className="w-5 h-5" />
                  ) : (
                    <EyeOff className="w-5 h-5" />
                  )}
                </button>
              </div>
              {errors.loginPassword && (
                <p className="text-[11px] text-rose-500 font-bold px-2 -mt-2">
                  {errors.loginPassword}
                </p>
              )}

              {/* Remember Me Option */}
              <div className="flex items-center justify-between pt-0.5 px-1 text-[13px]">
                <label className="inline-flex items-center space-x-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    disabled={loading}
                    onChange={e => setRememberMe(e.target.checked)}
                    className="w-[19px] h-[19px] rounded-md border-0 text-[#2167F3] bg-[#2167F3] focus:ring-0 focus:ring-offset-0 focus:outline-none shadow-[0_2px_8px_rgba(33,103,243,0.38)] cursor-pointer disabled:opacity-60"
                  />
                  <span className="text-slate-600 font-semibold text-[13px]">Remember Me</span>
                </label>
              </div>

              {/* Primary CTA Login Button with Right Arrow Badge */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="neu-btn-primary w-full h-[52px] sm:h-[54px] rounded-2xl flex items-center justify-between px-5 text-white cursor-pointer group disabled:opacity-75 transition-all"
                >
                  <div className="w-8 flex items-center justify-center">
                    {loading && (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    )}
                  </div>
                  <span className="text-[16px] sm:text-[17px] font-bold tracking-wide">
                    {loading ? 'Memproses...' : 'Login'}
                  </span>
                  <div className="arrow-badge w-8 h-8 rounded-full flex items-center justify-center transition-transform group-hover:translate-x-0.5">
                    <ArrowRight className="w-4 h-4 text-white" />
                  </div>
                </button>
              </div>
            </form>
          ) : (
            /* ==================== SIGN UP VIEW ==================== */
            <form onSubmit={handleRegisterSubmit} className="w-full space-y-3">
              {/* 1. Name Segment with Gelar Depan & Gelar Belakang Grid (NOW NEUMORPHIC DROPDOWNS) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-600 px-1">
                  Nama Lengkap &amp; Gelar
                </label>
                <div className="grid grid-cols-12 gap-2">
                  {/* Gelar Depan Dropdown */}
                  <div className="col-span-5">
                    <NeuDropdown
                      value={regGelarDepan}
                      onChange={setRegGelarDepan}
                      options={optionsGelarDepan}
                      placeholder="Gelar Dpn"
                    />
                  </div>

                  {/* Gelar Belakang Dropdown */}
                  <div className="col-span-7">
                    <NeuDropdown
                      value={regGelarBelakang}
                      onChange={setRegGelarBelakang}
                      options={optionsGelarBelakang}
                      placeholder="Gelar Blkg"
                    />
                  </div>

                  {/* Nama Lengkap Inti */}
                  <div className="col-span-12 neu-input-container rounded-2xl flex items-center px-3.5 py-2.5 sm:py-3 gap-2.5">
                    <UserIcon className="w-5 h-5 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      required
                      value={regNama}
                      onChange={e => {
                        const formatted = formatProperCaseLive(e.target.value);
                        setRegNama(formatted);
                        if (errors.regNama) setErrors(prev => ({ ...prev, regNama: '' }));
                      }}
                      onBlur={() => {
                        setRegNama(prev => toProperCase(prev.trim()));
                      }}
                      placeholder="Masukkan Nama Lengkap"
                      className="w-full bg-transparent border-0 p-0 text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:ring-0 focus:outline-none"
                    />
                  </div>
                </div>
                {errors.regNama && (
                  <p className="text-[10px] text-rose-500 font-bold px-1">{errors.regNama}</p>
                )}
              </div>

              {/* 2. Jabatan Madrasah Neumorphic Dropdown */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-600 px-1">
                  Jabatan Madrasah
                </label>
                <NeuDropdown
                  value={regJabatan}
                  onChange={setRegJabatan}
                  options={optionsJabatan}
                  placeholder="Pilih Jabatan"
                  icon={<Briefcase className="w-4 h-4 text-slate-400" />}
                />
              </div>

              {/* 3. NIP Field (18 Digits) with Interactive Live Validation Animation */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <label className="block text-xs font-semibold text-slate-600">
                    NIP (Nomor Induk Pegawai)
                  </label>
                  {/* Live Animated 18-digit validation badge */}
                  <div className="flex items-center">
                    {isNip18 ? (
                      <span className="nip-valid-pop flex items-center gap-1 text-[11px] font-extrabold text-emerald-600 bg-emerald-100/90 px-2 py-0.5 rounded-full shadow-xs border border-emerald-300">
                        <Check className="w-3 h-3 stroke-[3]" />
                        <span>18 Digit Lengkap</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-slate-400 transition-colors">
                        {regNip.length}/18 digit
                      </span>
                    )}
                  </div>
                </div>
                <div
                  className={`neu-input-container rounded-2xl flex items-center px-3.5 py-2.5 sm:py-3 gap-2.5 transition-all ${
                    isNip18 ? 'ring-2 ring-emerald-400/40 border-emerald-300/80' : ''
                  }`}
                >
                  <CreditCard
                    className={`w-5 h-5 shrink-0 transition-colors ${
                      isNip18 ? 'text-emerald-500' : 'text-slate-400'
                    }`}
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={18}
                    required
                    value={regNip}
                    onChange={e => handleNipInput(e.target.value)}
                    placeholder="Masukkan NIP (18 digit)"
                    className="w-full bg-transparent border-0 p-0 text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:ring-0 focus:outline-none tracking-wide"
                  />
                  {isNip18 && (
                    <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-xs nip-valid-pop">
                      <Check className="w-3 h-3 stroke-[3]" />
                    </div>
                  )}
                </div>
                {errors.regNip && (
                  <p className="text-[10px] text-rose-500 font-bold px-1">{errors.regNip}</p>
                )}
              </div>

              {/* 4. Password Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <label className="block text-xs font-semibold text-slate-600">
                    Buat Password
                  </label>
                  <span className="text-[10px] text-blue-600 font-semibold">
                    (Default NIP)
                  </span>
                </div>
                <div className="neu-input-container rounded-2xl flex items-center px-3.5 py-2.5 sm:py-3 gap-2.5 relative">
                  <Lock className="w-5 h-5 text-slate-400 shrink-0" />
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    value={regPassword}
                    onChange={e => setRegPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="w-full bg-transparent border-0 p-0 text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:ring-0 focus:outline-none pr-7"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    aria-label="Toggle password visibility"
                    className="absolute right-3 text-slate-400 hover:text-slate-600 focus:outline-none p-1 cursor-pointer"
                  >
                    {showRegPassword ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {errors.regPassword && (
                  <p className="text-[10px] text-rose-500 font-bold px-1">{errors.regPassword}</p>
                )}
              </div>

              {/* Terms Agreement Checkbox */}
              <div className="flex items-start pt-0.5">
                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium text-slate-600 select-none">
                  <input
                    type="checkbox"
                    checked={termsAgreed}
                    disabled={loading}
                    onChange={e => setTermsAgreed(e.target.checked)}
                    className="w-4 h-4 rounded neu-checkbox text-blue-600 focus:ring-blue-400 focus:ring-offset-0 cursor-pointer disabled:opacity-60"
                  />
                  <span>Saya menyetujui syarat &amp; kebijakan madrasah</span>
                </label>
              </div>

              {/* Primary CTA Register Button */}
              <div className="pt-1.5">
                <button
                  type="submit"
                  disabled={loading}
                  className="neu-btn-primary w-full h-[52px] sm:h-[54px] rounded-2xl flex items-center justify-between px-5 text-white cursor-pointer group disabled:opacity-75 transition-all"
                >
                  <div className="w-8 flex items-center justify-center">
                    {loading && (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    )}
                  </div>
                  <span className="text-[16px] sm:text-[17px] font-bold tracking-wide">
                    {loading ? 'Mendaftarkan...' : 'Daftar Sekarang'}
                  </span>
                  <div className="arrow-badge w-8 h-8 rounded-full flex items-center justify-center transition-transform group-hover:translate-x-0.5">
                    <ArrowRight className="w-4 h-4 text-white" />
                  </div>
                </button>
              </div>
            </form>
          )}

          {/* Switcher Navigation Link */}
          <footer className="w-full mt-5 pt-1 text-center shrink-0">
            {!isRegister ? (
              <p className="text-center text-xs text-slate-500 font-medium">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(true);
                    setErrors({});
                  }}
                  className="text-[#226BF5] font-bold hover:underline ml-0.5 cursor-pointer inline-block"
                >
                  Sign Up
                </button>
              </p>
            ) : (
              <p className="text-center text-xs text-slate-500 font-medium">
                Sudah punya akun?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setIsRegister(false);
                    setErrors({});
                  }}
                  className="text-blue-600 font-bold hover:text-blue-700 hover:underline transition-colors ml-0.5 cursor-pointer inline-block"
                >
                  Kembali ke Login
                </button>
              </p>
            )}
          </footer>
        </div>

        {/* Bottom Version Watermark */}
        <footer className="w-full text-center pt-3 pb-1 relative z-10 shrink-0">
          <p className="text-[11px] tracking-wider text-slate-400 font-medium uppercase">
            Ajar MAN 1 Majalengka v.2
          </p>
        </footer>
      </main>
    </div>
  );
};
