import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  GraduationCap,
  Plus,
  Edit2,
  Download,
  X,
  Check,
  Trash2,
  FileText,
  FileSpreadsheet,
  AlertCircle,
  RefreshCw,
  Search,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SiswaItem, RefItem, PengajaranItem } from '../types';
import { callGasApi } from '../services/gasApi';
import { toProperCase, formatProperCaseLive } from '../utils/textUtils';

interface MasterSiswaProps {
  token: string;
  listKelas: RefItem[];
  pengajaranList?: PengajaranItem[];
  listMapel?: RefItem[];
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

// Helper pengurutan alami (misal X.1, X.2, ... X.9, X.10)
const naturalCompare = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

// Helper standarisasi dan normalisasi objek Siswa dari format spreadsheet / API
const normalizeSiswa = (s: any, fallbackClass: string): SiswaItem => {
  const sId = String(s.SiswaID || s.siswaId || s.id || `s-${Math.random().toString(36).substring(2, 9)}`).trim();
  const rawNis = String(s.nis || s.NIS || s.nisn || s.Nis || '').trim();
  const rawNisn = String(s.nisn || s.NISN || s.NIS || s.nis || '').trim();
  let rawNama = String(
    s.NamaSiswa || s.namaSiswa || s.nama || s.Nama || s['Nama Siswa'] || s['Nama Lengkap'] || ''
  ).trim();

  // Deteksi kemungkinan gender dari berbagai variasi nama kolom spreadsheet
  let foundJk = '';
  const potentialJkValues = [
    s.JenisKelamin,
    s.jenisKelamin,
    s.JK,
    s.jk,
    s['Jenis Kelamin'],
    s['jenis kelamin'],
    s['L/P'],
    s['l/p'],
    s['LP'],
    s['lp'],
    s.Gender,
    s.gender,
    s.Kelamin,
    s.kelamin,
    s.Sex,
    s.sex,
  ];

  for (const val of potentialJkValues) {
    if (val !== undefined && val !== null && String(val).trim() !== '') {
      foundJk = String(val).trim().toUpperCase();
      break;
    }
  }

  // Jika nama mengandung akhiran / imbuhan penanda gender seperti "(P)", "(L)", "- P", "- L", "/ P", "/ L"
  const genderInNameMatch = rawNama.match(/\s*[\(\[\-\/]\s*([LPWlpw]|Perempuan|Laki-laki|Wanita|Pria)\s*[\)\]]?\s*$/i);
  if (genderInNameMatch) {
    if (!foundJk) {
      foundJk = genderInNameMatch[1].toUpperCase();
    }
    // Bersihkan nama dari penanda gender tersebut
    rawNama = rawNama.replace(/\s*[\(\[\-\/]\s*([LPWlpw]|Perempuan|Laki-laki|Wanita|Pria)\s*[\)\]]?\s*$/i, '').trim();
  }

  // Bersihkan juga jika ada penanda (P) atau (L) di dalam kurung di mana saja
  rawNama = rawNama.replace(/\s*[\(\[]\s*(P|L)\s*[\)\]]/gi, '').trim();

  // Evaluasi jenis kelamin L atau P secara akurat
  let jk: 'L' | 'P' = 'L';
  if (
    foundJk.startsWith('P') || // P, Perempuan
    foundJk.startsWith('W') || // W, Wanita
    foundJk === 'F' ||         // Female
    foundJk === 'FEMALE'
  ) {
    jk = 'P';
  } else {
    jk = 'L';
  }

  const namaClean = toProperCase(rawNama);
  const kelas = String(s.Kelas || s.kelas || s['Kelas'] || fallbackClass).trim();

  return {
    SiswaID: sId,
    siswaId: sId,
    NIS: rawNisn || rawNis,
    nis: rawNis || rawNisn,
    nisn: rawNisn || rawNis,
    NamaSiswa: namaClean,
    namaSiswa: namaClean,
    nama: namaClean,
    Kelas: kelas,
    kelas: kelas,
    JenisKelamin: jk,
    jenisKelamin: jk,
    jk: jk,
  };
};

export const MasterSiswa: React.FC<MasterSiswaProps> = ({
  token,
  listKelas,
  pengajaranList = [],
  listMapel = [],
  showToast,
}) => {
  // 1. Ekstraksi daftar kelas unik yang diajar guru sesuai Master Ajar
  const teacherClasses = useMemo(() => {
    const classSet = new Set<string>();
    pengajaranList.forEach(p => {
      const k = p.Kelas || p.kelas;
      if (k && k.trim()) classSet.add(k.trim());
    });

    if (classSet.size > 0) {
      return Array.from(classSet).sort(naturalCompare);
    }

    // Fallback ke listKelas jika pengajaran belum dikonfigurasi
    return listKelas
      .map(k => (k.code || k.id || k.name || '').trim())
      .filter(Boolean)
      .sort(naturalCompare);
  }, [pengajaranList, listKelas]);

  // Helper untuk menentukan tingkat rombel (X, XI, atau XII)
  const getClassLevel = useCallback((clsName: string): 'X' | 'XI' | 'XII' | null => {
    const u = clsName.trim().toUpperCase();
    if (u.startsWith('XII') || u.includes('XII')) return 'XII';
    if (u.startsWith('XI') || u.includes('XI')) return 'XI';
    if (u.startsWith('X') || u.includes('X')) return 'X';
    return null;
  }, []);

  // 2. Daftar tingkat yang benar-benar diajar guru (X / XI / XII)
  const availableLevels = useMemo(() => {
    const levelSet = new Set<'X' | 'XI' | 'XII'>();
    teacherClasses.forEach(c => {
      const lvl = getClassLevel(c);
      if (lvl) levelSet.add(lvl);
    });
    const order: ('X' | 'XI' | 'XII')[] = ['X', 'XI', 'XII'];
    return order.filter(lvl => levelSet.has(lvl));
  }, [teacherClasses, getClassLevel]);

  // State tingkat kelas aktif
  const [activeLevel, setActiveLevel] = useState<'X' | 'XI' | 'XII' | null>(() => {
    return availableLevels.length > 0 ? availableLevels[0] : 'XI';
  });

  useEffect(() => {
    if (availableLevels.length > 0 && (!activeLevel || !availableLevels.includes(activeLevel))) {
      setActiveLevel(availableLevels[0]);
    }
  }, [availableLevels, activeLevel]);

  // Filter kelas berdasarkan tingkat yang aktif
  const displayedClasses = useMemo(() => {
    if (!activeLevel) return teacherClasses;
    return teacherClasses.filter(c => getClassLevel(c) === activeLevel);
  }, [teacherClasses, activeLevel, getClassLevel]);

  // Helper mendapatkan nama mata pelajaran sesuai master ajar guru untuk kelas tertentu
  const getClassSubject = useCallback(
    (clsName: string): string => {
      const normalizedClass = clsName.trim().toUpperCase();
      const matched = pengajaranList.filter(
        p => (p.Kelas || p.kelas || '').trim().toUpperCase() === normalizedClass
      );

      if (matched.length > 0) {
        const names = matched
          .map(p => {
            if (p.mapelNama && p.mapelNama.trim()) return p.mapelNama.trim();
            const id = p.mapelId || p.MataPelajaranID;
            const foundInRef = listMapel.find(
              m => m.id === id || m.code === id || m.name === id
            );
            return foundInRef?.name || '';
          })
          .filter(Boolean);

        const uniqueNames = Array.from(new Set(names));
        if (uniqueNames.length > 0) {
          return uniqueNames.join(', ');
        }
      }

      // Fallback jika guru memiliki penugasan dengan mapel utama
      const utamaItem = pengajaranList.find(p => p.isUtama && p.mapelNama);
      if (utamaItem?.mapelNama) {
        return utamaItem.mapelNama;
      }

      return 'Mata Pelajaran';
    },
    [pengajaranList, listMapel]
  );

  // Cache lokal jumlah siswa per kelas
  const [classCounts, setClassCounts] = useState<Record<string, number>>({});
  const [loadingClass, setLoadingClass] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Ambil cache awal jumlah siswa dari localStorage
  useEffect(() => {
    const counts: Record<string, number> = {};
    teacherClasses.forEach(cls => {
      const cached = localStorage.getItem('ajar_siswa_' + cls);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            counts[cls] = parsed.length;
          }
        } catch {}
      }
    });
    setClassCounts(prev => ({ ...counts, ...prev }));
  }, [teacherClasses]);

  // 2. Pre-fetch asinkron data kelas yang belum ada jumlahnya di classCounts
  useEffect(() => {
    let isCancelled = false;
    if (!displayedClasses || displayedClasses.length === 0) return;

    const uncachedClasses = displayedClasses.filter(c => classCounts[c] === undefined);
    if (uncachedClasses.length === 0) return;

    const fetchUncached = async () => {
      await Promise.allSettled(
        uncachedClasses.map(async cls => {
          try {
            const res = await callGasApi('getMasterSiswa', [token, cls]);
            const raw = res?.data || res?.siswa || (Array.isArray(res) ? res : []);
            if (Array.isArray(raw) && !isCancelled) {
              const normalized = raw.map(s => normalizeSiswa(s, cls));
              localStorage.setItem('ajar_siswa_' + cls, JSON.stringify(normalized));
              setClassCounts(prev => ({ ...prev, [cls]: normalized.length }));
            }
          } catch {
            // Silently ignore background prefetch error
          }
        })
      );
    };

    fetchUncached();

    return () => {
      isCancelled = true;
    };
  }, [displayedClasses, token, classCounts]);

  // 3. Tombol Sinkronisasi Manual dari Spreadsheet
  const handleRefreshAll = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    showToast('Menyinkronkan data siswa dari spreadsheet...', 'info');

    try {
      await Promise.allSettled(
        displayedClasses.map(async cls => {
          try {
            const res = await callGasApi('getMasterSiswa', [token, cls]);
            const raw = res?.data || res?.siswa || (Array.isArray(res) ? res : []);
            if (Array.isArray(raw)) {
              const normalized = raw.map(s => normalizeSiswa(s, cls));
              localStorage.setItem('ajar_siswa_' + cls, JSON.stringify(normalized));
              setClassCounts(prev => ({ ...prev, [cls]: normalized.length }));
            }
          } catch {}
        })
      );
      showToast('Sinkronisasi selesai! Data siswa kelas terbarukan.', 'success');
    } catch {
      showToast('Gagal menyinkronkan data siswa.', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Modal States
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [siswaList, setSiswaList] = useState<SiswaItem[]>([]);
  const [showTableModal, setShowTableModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Add / Edit Single Siswa Modal
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingSiswa, setEditingSiswa] = useState<SiswaItem | null>(null);
  const [formNisn, setFormNisn] = useState('');
  const [formNama, setFormNama] = useState('');
  const [formJk, setFormJk] = useState<'L' | 'P'>('L');
  const [formSaving, setFormSaving] = useState(false);

  // Delete Confirmation State
  const [studentToDelete, setStudentToDelete] = useState<SiswaItem | null>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 4. Handler saat kartu kelas diklik
  const handleSelectClass = async (cls: string) => {
    setLoadingClass(cls);
    setSearchQuery('');
    try {
      // Buka instan jika sudah ada cache lokal siswa
      const cached = localStorage.getItem('ajar_siswa_' + cls);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const normalized = parsed.map(s => normalizeSiswa(s, cls));
            setSiswaList(normalized);
            setClassCounts(prev => ({ ...prev, [cls]: normalized.length }));
            setSelectedClass(cls);
            setIsEditMode(false);
            setShowTableModal(true);
            setLoadingClass(null);

            // Perbarui cache di background agar selalu sinkron dengan spreadsheet
            callGasApi('getMasterSiswa', [token, cls]).then(res => {
              const raw = res?.data || res?.siswa || (Array.isArray(res) ? res : []);
              if (Array.isArray(raw) && raw.length > 0) {
                const fresh = raw.map(s => normalizeSiswa(s, cls));
                localStorage.setItem('ajar_siswa_' + cls, JSON.stringify(fresh));
                setSiswaList(fresh);
                setClassCounts(prev => ({ ...prev, [cls]: fresh.length }));
              }
            }).catch(() => {});
            return;
          }
        } catch {}
      }

      // Ambil data dari server GAS
      const res = await callGasApi('getMasterSiswa', [token, cls]);
      const rawStudents = res?.data || res?.siswa || (Array.isArray(res) ? res : []);
      const students: SiswaItem[] = Array.isArray(rawStudents)
        ? rawStudents.map(s => normalizeSiswa(s, cls))
        : [];

      setSiswaList(students);
      setClassCounts(prev => ({ ...prev, [cls]: students.length }));
      setSelectedClass(cls);
      setIsEditMode(false);

      if (students.length > 0) {
        localStorage.setItem('ajar_siswa_' + cls, JSON.stringify(students));
        setShowTableModal(true);
      } else {
        // Tampilkan modal pilihan upload data hanya jika kelas benar-benar kosong di spreadsheet
        setShowUploadModal(true);
      }
    } catch {
      showToast('Gagal memuat data siswa kelas.', 'error');
    } finally {
      setLoadingClass(null);
    }
  };

  // 5. Long Press Detection untuk Hapus Siswa di Mode Edit
  const handleTouchStartRow = (s: SiswaItem) => {
    if (!isEditMode) return;
    handleCancelLongPress();
    longPressTimerRef.current = setTimeout(() => {
      setStudentToDelete(s);
    }, 450);
  };

  const handleMouseDownRow = (s: SiswaItem) => {
    if (!isEditMode) return;
    handleCancelLongPress();
    longPressTimerRef.current = setTimeout(() => {
      setStudentToDelete(s);
    }, 450);
  };

  const handleCancelLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // 6. Simpan Tambah / Edit Siswa
  const handleOpenAdd = () => {
    setEditingSiswa(null);
    setFormNisn('');
    setFormNama('');
    setFormJk('L');
    setFormModalOpen(true);
  };

  const handleOpenEdit = (s: SiswaItem) => {
    setEditingSiswa(s);
    setFormNisn(s.nisn || s.NIS || s.nis || '');
    setFormNama(s.NamaSiswa || s.namaSiswa || s.nama || '');
    setFormJk(s.JenisKelamin === 'P' || (s as any).jk === 'P' ? 'P' : 'L');
    setFormModalOpen(true);
  };

  const handleSaveSiswa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass) return;
    if (!formNama.trim()) {
      showToast('Nama siswa wajib diisi!', 'warning');
      return;
    }

    setFormSaving(true);
    try {
      const payload = {
        siswaId: editingSiswa?.SiswaID || editingSiswa?.siswaId || '',
        nis: formNisn.trim(),
        nama: toProperCase(formNama.trim()),
        kelas: selectedClass,
        jk: formJk,
      };

      const res = await callGasApi('saveSiswaManual', [token, payload]);
      if (res && res.success) {
        showToast('Data siswa berhasil disimpan!', 'success');
        setFormModalOpen(false);

        // Perbarui list lokal dari GAS
        const updatedRes = await callGasApi('getMasterSiswa', [token, selectedClass]);
        const raw = updatedRes?.data || updatedRes?.siswa || (Array.isArray(updatedRes) ? updatedRes : []);
        const updatedList = Array.isArray(raw) ? raw.map(s => normalizeSiswa(s, selectedClass)) : [];
        setSiswaList(updatedList);
        localStorage.setItem('ajar_siswa_' + selectedClass, JSON.stringify(updatedList));
        setClassCounts(prev => ({ ...prev, [selectedClass]: updatedList.length }));
      } else {
        showToast(res?.message || 'Gagal menyimpan siswa.', 'error');
      }
    } catch {
      showToast('Gagal menghubungi server.', 'error');
    } finally {
      setFormSaving(false);
    }
  };

  // 7. Eksekusi Hapus Siswa
  const handleConfirmDelete = async () => {
    if (!studentToDelete || !selectedClass) return;
    const sId = studentToDelete.SiswaID || studentToDelete.siswaId || '';

    try {
      const res = await callGasApi('deleteSiswa', [token, sId]);
      if (res && res.success) {
        showToast('Data siswa berhasil dihapus.', 'success');
        const nextList = siswaList.filter(s => (s.SiswaID || s.siswaId) !== sId);
        setSiswaList(nextList);
        localStorage.setItem('ajar_siswa_' + selectedClass, JSON.stringify(nextList));
        setClassCounts(prev => ({ ...prev, [selectedClass]: nextList.length }));
        setStudentToDelete(null);
      } else {
        showToast(res?.message || 'Gagal menghapus siswa.', 'error');
      }
    } catch {
      showToast('Gagal menghubungi server.', 'error');
    }
  };

  // 7. Export ke PDF (jsPDF + autoTable) — DIJAMIN 1 HALAMAN
  const handleExportPdf = () => {
    if (!selectedClass || siswaList.length === 0) return;
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      
      // Judul diringkas menjadi 1 baris sesuai instruksi
      const titleText = `Data Siswa Kelas ${selectedClass} Tahun Pelajaran 2026/2027`;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42); // Slate-900
      doc.text(titleText, 105, 12, { align: 'center' });

      // Garis aksen pemisah tipis
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.line(12, 14.5, 198, 14.5);

      const tableData = siswaList.map((s, idx) => {
        const rawJk = s.JenisKelamin || (s as any).jk || 'L';
        const jkBadge = rawJk === 'P' ? 'P' : 'L';
        return [
          idx + 1,
          s.NIS || s.nis || s.nisn || '-',
          s.NamaSiswa || s.namaSiswa || s.nama || '-',
          jkBadge,
          selectedClass,
        ];
      });

      // Penyesuaian ukuran font dan padding dinamis agar 36-42 siswa muat persis dalam 1 lembar A4
      const isLargeClass = siswaList.length > 30;
      const fontSize = isLargeClass ? 8 : 8.5;
      const cellPadding = isLargeClass ? 1.2 : 1.7;

      autoTable(doc, {
        startY: 17,
        margin: { top: 17, bottom: 8, left: 12, right: 12 },
        head: [['No.', 'NISN', 'Nama Siswa', 'L/P', 'Kelas']],
        body: tableData,
        theme: 'striped',
        pageBreak: 'avoid',
        headStyles: {
          fillColor: [26, 86, 219],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
          fontSize: isLargeClass ? 8 : 8.5,
          cellPadding: isLargeClass ? 1.8 : 2.2,
        },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 30, font: 'courier', halign: 'center' },
          2: { cellWidth: 'auto', fontStyle: 'bold' },
          3: { cellWidth: 16, halign: 'center' },
          4: { cellWidth: 20, halign: 'center' },
        },
        styles: {
          fontSize: fontSize,
          cellPadding: cellPadding,
          overflow: 'ellipsize',
          lineColor: [226, 232, 240],
          lineWidth: 0.1,
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
      });

      doc.save(`Data_Siswa_Kelas_${selectedClass}_2026_2027.pdf`);
      showToast('Berkas PDF 1 halaman berhasil diunduh!', 'success');
    } catch (err: any) {
      showToast('Gagal mengekspor PDF: ' + err.message, 'error');
    }
  };

  // 8. Export ke Excel (.xlsx)
  const handleExportExcel = () => {
    if (!selectedClass || siswaList.length === 0) return;
    try {
      const rows = [
        ['NO', 'NISN', 'NAMA SISWA', 'L/P', 'KELAS'],
        ...siswaList.map((s, idx) => [
          idx + 1,
          s.NIS || s.nis || s.nisn || '',
          s.NamaSiswa || s.namaSiswa || s.nama || '',
          s.JenisKelamin === 'P' || (s as any).jk === 'P' ? 'P' : 'L',
          selectedClass,
        ]),
      ];

      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `Siswa ${selectedClass}`);
      XLSX.writeFile(wb, `Data_Siswa_Kelas_${selectedClass}_2026_2027.xlsx`);
      showToast('Berkas Excel berhasil diunduh!', 'success');
    } catch (err: any) {
      showToast('Gagal mengekspor Excel: ' + err.message, 'error');
    }
  };

  // 9. Filter data siswa berdasarkan pencarian (nama atau NISN)
  const filteredSiswa = useMemo(() => {
    if (!searchQuery.trim()) return siswaList;
    const q = searchQuery.toLowerCase().trim();
    return siswaList.filter(s => {
      const nama = (s.NamaSiswa || s.namaSiswa || s.nama || '').toLowerCase();
      const nisn = (s.nisn || s.NIS || s.nis || '').toLowerCase();
      return nama.includes(q) || nisn.includes(q);
    });
  }, [siswaList, searchQuery]);

  return (
    <div className="h-full w-full flex flex-col min-h-0 select-none overflow-hidden text-slate-800 antialiased gap-3">
      {/* 1. PANEL TINGKAT KELAS FIXED + SINKRONISASI REFRESH */}
      <div className="shrink-0 sticky top-0 z-10 w-full pt-1 pb-1 flex items-center justify-between gap-2 max-w-sm sm:max-w-md mx-auto">
        {availableLevels.length > 0 && (
          <div className="p-1 rounded-2xl neu-pressed bg-[#E8EEF6] flex gap-1.5 flex-1 shadow-inner">
            {availableLevels.map(lvl => {
              const isActive = activeLevel === lvl;
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setActiveLevel(lvl)}
                  className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    isActive
                      ? 'neu-flat bg-[#EEF2F6] text-blue-700 shadow-xs scale-[1.01]'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Tingkat {lvl}
                </button>
              );
            })}
          </div>
        )}
        <button
          type="button"
          onClick={handleRefreshAll}
          disabled={isRefreshing}
          title="Sinkronkan data siswa dari spreadsheet"
          className="p-2.5 rounded-2xl neu-flat hover:neu-raised active:neu-pressed bg-[#EEF2F6] text-slate-600 hover:text-blue-700 cursor-pointer transition-all border border-white/80 shrink-0 flex items-center justify-center disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 stroke-[2.4] ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
        </button>
      </div>

      {/* 2. DAFTAR KARTU KELAS (Scrollable Vertikal, No-Scrollbar Visual, Padding Bawah Aman dari Nav Bar) */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-2.5 pb-32 sm:pb-28 pr-0.5">
        {displayedClasses.length > 0 ? (
          displayedClasses.map(clsName => {
            const count = classCounts[clsName];
            const hasData = count !== undefined && count > 0;
            const isLoadingThis = loadingClass === clsName;
            const subjectName = getClassSubject(clsName);

            return (
              <div
                key={clsName}
                onClick={() => handleSelectClass(clsName)}
                className="w-full neu-raised-card bg-[#EEF2F6] hover:bg-[#F2F6FA] rounded-2xl p-3.5 sm:p-4 flex items-center justify-between border border-white/80 cursor-pointer active:scale-[0.99] transition-all shadow-xs group"
              >
                {/* Sisi Kiri: Ikon Kelas & Nama Kelas */}
                <div className="flex items-center space-x-3 min-w-0 pr-2">
                  <div className="w-11 h-11 rounded-2xl neu-inset bg-[#E8EEF6] text-blue-600 flex items-center justify-center shrink-0 shadow-inner group-hover:text-blue-700 transition-colors">
                    <GraduationCap className="w-5 h-5 stroke-[2.4]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-black text-[#0D162B] tracking-tight truncate leading-none">
                      {clsName}
                    </h3>
                    <p
                      className="text-[10.5px] text-blue-600 font-extrabold mt-1 truncate"
                      title={subjectName}
                    >
                      {subjectName}
                    </p>
                  </div>
                </div>

                {/* Sisi Kanan: Status Siswa */}
                <div className="shrink-0">
                  {isLoadingThis ? (
                    <span className="text-[11px] font-extrabold text-blue-600 animate-pulse">
                      Memuat...
                    </span>
                  ) : hasData ? (
                    <div className="px-3 py-1 rounded-full neu-inset bg-[#E8EEF6] text-blue-700 font-extrabold text-xs">
                      {count} Siswa
                    </div>
                  ) : count === 0 ? (
                    <div className="px-3 py-1 rounded-full text-slate-400 text-xs font-bold italic">
                      Belum ada siswa
                    </div>
                  ) : (
                    <span className="text-[11px] font-bold text-slate-400 animate-pulse">
                      Memeriksa...
                    </span>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-12 neu-raised-card bg-[#EEF2F6] rounded-3xl p-6 text-slate-500">
            <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-xs font-extrabold text-slate-700">Tidak ada rombel kelas yang ditemukan</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Periksa konfigurasi mengajar pada menu Master Ajar
            </p>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. MODAL PILIHAN UPLOAD DATA (KONDISI KELAS KOSONG) */}
      {/* ========================================================================= */}
      {showUploadModal && selectedClass && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setShowUploadModal(false)}
        >
          <div
            className="neu-raised-card bg-[#EEF2F6] max-w-sm w-full p-5 rounded-[26px] relative border border-white/90 shadow-2xl animate-in zoom-in-95 duration-150 space-y-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#d4deeb] pb-2.5">
              <div>
                <h3 className="text-sm font-black text-[#0D162B]">
                  Upload Data Siswa
                </h3>
                <p className="text-[10px] text-slate-500 font-extrabold">
                  Kelas {selectedClass} • Belum ada data
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="p-1.5 rounded-xl neu-flat active:neu-pressed text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            <div className="space-y-2.5">
              {/* Opsi PDF (Disabled) */}
              <div className="p-3 rounded-2xl neu-pressed bg-[#E8EEF6] border border-white/60 flex items-center justify-between opacity-60 cursor-not-allowed">
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 font-black">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-700">Format PDF</p>
                    <p className="text-[10px] text-slate-500 font-semibold">Dokumen PDF Nilai/Siswa</p>
                  </div>
                </div>
                <span className="text-[9px] font-black text-slate-400 bg-slate-200 px-2 py-0.5 rounded-md">
                  Segera Hadir
                </span>
              </div>

              {/* Opsi Excel (Disabled) */}
              <div className="p-3 rounded-2xl neu-pressed bg-[#E8EEF6] border border-white/60 flex items-center justify-between opacity-60 cursor-not-allowed">
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 font-black">
                    <FileSpreadsheet className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-slate-700">Format Excel</p>
                    <p className="text-[10px] text-slate-500 font-semibold">Berkas .xlsx / .xls</p>
                  </div>
                </div>
                <span className="text-[9px] font-black text-slate-400 bg-slate-200 px-2 py-0.5 rounded-md">
                  Segera Hadir
                </span>
              </div>
            </div>

            {/* Keterangan Nonaktif */}
            <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200/60 text-[10px] text-blue-800 font-bold text-center">
              Fungsi upload data siswa sedang disiapkan untuk spesifikasi format data madrasah.
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(false);
                  handleOpenAdd();
                }}
                className="py-2.5 rounded-xl neu-btn bg-[#EEF2F6] text-blue-700 text-xs font-black cursor-pointer active:scale-95 text-center flex items-center justify-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Input Manual</span>
              </button>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="py-2.5 rounded-xl neu-flat text-slate-600 text-xs font-bold cursor-pointer active:scale-95 text-center"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. FLOATING FULL-SCREEN TABEL DATA SISWA (KONDISI KELAS TERISI) */}
      {/* ========================================================================= */}
      {showTableModal && selectedClass && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            className="w-full h-full max-w-4xl max-h-[96vh] neu-raised-card bg-[#EEF2F6] rounded-[24px] sm:rounded-[28px] border border-white/90 shadow-2xl flex flex-col overflow-hidden relative animate-in zoom-in-95 duration-150"
            onClick={e => e.stopPropagation()}
          >
            {/* Header Modal Full Screen */}
            <div className="p-3.5 sm:p-4 border-b border-[#d4deeb] bg-[#EEF2F6] shrink-0 flex items-center justify-between gap-2">
              {/* Judul & Counter Siswa */}
              <div className="min-w-0 pr-1">
                <h2 className="text-sm sm:text-base font-black text-[#0D162B] tracking-tight truncate flex items-center gap-2">
                  <span>Kelas {selectedClass}</span>
                  <span className="text-[10px] font-extrabold text-blue-700 neu-inset bg-[#E8EEF6] px-2.5 py-0.5 rounded-full">
                    {siswaList.length} Siswa
                  </span>
                </h2>
              </div>

              {/* Bilah Tombol Aksi: Desktop Toolbar & Tombol Tutup X */}
              <div className="flex items-center gap-1.5 shrink-0">
                {/* Tombol Aksi Khusus Tampilan Desktop (sm:flex) */}
                <div className="hidden sm:flex items-center gap-1.5">
                  {/* Tombol Tambah */}
                  <button
                    type="button"
                    onClick={handleOpenAdd}
                    className="py-1.5 px-3 rounded-xl neu-btn bg-[#EEF2F6] text-blue-700 hover:text-blue-800 text-xs font-black flex items-center gap-1 cursor-pointer active:scale-95 transition-all shadow-xs"
                    title="Tambah Siswa Baru"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Tambah</span>
                  </button>

                  {/* Tombol Edit Mode */}
                  <button
                    type="button"
                    onClick={() => setIsEditMode(prev => !prev)}
                    className={`py-1.5 px-3 rounded-xl text-xs font-black flex items-center gap-1 cursor-pointer active:scale-95 transition-all shadow-xs ${
                      isEditMode
                        ? 'bg-blue-600 text-white border border-blue-500 shadow-md'
                        : 'neu-btn bg-[#EEF2F6] text-slate-700 hover:text-slate-900'
                    }`}
                    title={isEditMode ? 'Selesai Mode Edit' : 'Edit Data Siswa'}
                  >
                    {isEditMode ? (
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    ) : (
                      <Edit2 className="w-3.5 h-3.5 stroke-[2.5]" />
                    )}
                    <span>{isEditMode ? 'Selesai' : 'Edit'}</span>
                  </button>

                  {/* Tombol Export */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowExportMenu(prev => !prev)}
                      className="py-1.5 px-3 rounded-xl neu-btn bg-[#EEF2F6] text-slate-700 hover:text-slate-900 text-xs font-black flex items-center gap-1 cursor-pointer active:scale-95 transition-all shadow-xs"
                      title="Export Data Siswa"
                    >
                      <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Export</span>
                    </button>

                    {showExportMenu && (
                      <div className="absolute right-0 top-full mt-1.5 w-36 neu-raised-card bg-[#EEF2F6] rounded-xl border border-white/80 shadow-xl p-1 z-30 animate-in fade-in zoom-in-95 duration-100">
                        <button
                          type="button"
                          onClick={() => {
                            setShowExportMenu(false);
                            handleExportPdf();
                          }}
                          className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:text-blue-700 hover:bg-white/60 rounded-lg flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5 text-rose-600" />
                          <span>Export PDF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowExportMenu(false);
                            handleExportExcel();
                          }}
                          className="w-full text-left px-3 py-2 text-xs font-bold text-slate-700 hover:text-blue-700 hover:bg-white/60 rounded-lg flex items-center gap-2 cursor-pointer transition-colors"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Export Excel</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* TOMBOL X UNTUK KEMBALI (Target Sentuh Ergonomis >= 40px) */}
                <button
                  type="button"
                  onClick={() => {
                    setShowTableModal(false);
                    setIsEditMode(false);
                    setShowExportMenu(false);
                  }}
                  className="p-2 sm:p-1.5 rounded-xl neu-flat active:neu-pressed text-slate-500 hover:text-slate-900 cursor-pointer border border-white/80 active:scale-95 transition-all min-h-[40px] min-w-[40px] flex items-center justify-center"
                  title="Tutup & Kembali ke Daftar Kelas"
                >
                  <X className="w-4 h-4 sm:w-4 sm:h-4 stroke-[2.5]" />
                </button>
              </div>
            </div>

            {/* Info Mode Edit (Jika Aktif) */}
            {isEditMode && (
              <div className="px-4 py-1.5 bg-amber-50 border-b border-amber-200/70 text-[11px] font-bold text-amber-800 flex items-center justify-between shrink-0">
                <span>Mode Edit Aktif: Tekan lama baris untuk menghapus, atau klik untuk mengubah data siswa.</span>
              </div>
            )}

            {/* Bilah Pencarian Siswa di Dalam Modal */}
            <div className="px-3 py-2 bg-[#E8EEF6]/60 border-b border-[#cbd5e1] flex items-center justify-between gap-2.5 shrink-0">
              <div className="relative flex-1 max-w-xs sm:max-w-sm">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Cari nama atau NISN..."
                  className="w-full pl-8 pr-7 py-1.5 neu-pressed bg-[#E8EEF6] border border-white/70 rounded-xl text-xs font-bold text-slate-800 placeholder-slate-400 outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  >
                    <X className="w-3 h-3 stroke-[2.5]" />
                  </button>
                )}
              </div>
              <div className="text-[11px] font-black text-slate-600 shrink-0">
                {searchQuery ? `${filteredSiswa.length} / ${siswaList.length} siswa` : `${siswaList.length} siswa`}
              </div>
            </div>

            {/* TABEL SISWA SUPER PADAT */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {/* Header Kolom Tabel (Sticky / Tetap di Atas) */}
              <div className="shrink-0 bg-[#E2E8F0]/90 border-b border-[#cbd5e1] text-[11px] font-black text-slate-700 grid grid-cols-12 px-3 py-2 select-none uppercase tracking-wider">
                <div className="col-span-1 text-center">No.</div>
                <div className="col-span-3 font-mono">NISN</div>
                <div className="col-span-6 pl-1">Nama Siswa</div>
                <div className="col-span-2 text-center">L/P</div>
              </div>

              {/* Baris Isi List Siswa (Hanya Area Ini yang Scrollable) */}
              <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
                {filteredSiswa.length > 0 ? (
                  filteredSiswa.map((s, idx) => {
                    const sId = s.SiswaID || s.siswaId || `s-${idx}`;
                    const nama = s.NamaSiswa || s.namaSiswa || s.nama || '-';
                    const nisn = s.nisn || s.NIS || s.nis || '-';
                    const jk = s.JenisKelamin || (s as any).jk || 'L';

                    return (
                      <div
                        key={sId}
                        onTouchStart={() => handleTouchStartRow(s)}
                        onTouchEnd={handleCancelLongPress}
                        onMouseDown={() => handleMouseDownRow(s)}
                        onMouseUp={handleCancelLongPress}
                        onMouseLeave={handleCancelLongPress}
                        onClick={() => {
                          if (isEditMode) handleOpenEdit(s);
                        }}
                        className={`grid grid-cols-12 items-center px-3 py-2 text-xs border-b border-slate-200/60 transition-colors select-none ${
                          idx % 2 === 0 ? 'bg-[#EEF2F6]' : 'bg-[#EBF0F8]'
                        } ${
                          isEditMode
                            ? 'cursor-pointer hover:bg-blue-50 active:bg-blue-100'
                            : 'hover:bg-white/40'
                        }`}
                      >
                        <div className="col-span-1 text-center font-bold text-slate-500 tabular-nums text-[11px]">
                          {idx + 1}
                        </div>
                        <div className="col-span-3 font-mono font-bold text-slate-700 truncate text-[11px]">
                          {nisn}
                        </div>
                        <div className="col-span-6 pl-1 font-black text-[#0D162B] truncate" title={nama}>
                          {nama}
                        </div>
                        <div className="col-span-2 flex items-center justify-center">
                          {jk === 'P' ? (
                            <span className="text-[10px] text-pink-700 font-black px-2 py-0.5 rounded-md neu-inset bg-pink-50 border border-pink-200/60 inline-flex items-center justify-center min-w-[24px]">
                              P
                            </span>
                          ) : (
                            <span className="text-[10px] text-blue-700 font-black px-2 py-0.5 rounded-md neu-inset bg-blue-50 border border-blue-200/60 inline-flex items-center justify-center min-w-[24px]">
                              L
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-10 text-slate-400 text-xs font-bold">
                    {searchQuery ? (
                      <div>
                        <p>Tidak ada siswa dengan kata kunci "{searchQuery}".</p>
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="mt-2 text-blue-600 hover:underline font-extrabold"
                        >
                          Hapus Pencarian
                        </button>
                      </div>
                    ) : (
                      'Tidak ada siswa di kelas ini.'
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* BILAH AKSI BAWAH ERGONOMIS MOBILE (THUMB ZONE - MUDAH DITEKAN SATU TANGAN) */}
            <div className="sm:hidden shrink-0 px-3 py-2.5 bg-[#EEF2F6] border-t border-[#d4deeb] shadow-[0_-4px_16px_rgba(166,180,209,0.3)] flex items-center gap-2 z-20">
              {/* Tombol Tambah Siswa */}
              <button
                type="button"
                onClick={handleOpenAdd}
                className="flex-1 min-h-[46px] py-2 px-3 rounded-2xl neu-btn-primary text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-md"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Tambah</span>
              </button>

              {/* Tombol Mode Edit */}
              <button
                type="button"
                onClick={() => setIsEditMode(prev => !prev)}
                className={`flex-1 min-h-[46px] py-2 px-3 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all ${
                  isEditMode
                    ? 'neu-inset bg-[#E0E8F4] text-blue-700 border border-blue-400/80 shadow-inner'
                    : 'neu-btn bg-[#EEF2F6] text-slate-700 hover:text-slate-900 shadow-xs'
                }`}
              >
                {isEditMode ? (
                  <Check className="w-4 h-4 stroke-[3] text-blue-600" />
                ) : (
                  <Edit2 className="w-4 h-4 stroke-[2.4]" />
                )}
                <span>{isEditMode ? 'Selesai' : 'Edit'}</span>
              </button>

              {/* Tombol Export (PDF / Excel) */}
              <div className="relative flex-1">
                <button
                  type="button"
                  onClick={() => setShowExportMenu(prev => !prev)}
                  className="w-full min-h-[46px] py-2 px-3 rounded-2xl neu-btn bg-[#EEF2F6] text-slate-700 hover:text-slate-900 text-xs font-black flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 transition-all shadow-xs"
                >
                  <Download className="w-4 h-4 stroke-[2.4]" />
                  <span>Export</span>
                </button>

                {showExportMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-20"
                      onClick={() => setShowExportMenu(false)}
                    />
                    <div className="absolute right-0 bottom-full mb-2 w-44 neu-raised-card bg-[#EEF2F6] rounded-2xl border border-white/90 shadow-2xl p-1.5 z-30 animate-in fade-in zoom-in-95 duration-100">
                      <button
                        type="button"
                        onClick={() => {
                          setShowExportMenu(false);
                          handleExportPdf();
                        }}
                        className="w-full text-left px-3 py-2.5 text-xs font-bold text-slate-700 hover:text-blue-700 hover:bg-white/70 rounded-xl flex items-center gap-2.5 cursor-pointer transition-colors"
                      >
                        <FileText className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>Export PDF (1 Hal)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowExportMenu(false);
                          handleExportExcel();
                        }}
                        className="w-full text-left px-3 py-2.5 text-xs font-bold text-slate-700 hover:text-blue-700 hover:bg-white/70 rounded-xl flex items-center gap-2.5 cursor-pointer transition-colors"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Export Excel</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. MODAL TAMBAH / EDIT SISWA */}
      {/* ========================================================================= */}
      {formModalOpen && selectedClass && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setFormModalOpen(false)}
        >
          <div
            className="neu-raised-card bg-[#EEF2F6] max-w-sm w-full p-5 rounded-[26px] relative border border-white/90 shadow-2xl animate-in zoom-in-95 duration-150 space-y-3.5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#d4deeb] pb-2">
              <h3 className="text-sm font-black text-[#0D162B]">
                {editingSiswa ? 'Edit Siswa' : 'Tambah Siswa Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setFormModalOpen(false)}
                className="p-1 rounded-lg neu-flat active:neu-pressed text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            <form onSubmit={handleSaveSiswa} className="space-y-3">
              <div>
                <label className="text-[11px] font-extrabold text-slate-700 block mb-1">
                  Kelas Terpilih
                </label>
                <input
                  type="text"
                  disabled
                  readOnly
                  value={selectedClass}
                  className="w-full neu-pressed bg-[#E8EEF6] border border-white/50 rounded-xl px-3 py-1.5 text-xs font-black text-slate-500 select-none cursor-not-allowed"
                />
              </div>

              <div>
                <label className="text-[11px] font-extrabold text-slate-700 block mb-1">
                  NISN / Nomor Induk
                </label>
                <input
                  type="text"
                  value={formNisn}
                  onChange={e => setFormNisn(e.target.value)}
                  placeholder="Contoh: 0081234567"
                  className="w-full neu-pressed bg-[#E8EEF6] border border-white/70 rounded-xl px-3 py-1.5 text-xs font-mono font-bold text-[#0D162B] outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-extrabold text-slate-700 block mb-1">
                  Nama Lengkap Siswa
                </label>
                <input
                  type="text"
                  value={formNama}
                  onChange={e => setFormNama(formatProperCaseLive(e.target.value))}
                  onBlur={() => setFormNama(prev => toProperCase(prev.trim()))}
                  placeholder="Nama Lengkap Siswa"
                  className="w-full neu-pressed bg-[#E8EEF6] border border-white/70 rounded-xl px-3 py-1.5 text-xs font-bold text-[#0D162B] outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] font-extrabold text-slate-700 block mb-1">
                  Jenis Kelamin
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormJk('L')}
                    className={`py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      formJk === 'L'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'neu-pressed bg-[#E8EEF6] text-slate-600'
                    }`}
                  >
                    Laki-laki
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormJk('P')}
                    className={`py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      formJk === 'P'
                        ? 'bg-pink-600 text-white shadow-sm'
                        : 'neu-pressed bg-[#E8EEF6] text-slate-600'
                    }`}
                  >
                    Perempuan
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#d4deeb]">
                <button
                  type="button"
                  onClick={() => setFormModalOpen(false)}
                  className="w-full py-2 rounded-xl neu-flat text-xs font-bold text-slate-600 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={formSaving}
                  className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs shadow-md cursor-pointer disabled:opacity-50"
                >
                  {formSaving ? 'Menyimpan...' : 'Simpan Siswa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODAL KONFIRMASI HAPUS SISWA (DIPICU VIA LONG PRESS DI MODE EDIT) */}
      {/* ========================================================================= */}
      {studentToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setStudentToDelete(null)}
        >
          <div
            className="neu-raised-card bg-[#EEF2F6] max-w-[320px] w-full p-5 rounded-[26px] text-center relative border border-white/90 shadow-2xl animate-in zoom-in-95 duration-150 space-y-3"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-inner">
              <Trash2 className="w-6 h-6 stroke-[2.4]" />
            </div>

            <h3 className="text-sm font-black text-[#0D162B]">
              Hapus Siswa?
            </h3>

            <p className="text-xs text-slate-600 leading-relaxed font-semibold">
              Apakah Anda yakin ingin menghapus{' '}
              <span className="font-black text-[#0D162B]">
                "{studentToDelete.NamaSiswa || studentToDelete.nama}"
              </span>{' '}
              dari kelas {selectedClass}?
            </p>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStudentToDelete(null)}
                className="w-full py-2 rounded-xl neu-flat text-xs font-bold text-slate-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="w-full py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-black text-xs shadow-md shadow-rose-500/20 cursor-pointer"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
