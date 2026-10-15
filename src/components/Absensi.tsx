import React, { useState, useEffect } from 'react';
import { Save, Check, CalendarCheck } from 'lucide-react';
import { PengajaranItem, SiswaItem } from '../types';
import { callGasApi } from '../services/gasApi';

interface AbsensiProps {
  token: string;
  pengajaranList: PengajaranItem[];
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const Absensi: React.FC<AbsensiProps> = ({ token, pengajaranList, showToast }) => {
  const [selectedPengajaranId, setSelectedPengajaranId] = useState(
    pengajaranList.length > 0 ? `${pengajaranList[0].mapelId}|${pengajaranList[0].kelas}` : ''
  );
  const [semester, setSemester] = useState('Ganjil');
  const [pertemuan, setPertemuan] = useState(1);
  const [tanggal, setTanggal] = useState(new Date().toISOString().split('T')[0]);

  const [siswaList, setSiswaList] = useState<SiswaItem[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<string, string>>({}); // [siswaId]: 'H' | 'S' | 'I' | 'A'
  const [loading, setLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const curPengajaran = pengajaranList.find(
    p => `${p.mapelId}|${p.kelas}` === selectedPengajaranId
  ) || pengajaranList[0];

  const loadAbsensi = async () => {
    if (!curPengajaran) return;
    setLoading(true);
    try {
      const res = await callGasApi('getAbsensiData', [
        token,
        curPengajaran.kelas,
        curPengajaran.mapelId,
        pertemuan,
        semester,
      ]);

      if (res && res.success) {
        setSiswaList(res.siswa || []);
        const curMeetAtt: Record<string, string> = {};
        const pKey = String(pertemuan);
        (res.siswa || []).forEach((s: SiswaItem) => {
          const sId = s.SiswaID || s.siswaId || '';
          const existing = res.absensiMap?.[sId]?.[pKey];
          curMeetAtt[sId] = existing || 'H';
        });
        setAttendanceMap(curMeetAtt);
        if (res.datesMap?.[pKey]) {
          setTanggal(res.datesMap[pKey]);
        }
        setIsDirty(false);
      }
    } catch {
      showToast('Gagal memuat data presensi.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAbsensi();
  }, [selectedPengajaranId, semester, pertemuan]);

  const handleStatusChange = (siswaId: string, status: string) => {
    setIsDirty(true);
    setAttendanceMap(prev => ({
      ...prev,
      [siswaId]: status,
    }));
  };

  const handleSetAllHadir = () => {
    setIsDirty(true);
    const updated: Record<string, string> = {};
    siswaList.forEach(s => {
      const sId = s.SiswaID || s.siswaId || '';
      updated[sId] = 'H';
    });
    setAttendanceMap(updated);
    showToast('Seluruh siswa diset Hadir (H)', 'info');
  };

  const handleSave = async () => {
    if (!curPengajaran) return;
    setSaving(true);
    try {
      const payload = {
        mapelId: curPengajaran.mapelId,
        kelas: curPengajaran.kelas,
        pertemuan: pertemuan,
        tanggal: tanggal,
        semester: semester,
        records: attendanceMap,
      };

      const res = await callGasApi('saveAbsensiData', [token, payload]);
      if (res && res.success) {
        showToast('Presensi berhasil disimpan ke database!', 'success');
        setIsDirty(false);
      } else {
        showToast(res?.message || 'Gagal menyimpan presensi.', 'error');
      }
    } catch {
      showToast('Gagal menghubungi server.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3.5 pb-28">
      {/* Filters Card */}
      <div className="bg-white/15 backdrop-blur-md p-3 rounded-2xl shadow-xl flex items-center space-x-2 border border-white/10">
        <div className="flex-1">
          <select
            value={selectedPengajaranId}
            onChange={e => setSelectedPengajaranId(e.target.value)}
            className="w-full bg-[#002830] border border-white/20 rounded-xl p-2 text-xs font-bold text-white outline-none cursor-pointer"
          >
            {pengajaranList.map((p, idx) => (
              <option key={idx} value={`${p.mapelId}|${p.kelas}`}>
                {p.mapelNama || p.mapelId} - Kelas {p.kelas}
              </option>
            ))}
          </select>
        </div>
        <div className="w-32">
          <select
            value={semester}
            onChange={e => setSemester(e.target.value)}
            className="w-full bg-[#002830] border border-white/20 rounded-xl p-2 text-xs font-bold text-white outline-none cursor-pointer"
          >
            <option value="Ganjil">Sem. Ganjil</option>
            <option value="Genap">Sem. Genap</option>
          </select>
        </div>
      </div>

      {/* Entry Form */}
      <div className="bg-white/10 backdrop-blur-xl rounded-3xl p-4 text-white shadow-xl border border-white/15 space-y-3.5">
        <div className="grid grid-cols-2 gap-3 p-3 bg-white/10 rounded-2xl border border-white/10 text-white">
          <div>
            <label className="block text-[10px] font-extrabold text-[#fde047] uppercase tracking-wider mb-1">
              Pertemuan Ke
            </label>
            <select
              value={pertemuan}
              onChange={e => setPertemuan(parseInt(e.target.value, 10))}
              className="w-full bg-[#002830] border border-white/20 rounded-xl p-2 text-xs font-bold text-white outline-none cursor-pointer"
            >
              {Array.from({ length: 31 }, (_, i) => i + 1).map(p => (
                <option key={p} value={p}>
                  Pertemuan {p}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-extrabold text-[#fde047] uppercase tracking-wider mb-1">
              Tanggal Presensi
            </label>
            <input
              type="date"
              value={tanggal}
              onChange={e => {
                setTanggal(e.target.value);
                setIsDirty(true);
              }}
              className="w-full bg-[#002830] border border-white/20 rounded-xl p-2 text-xs font-bold text-white outline-none cursor-pointer"
            />
          </div>
        </div>

        {/* Attendance header */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs font-black text-white">Daftar Kehadiran Siswa</span>
          <button
            type="button"
            onClick={handleSetAllHadir}
            className="px-3.5 py-1.5 bg-emerald-500/25 hover:bg-emerald-500/35 border border-emerald-400/40 text-emerald-300 rounded-full text-[11px] font-black shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            Semua Hadir (H)
          </button>
        </div>

        {/* Student Cards List */}
        <div className="space-y-1.5 max-h-[calc(100vh-420px)] min-h-[220px] overflow-y-auto touch-scroll pr-1 pb-3">
          {loading ? (
            <div className="text-center py-12 text-[#fde047] text-xs font-bold shimmer-box">
              Memuat daftar kehadiran...
            </div>
          ) : siswaList.length > 0 ? (
            siswaList.map((s, idx) => {
              const sId = s.SiswaID || s.siswaId || `s-${idx}`;
              const curStatus = attendanceMap[sId] || 'H';

              return (
                <div
                  key={sId}
                  className="flex items-center justify-between p-2.5 bg-white/10 hover:bg-white/15 rounded-2xl border border-white/10 transition-all"
                >
                  <div className="min-w-0 pr-2">
                    <p className="text-xs font-bold text-white truncate">
                      {idx + 1}. {s.NamaSiswa || s.namaSiswa || s.nama || '-'}
                    </p>
                    <p className="text-[10px] text-white/60 font-mono">
                      NIS: {s.NIS || s.nis || '-'}
                    </p>
                  </div>

                  {/* Status Buttons: H, S, I, A */}
                  <div className="flex items-center space-x-1 shrink-0">
                    {[
                      { key: 'H', label: 'H', activeCls: 'bg-emerald-500 text-slate-900 border-emerald-400 font-black' },
                      { key: 'S', label: 'S', activeCls: 'bg-amber-400 text-slate-900 border-amber-300 font-black' },
                      { key: 'I', label: 'I', activeCls: 'bg-sky-400 text-slate-900 border-sky-300 font-black' },
                      { key: 'A', label: 'A', activeCls: 'bg-rose-500 text-white border-rose-400 font-black' },
                    ].map(st => {
                      const isSelected = curStatus === st.key;
                      return (
                        <button
                          key={st.key}
                          type="button"
                          onClick={() => handleStatusChange(sId, st.key)}
                          className={`w-8 h-8 rounded-xl text-xs flex items-center justify-center transition-all cursor-pointer border ${
                            isSelected
                              ? `${st.activeCls} shadow-md scale-105`
                              : 'bg-white/10 text-white/70 border-white/15 hover:bg-white/20'
                          }`}
                        >
                          {st.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-10 text-slate-400 text-xs font-medium">
              Tidak ada data siswa untuk kelas ini.
            </div>
          )}
        </div>
      </div>

      {/* Floating Save Button */}
      <div className="fixed bottom-[74px] md:bottom-4 left-3 right-3 max-w-[456px] md:max-w-[720px] mx-auto z-30 pointer-events-auto">
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || saving}
          className={`w-full py-3.5 rounded-2xl shadow-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
            isDirty && !saving
              ? 'bg-[#facc15] hover:bg-[#eab308] text-slate-900 active:scale-95'
              : 'bg-white/20 text-white/40 cursor-not-allowed'
          }`}
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Menyimpan...' : 'Simpan Data Presensi'}</span>
        </button>
      </div>
    </div>
  );
};
