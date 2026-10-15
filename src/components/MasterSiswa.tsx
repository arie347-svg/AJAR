import React, { useState, useEffect, useRef } from 'react';
import { Plus, Download, Upload, Trash2, Edit2, User as UserIcon, X, Check } from 'lucide-react';
import * as XLSX from 'xlsx';
import { SiswaItem, RefItem } from '../types';
import { callGasApi } from '../services/gasApi';

interface MasterSiswaProps {
  token: string;
  listKelas: RefItem[];
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const MasterSiswa: React.FC<MasterSiswaProps> = ({ token, listKelas, showToast }) => {
  const [selectedKelas, setSelectedKelas] = useState(
    listKelas.length > 0 ? listKelas[0].code || listKelas[0].id || listKelas[0].name : 'XI-IPA 1'
  );
  const [siswaList, setSiswaList] = useState<SiswaItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSiswa, setEditingSiswa] = useState<SiswaItem | null>(null);
  const [modalNis, setModalNis] = useState('');
  const [modalNama, setModalNama] = useState('');
  const [modalJk, setModalJk] = useState('L');
  const [modalSaving, setModalSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadSiswa = async (kelas: string) => {
    if (!kelas) return;
    setLoading(true);
    try {
      const res = await callGasApi('getMasterSiswa', [token, kelas]);
      if (res && res.success) {
        setSiswaList(res.siswa || []);
      } else {
        setSiswaList([]);
      }
    } catch {
      showToast('Gagal memuat data siswa.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedKelas) {
      loadSiswa(selectedKelas);
    }
  }, [selectedKelas]);

  const handleOpenAddModal = () => {
    setEditingSiswa(null);
    setModalNis('');
    setModalNama('');
    setModalJk('L');
    setModalOpen(true);
  };

  const handleOpenEditModal = (siswa: SiswaItem) => {
    setEditingSiswa(siswa);
    setModalNis(siswa.NIS || siswa.nis || '');
    setModalNama(siswa.NamaSiswa || siswa.namaSiswa || siswa.nama || '');
    setModalJk(siswa.JenisKelamin || siswa.jk || 'L');
    setModalOpen(true);
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalNama.trim()) {
      showToast('Nama siswa wajib diisi!', 'warning');
      return;
    }

    setModalSaving(true);
    try {
      const payload = {
        siswaId: editingSiswa?.SiswaID || editingSiswa?.siswaId || '',
        nis: modalNis.trim(),
        nama: modalNama.trim(),
        kelas: selectedKelas,
        jk: modalJk,
      };

      const res = await callGasApi('saveSiswaManual', [token, payload]);
      if (res && res.success) {
        showToast(res.message || 'Data siswa berhasil disimpan!', 'success');
        setModalOpen(false);
        loadSiswa(selectedKelas);
      } else {
        showToast(res?.message || 'Gagal menyimpan siswa.', 'error');
      }
    } catch {
      showToast('Gagal menghubungi server.', 'error');
    } finally {
      setModalSaving(false);
    }
  };

  const handleDeleteSiswa = async (siswaId: string, nama: string) => {
    if (!window.confirm(`Yakin ingin menghapus siswa "${nama}"?`)) return;

    try {
      const res = await callGasApi('deleteSiswa', [token, siswaId]);
      if (res && res.success) {
        showToast('Data siswa berhasil dihapus.', 'success');
        setSiswaList(prev => prev.filter(s => (s.SiswaID || s.siswaId) !== siswaId));
      } else {
        showToast(res?.message || 'Gagal menghapus siswa.', 'error');
      }
    } catch {
      showToast('Gagal menghapus siswa.', 'error');
    }
  };

