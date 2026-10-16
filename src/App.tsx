import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PageId, User, DashboardData, MasterAjarData, ReferencesMap, PengajaranItem } from './types';
import {
  callGasApi,
  DEFAULT_REFERENCES,
  getCachedReferences,
  saveCachedReferences,
  checkGasConnection,
  GasConnectionInfo,
} from './services/gasApi';
import { RefreshCw } from 'lucide-react';
import { AuthPage } from './components/AuthPage';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { BottomNav } from './components/BottomNav';
import { Dashboard } from './components/Dashboard';
import { MasterAjar } from './components/MasterAjar';
import { MasterSiswa } from './components/MasterSiswa';
import { Absensi } from './components/Absensi';
import { Nilai } from './components/Nilai';
import { LkhWizard } from './components/LkhWizard';
import { Laporan } from './components/Laporan';
import { Profil } from './components/Profil';
import { Toast, ToastMessage } from './components/Toast';
import { AjarBrandLogo } from './components/AjarBrandLogo';
import { PWAInstallModal } from './components/PWAInstallModal';

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState<string>(() => localStorage.getItem('ajar_token') || '');
  const [activePage, setActivePage] = useState<PageId>('dashboard');
  // Memuat data referensi secara instan dari cache lokal (SWR)
  const [references, setReferences] = useState<ReferencesMap>(() => getCachedReferences());

  // Splash & Sistem Handshake State
  const [loadingSplash, setLoadingSplash] = useState(true);
  const [splashPhase, setSplashPhase] = useState<'checking' | 'syncing' | 'connected' | 'error'>('checking');
  const [splashStatusText, setSplashStatusText] = useState('Menghubungkan ke Google Apps Script...');
  const [splashDetailText, setSplashDetailText] = useState('Memverifikasi secret GAS_URL & status spreadsheet madrasah');
  const [splashProgress, setSplashProgress] = useState(25);
  const [gasConnection, setGasConnection] = useState<GasConnectionInfo | null>(null);
  const [syncSummary, setSyncSummary] = useState<{ totalKelas: number; totalMapel: number } | null>(null);

  const [dashboardData, setDashboardData] = useState<DashboardData>({
    tahunAjaran: '2026/2027',
    totalKelas: 0,
    totalMapel: 0,
    totalSiswa: 0,
  });

  const [masterAjarData, setMasterAjarData] = useState<MasterAjarData>({
    success: true,
    waliKelas: 'Bukan Wali Kelas',
    mapelUtamaId: '',
    mapelUtama: null,
    mapelTambahan: [],
    pengajaran: [],
    tahunAjaran: '2026/2027',
    listKelas: getCachedReferences().Kelas,
    listMapel: getCachedReferences().MataPelajaran,
  });

  const [pengajaranList, setPengajaranList] = useState<PengajaranItem[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      dismissToast(id);
    }, 3200);
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Inisialisasi sistem: Verifikasi nyata koneksi Google Apps Script & sinkronisasi Spreadsheet
  const runSystemInitialization = useCallback(async () => {
    setLoadingSplash(true);
    setSplashPhase('checking');
    setSplashProgress(25);
    setSplashStatusText('Memeriksa koneksi sistem...');
    setSplashDetailText('Menghubungi runtime Google Apps Script via proxy server');

    try {
      // 1. Verifikasi koneksi nyata ke Google Apps Script dan secret GAS_URL
      const conn = await checkGasConnection(14000);
      setGasConnection(conn);

      if (!conn.connected) {
        setSplashPhase('error');
        setSplashStatusText('Gagal Terhubung ke Google Apps Script');
        setSplashDetailText(conn.message || 'Endpoint GAS tidak merespon dalam batas waktu');
        setSplashProgress(45);
        return;
      }

      // 2. Terhubung! Sinkronisasi data referensi langsung dari Spreadsheet GAS
      setSplashPhase('syncing');
      setSplashProgress(68);
      setSplashStatusText('Sinkronisasi data Spreadsheet...');
      setSplashDetailText(
        `Terhubung via ${conn.source} (${conn.latencyMs ? conn.latencyMs + 'ms' : 'aktif'}) — Mengunduh rombel kelas & mapel madrasah`
      );

      const refRes = await callGasApi<any>('getReferencesData', [], 20000);

      if (refRes && refRes.references) {
        const refs = refRes.references;
        saveCachedReferences(refs);
        setReferences(prev => ({ ...prev, ...refs }));

        const kelasList = refs.Kelas || [];
        const mapelList = refs.MataPelajaran || refs.Mapel || [];

        setMasterAjarData(prev => ({
          ...prev,
          listKelas: kelasList.length > 0 ? kelasList : prev.listKelas,
          listMapel: mapelList.length > 0 ? mapelList : prev.listMapel,
        }));

        setSyncSummary({
          totalKelas: kelasList.length,
          totalMapel: mapelList.length,
        });

        // 3. Status Terhubung Sukses
        setSplashPhase('connected');
        setSplashProgress(100);
        setSplashStatusText('Sistem Terhubung ke GAS (Spreadsheet Aktif)');
        setSplashDetailText(
          `Berhasil memuat ${kelasList.length} Rombel Kelas & ${mapelList.length} Mata Pelajaran`
        );

        // Tahan tampilan status sukses sejenak (800ms) agar pengguna memiliki konfirmasi visual nyata
        setTimeout(() => {
          setLoadingSplash(false);
        }, 800);
      } else {
        // GAS merespon tetapi data referensi tidak lengkap -> fallback ke cache
        setSplashPhase('connected');
        setSplashProgress(100);
        setSplashStatusText('Sistem Terhubung');
        setSplashDetailText(`Koneksi aktif via ${conn.source}`);
        setTimeout(() => {
          setLoadingSplash(false);
        }, 700);
      }
    } catch (err: any) {
      console.warn('[App] Error inisialisasi GAS:', err);
      setSplashPhase('error');
      setSplashStatusText('Koneksi ke GAS Terkendala');
      setSplashDetailText(err?.message || 'Waktu koneksi habis saat menghubungi server');
      setSplashProgress(45);
    }
  }, []);

  useEffect(() => {
    runSystemInitialization();
  }, [runSystemInitialization]);

  // When user is authenticated, load dashboard and master ajar
  useEffect(() => {
    if (currentUser && token) {
      loadDashboard();
      loadMasterAjar();
    }
  }, [currentUser, token]);

  const loadDashboard = async () => {
    try {
      const res = await callGasApi('getDashboardData', [token]);
      if (res) {
        setDashboardData({
          tahunAjaran: res.tahunAjaran || '2026/2027',
          totalKelas: res.totalKelas || 0,
          totalMapel: res.totalMapel || 0,
          totalSiswa: res.totalSiswa || 0,
        });
      }
    } catch {}
  };

  const loadMasterAjar = async () => {
    try {
      const res = await callGasApi('getMasterAjarData', [token]);
      if (res && res.success) {
        const cached = getCachedReferences();
        const merged: MasterAjarData = {
          ...res,
          listKelas: res.listKelas && res.listKelas.length > 0 ? res.listKelas : cached.Kelas,
          listMapel: res.listMapel && res.listMapel.length > 0 ? res.listMapel : cached.MataPelajaran,
        };
        setMasterAjarData(merged);
        setPengajaranList(merged.pengajaran || []);
      }
    } catch {}
  };

  // Deteksi apakah konfigurasi Master Ajar telah diselesaikan oleh guru
  const isMasterAjarComplete = useMemo(() => {
    if (!currentUser) return true;
    if (!masterAjarData || !masterAjarData.success) return true;

    const currentTa = masterAjarData.tahunAjaran || '2026/2027';
    const isTaFlagged =
      localStorage.getItem(`master_ajar_configured_${currentUser.userId}_${currentTa}`) === 'true';

    // Memiliki mapel utama dan minimal 1 kelas
    const hasMapelUtama = Boolean(
      (masterAjarData.mapelUtamaId || masterAjarData.mapelUtama?.mapelId) &&
      (masterAjarData.mapelUtama?.kelases?.length || 0) > 0
    );

    // Memiliki penugasan wali kelas
    const hasWaliKelas = Boolean(
      masterAjarData.waliKelas && masterAjarData.waliKelas.trim().length > 0
    );

    if (hasMapelUtama && hasWaliKelas) {
      return true;
    }

    return isTaFlagged;
  }, [currentUser, masterAjarData]);

  // Arahkan langsung ke Master Ajar jika guru belum melengkapi konfigurasi
  useEffect(() => {
    if (currentUser && masterAjarData && masterAjarData.success) {
      if (!isMasterAjarComplete && activePage !== 'master-ajar') {
        setActivePage('master-ajar');
        showToast(
          'Mohon lengkapi konfigurasi Master Ajar terlebih dahulu untuk mengaktifkan seluruh menu aplikasi.',
          'warning'
        );
      }
    }
  }, [currentUser, masterAjarData, isMasterAjarComplete, activePage]);

  const handleNavigate = (page: PageId) => {
    if (!isMasterAjarComplete && page !== 'master-ajar') {
      showToast(
        'Lengkapi konfigurasi Master Ajar (Mapel Utama, Tambahan, & Wali Kelas) terlebih dahulu!',
        'warning'
      );
      return;
    }
    setActivePage(page);
  };

  const handleLoginSuccess = (user: User, userToken: string) => {
    setCurrentUser(user);
    setToken(userToken);
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('ajar_token', userToken);
    setActivePage('dashboard');
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setToken('');
    localStorage.removeItem('user');
    localStorage.removeItem('ajar_token');
    localStorage.removeItem('ajar_remember_login');
    showToast('Berhasil keluar.', 'info');
  };

  return (
    <div className="h-full w-full flex flex-col md:flex-row relative overflow-hidden bg-gradient-to-br from-[#001f26] via-[#003844] to-[#005f73]">
      <Toast toasts={toasts} onDismiss={dismissToast} />
      <PWAInstallModal />

      {/* Splash Screen - Diperingkas: Logo Terpusat + Tulisan Connecting... Bertema Neumorphism / Soft UI Modern */}
      {loadingSplash && (
        <div className="fixed inset-0 z-[9999] bg-[#EBF0F8] flex flex-col items-center justify-center p-4 transition-opacity duration-300 select-none">
          {/* Subtle Ambient Soft Rings */}
          <div
            aria-hidden="true"
            className="fixed -top-16 -left-20 w-80 h-80 rounded-full bg-gradient-to-br from-blue-300/30 via-sky-200/20 to-transparent blur-3xl pointer-events-none"
          />
          <div
            aria-hidden="true"
            className="fixed top-24 -right-16 w-80 h-80 rounded-full bg-gradient-to-l from-blue-200/40 to-transparent blur-3xl pointer-events-none"
          />

          <div className="relative z-10 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95 duration-200">
            {/* 3D Neumorphic Logo Squircle persis seperti yang ada di halaman login */}
            <div className="neu-logo-tile w-24 h-24 sm:w-28 sm:h-28 rounded-[30px] sm:rounded-[36px] flex items-center justify-center p-2.5 relative shadow-lg">
              <AjarBrandLogo idPrefix="splash" className="w-14 h-14 sm:w-16 sm:h-16" />
            </div>

            {/* Tulisan Connecting... dengan Soft UI Modern */}
            <div className="mt-6 flex flex-col items-center">
              <div className="neu-input-pill px-5 py-2.5 rounded-full flex items-center gap-2.5">
                <span className="relative flex items-center justify-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2167F3] animate-ping absolute opacity-75" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#2167F3]" />
                </span>
                <span className="text-xs sm:text-sm font-extrabold tracking-wider text-slate-700">
                  Connecting...
                </span>
              </div>

              {/* Opsi jika terjadi kendala timeout/offline */}
              {splashPhase === 'error' && (
                <div className="mt-4 flex flex-col items-center gap-2 animate-in fade-in duration-200">
                  <p className="text-[11px] font-semibold text-rose-600 max-w-xs text-center">
                    {splashDetailText || 'Koneksi ke sistem tertunda'}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <button
                      type="button"
                      onClick={runSystemInitialization}
                      className="py-2 px-3.5 rounded-xl neu-btn-primary text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95 transition-transform"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Coba Lagi
                    </button>
                    <button
                      type="button"
                      onClick={() => setLoadingSplash(false)}
                      className="py-2 px-3.5 rounded-xl neu-flat active:neu-pressed text-slate-700 font-bold text-xs cursor-pointer active:scale-95 transition-transform"
                    >
                      Lanjutkan
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Authentication View (if not logged in) */}
      {!currentUser ? (
        <AuthPage
          references={references}
          onLoginSuccess={handleLoginSuccess}
          showToast={showToast}
          gasConnection={gasConnection}
        />
      ) : (
        /* Logged In Application Shell */
        <>
          {/* Desktop Sidebar */}
          <Sidebar
            activePage={activePage}
            onNavigate={handleNavigate}
            currentUser={currentUser}
            onLogout={handleLogout}
            isMasterAjarLocked={!isMasterAjarComplete}
          />

          {/* Main Content Area */}
          <div
            className={`flex-1 flex flex-col h-full overflow-hidden relative ${
              activePage === 'dashboard' || activePage === 'master-ajar' ? 'bg-[#EBF0F8]' : ''
            }`}
          >
            <Topbar
              activePage={activePage}
              onNavigate={handleNavigate}
              onLogout={handleLogout}
              gasConnection={gasConnection}
            />

            <main
              className={
                activePage === 'dashboard'
                  ? 'flex-1 h-full min-h-0 overflow-hidden p-3 sm:p-4 max-w-xl w-full mx-auto flex flex-col'
                  : activePage === 'master-ajar'
                  ? 'flex-1 h-full min-h-0 overflow-hidden p-2.5 sm:p-4 max-w-5xl w-full mx-auto flex flex-col'
                  : 'flex-1 overflow-y-auto overscroll-contain touch-scroll p-3.5 sm:p-5 max-w-4xl w-full mx-auto'
              }
            >
              {activePage === 'dashboard' && (
                <Dashboard
                  currentUser={currentUser}
                  data={dashboardData}
                  onNavigate={handleNavigate}
                />
              )}

              {activePage === 'master-ajar' && (
                <MasterAjar
                  data={masterAjarData}
                  token={token}
                  onRefresh={loadMasterAjar}
                  showToast={showToast}
                  currentUser={currentUser}
                />
              )}

              {activePage === 'master-siswa' && (
                <MasterSiswa
                  token={token}
                  listKelas={masterAjarData.listKelas || references.Kelas}
                  showToast={showToast}
                />
              )}

              {activePage === 'absensi' && (
                <Absensi
                  token={token}
                  pengajaranList={pengajaranList}
                  showToast={showToast}
                />
              )}

              {activePage === 'nilai' && (
                <Nilai
                  token={token}
                  pengajaranList={pengajaranList}
                  showToast={showToast}
                />
              )}

              {activePage === 'lkh' && (
                <LkhWizard
                  token={token}
                  currentUser={currentUser}
                  pengajaranList={pengajaranList}
                  showToast={showToast}
                />
              )}

              {activePage === 'laporan' && (
                <Laporan
                  token={token}
                  currentUser={currentUser}
                  pengajaranList={pengajaranList}
                  showToast={showToast}
                />
              )}

              {activePage === 'profil' && (
                <Profil
                  token={token}
                  currentUser={currentUser}
                  references={references}
                  onUpdateUser={updated => {
                    setCurrentUser(updated);
                    localStorage.setItem('user', JSON.stringify(updated));
                  }}
                  showToast={showToast}
                  onNavigate={handleNavigate}
                  onBack={() => handleNavigate('dashboard')}
                />
              )}
            </main>

            {/* Mobile Bottom Navigation (Hidden on Dashboard & Profil) */}
            {activePage !== 'dashboard' && activePage !== 'profil' && (
              <BottomNav
                activePage={activePage}
                onNavigate={handleNavigate}
                isMasterAjarLocked={!isMasterAjarComplete}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