  const handleDownloadTemplate = () => {
    const wsData = [
      ['NIS', 'Nama Siswa', 'Jenis Kelamin (L/P)', 'Kelas'],
      ['20260001', 'Ahmad Fadillah', 'L', selectedKelas],
      ['20260002', 'Bunga Citra', 'P', selectedKelas],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template Siswa');
    XLSX.writeFile(wb, `Template_Siswa_${selectedKelas}.xlsx`);
    showToast('Template Excel berhasil diunduh.', 'success');
  };

  const handleBulkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async evt => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<any>(ws, { header: 1 });

        if (data.length < 2) {
          showToast('Berkas Excel kosong atau tidak memiliki baris data!', 'warning');
          return;
        }

        const rows = data.slice(1);
        const importedList: SiswaItem[] = [];

        rows.forEach((row, i) => {
          const nis = String(row[0] || '').trim();
          const nama = String(row[1] || '').trim();
          const jk = String(row[2] || 'L').trim().toUpperCase();
          if (nama) {
            importedList.push({
              SiswaID: 'S-UP-' + Date.now() + '-' + i,
              NIS: nis || String(20260000 + i + 1),
              NamaSiswa: nama,
              Kelas: selectedKelas,
              JenisKelamin: jk === 'P' ? 'P' : 'L',
            });
          }
        });

        if (importedList.length === 0) {
          showToast('Tidak ada data siswa yang valid dalam berkas Excel.', 'warning');
          return;
        }

        // Save locally or call bulkUpload
        await callGasApi('bulkUploadSiswa', [token, selectedKelas, importedList]);
        showToast(`Berhasil mengunggah ${importedList.length} data siswa!`, 'success');
        loadSiswa(selectedKelas);
      } catch (err: any) {
        showToast('Gagal memproses berkas Excel: ' + err.message, 'error');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-4 pb-24">
      <div className="bg-white/15 backdrop-blur-md rounded-3xl p-5 shadow-xl shadow-black/10 space-y-3.5 text-white border border-white/15">
        <div>
          <label className="block text-[11px] font-extrabold text-[#fde047] uppercase tracking-wider mb-1.5">
            Pilih Rombongan Belajar (Kelas)
          </label>
          <select
            value={selectedKelas}
            onChange={e => setSelectedKelas(e.target.value)}
            className="w-full bg-[#002830] border border-white/20 rounded-2xl p-3 text-xs font-bold text-white outline-none cursor-pointer"
          >
            {listKelas.map((k, i) => {
              const val = k.code || k.id || k.name;
              return (
                <option key={i} value={val}>
                  {k.name}
                </option>
              );
            })}
          </select>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <button
            type="button"
            onClick={handleOpenAddModal}
            className="px-2 py-2.5 bg-[#facc15] hover:bg-[#eab308] text-slate-900 rounded-full text-xs font-extrabold shadow-md active:scale-95 flex items-center justify-center gap-1 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="px-2 py-2.5 bg-white/20 hover:bg-white/30 text-white rounded-full text-xs font-bold shadow-xs active:scale-95 flex items-center justify-center gap-1 cursor-pointer transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Unduh Excel</span>
          </button>

          <input
            type="file"
            ref={fileInputRef}
            accept=".xlsx, .xls"
            onChange={handleBulkUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-2 py-2.5 bg-white/20 hover:bg-white/30 text-white rounded-full text-xs font-bold shadow-xs active:scale-95 flex items-center justify-center gap-1 cursor-pointer transition-all"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Unggah Excel</span>
          </button>
        </div>

        {/* Student list card */}
        <div className="relative min-h-[160px] rounded-3xl overflow-hidden mt-3 bg-[#002830]/80 backdrop-blur-2xl p-3 shadow-2xl text-white border border-white/15">
          {loading && (
            <div className="absolute inset-0 bg-[#002830]/90 backdrop-blur-xs shimmer-box flex items-center justify-center space-x-2 text-xs font-bold text-[#fde047] z-10">
              <span>Memuat data siswa...</span>
            </div>
          )}

          {siswaList.length > 0 ? (
            <div className="space-y-2 max-h-[calc(100vh-320px)] overflow-y-auto touch-scroll pr-1">
              {siswaList.map((s, idx) => {
                const sId = s.SiswaID || s.siswaId || `s-${idx}`;
                const nama = s.NamaSiswa || s.namaSiswa || s.nama || '-';
                const nis = s.NIS || s.nis || '-';
                const jk = s.JenisKelamin || s.jk || 'L';

                return (
                  <div
                    key={sId}
                    className="flex items-center justify-between p-3 rounded-2xl bg-white/10 hover:bg-white/15 transition-all border border-white/5"
                  >
                    <div className="flex items-center space-x-3 min-w-0 pr-2">
                      <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-[#fde047] font-black text-xs shrink-0">
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-extrabold text-white truncate">{nama}</p>
                        <p className="text-[10px] text-white/70 font-mono">
                          NIS: {nis} • {jk === 'L' ? 'Laki-laki' : 'Perempuan'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(s)}
                        className="p-1.5 rounded-full bg-white/15 hover:bg-white/25 text-[#fde047] transition-all cursor-pointer"
                        title="Edit Siswa"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSiswa(sId, nama)}
                        className="p-1.5 rounded-full bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 transition-all cursor-pointer"
                        title="Hapus Siswa"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-slate-400 py-10 text-xs font-medium">
              Belum ada data siswa di kelas {selectedKelas}.
            </div>
          )}
        </div>
      </div>

      {/* MODAL TAMBAH/EDIT SISWA */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#002830] border border-white/20 rounded-3xl p-5 max-w-sm w-full text-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-black text-[#fde047]">
                {editingSiswa ? 'Edit Data Siswa' : 'Tambah Siswa Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-white/60 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-white/80 uppercase mb-1">
                  Kelas
                </label>
                <input
                  type="text"
                  disabled
                  value={selectedKelas}
                  className="w-full bg-white/10 border border-white/10 rounded-xl px-3 py-2 text-xs font-bold text-white/60"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-white/80 uppercase mb-1">
                  NIS Siswa
                </label>
                <input
                  type="text"
                  value={modalNis}
                  onChange={e => setModalNis(e.target.value)}
                  placeholder="Contoh: 20260001"
                  className="w-full bg-white/15 border border-white/20 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-[#fde047]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-white/80 uppercase mb-1">
                  Nama Lengkap Siswa *
                </label>
                <input
                  type="text"
                  value={modalNama}
                  onChange={e => setModalNama(e.target.value)}
                  placeholder="Nama lengkap peserta didik"
                  className="w-full bg-white/15 border border-white/20 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-[#fde047]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-white/80 uppercase mb-1">
                  Jenis Kelamin
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setModalJk('L')}
                    className={`py-2 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                      modalJk === 'L'
                        ? 'bg-[#facc15] text-slate-900 font-black'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    Laki-Laki (L)
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalJk('P')}
                    className={`py-2 rounded-xl text-xs font-bold cursor-pointer transition-all ${
                      modalJk === 'P'
                        ? 'bg-[#facc15] text-slate-900 font-black'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    Perempuan (P)
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-full text-xs font-bold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={modalSaving}
                  className="px-5 py-2 bg-[#facc15] hover:bg-[#eab308] text-slate-900 rounded-full text-xs font-black shadow-md cursor-pointer disabled:opacity-50"
                >
                  {modalSaving ? 'Menyimpan...' : 'Simpan Siswa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
