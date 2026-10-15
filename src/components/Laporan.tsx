import React, { useState, useEffect } from 'react';
import { Download, FileSpreadsheet, FileText, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PengajaranItem, SiswaItem, LkhRecord, User } from '../types';
import { callGasApi } from '../services/gasApi';

interface LaporanProps {
  token: string;
  currentUser: User | null;
  pengajaranList: PengajaranItem[];
  showToast: (msg: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const Laporan: React.FC<LaporanProps> = ({
  token,
  currentUser,
  pengajaranList,
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState<'absensi' | 'nilai' | 'lkh'>('absensi');

  // Pengajaran select
  const [selectedPengajaranId, setSelectedPengajaranId] = useState(
    pengajaranList.length > 0 ? `${pengajaranList[0].mapelId}|${pengajaranList[0].kelas}` : ''
  );

  // Laporan Presensi State
  const [absSiswaList, setAbsSiswaList] = useState<SiswaItem[]>([]);
  const [absMap, setAbsMap] = useState<Record<string, Record<string, string>>>({});
  const [absDates, setAbsDates] = useState<Record<string, string>>({});

  // Laporan Nilai State
  const [nilSiswaList, setNilSiswaList] = useState<SiswaItem[]>([]);
  const [nilActMap, setNilActMap] = useState<Record<string, Record<string, number | null>>>({});
  const [nilPasMap, setNilPasMap] = useState<Record<string, number | null>>({});
  const [kkm, setKkm] = useState(75);
  const [bobotAct, setBobotAct] = useState(66);
  const [bobotPas, setBobotPas] = useState(34);

  // Laporan LKH State
  const [lkhRecords, setLkhRecords] = useState<LkhRecord[]>([]);

  const [loading, setLoading] = useState(false);

  const curPengajaran = pengajaranList.find(
    p => `${p.mapelId}|${p.kelas}` === selectedPengajaranId
  ) || pengajaranList[0];

  const loadLaporanData = async () => {
    if (!curPengajaran && activeTab !== 'lkh') return;
    setLoading(true);
    try {
      if (activeTab === 'absensi') {
        const res = await callGasApi('getAbsensiData', [
          token,
          curPengajaran?.kelas,
          curPengajaran?.mapelId,
          1,
          'Ganjil',
        ]);
        if (res && res.success) {
          setAbsSiswaList(res.siswa || []);
          setAbsMap(res.absensiMap || {});
          setAbsDates(res.datesMap || {});
        }
      } else if (activeTab === 'nilai') {
        const res = await callGasApi('getNilaiData', [
          token,
          curPengajaran?.kelas,
          curPengajaran?.mapelId,
          'Ganjil',
        ]);
        if (res && res.success) {
          setNilSiswaList(res.siswa || []);
          setNilActMap(res.aktivitasMap || {});
          setNilPasMap(res.pasMap || {});
        }
      } else if (activeTab === 'lkh') {
        const res = await callGasApi('getLkhData', [token]);
        if (res && res.success) {
          setLkhRecords(res.records || []);
        }
      }
    } catch {
      showToast('Gagal memuat data laporan.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLaporanData();
  }, [activeTab, selectedPengajaranId]);

  // EXPORT EXCEL
  const handleExportExcel = () => {
    if (activeTab === 'absensi') {
      const headers = ['No', 'NIS', 'Nama Siswa', ...Array.from({ length: 16 }, (_, i) => `P${i + 1}`), 'H', 'S', 'I', 'A'];
      const rows = absSiswaList.map((s, idx) => {
        const sId = s.SiswaID || s.siswaId || '';
        const att = absMap[sId] || {};
        const pVals = Array.from({ length: 16 }, (_, i) => att[String(i + 1)] || '-');
        let h = 0, sc = 0, ic = 0, a = 0;
        Object.values(att).forEach(v => {
          if (v === 'H') h++;
          else if (v === 'S') sc++;
          else if (v === 'I') ic++;
          else if (v === 'A') a++;
        });
        return [idx + 1, s.NIS || s.nis || '', s.NamaSiswa || s.namaSiswa || s.nama || '', ...pVals, h, sc, ic, a];
      });

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Presensi');
      XLSX.writeFile(wb, `Rekap_Presensi_${curPengajaran?.kelas}_${curPengajaran?.mapelNama || 'Mapel'}.xlsx`);
    } else if (activeTab === 'nilai') {
      const actHeaders = Array.from({ length: 10 }, (_, i) => `Act ${i + 1}`);
      const headers = ['No', 'NIS', 'Nama Siswa', ...actHeaders, 'Rata Formatif', 'PAS', 'Nilai Akhir', 'Status'];
      const rows = nilSiswaList.map((s, idx) => {
        const sId = s.SiswaID || s.siswaId || '';
        const acts = nilActMap[sId] || {};
        const actVals = Array.from({ length: 10 }, (_, i) => acts[`act_${i + 1}`] ?? '');
        const validActs = Object.values(acts).filter(v => typeof v === 'number') as number[];
        const avgAct = validActs.length > 0 ? Math.round(validActs.reduce((a, b) => a + b, 0) / validActs.length) : 0;
        const pasVal = nilPasMap[sId] ?? 0;
        const finalScore = Math.round((avgAct * bobotAct + pasVal * bobotPas) / (bobotAct + bobotPas));
        const status = finalScore >= kkm ? 'TUNTAS' : 'REMEDI';
        return [idx + 1, s.NIS || s.nis || '', s.NamaSiswa || s.namaSiswa || s.nama || '', ...actVals, avgAct, pasVal, finalScore, status];
      });

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Penilaian');
      XLSX.writeFile(wb, `Rekap_Nilai_${curPengajaran?.kelas}_${curPengajaran?.mapelNama || 'Mapel'}.xlsx`);
    } else if (activeTab === 'lkh') {
      const headers = ['No', 'Tanggal', 'Jenis', 'Mata Pelajaran', 'Jam Ke', 'Kelas', 'Uraian Kerja', 'Hasil Pembelajaran'];
      const rows = lkhRecords.map((r, idx) => [
        idx + 1,
        r.Tanggal || r.tanggal || '',
        r.IsNonKbm || r.isNonKbm ? 'Non-KBM' : 'KBM',
        r.mapelNama || r.MataPelajaranID || '-',
        r.JamMulai ? `${r.JamMulai}-${r.JamSelesai}` : '-',
        r.Kelas || r.kelas || '-',
        r.UraianKerja || r.uraian || '',
        r.HasilPembelajaran || r.hasil || '',
      ]);

      const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Jurnal LKH');
      XLSX.writeFile(wb, `Jurnal_LKH_${currentUser?.namaTampilan || 'Guru'}.xlsx`);
    }
    showToast('Laporan Excel berhasil diunduh.', 'success');
  };

  // EXPORT PDF
  const handleExportPdf = () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

      // School Letterhead (Kop Surat)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('KEMENTERIAN AGAMA REPUBLIK INDONESIA', doc.internal.pageSize.getWidth() / 2, 14, { align: 'center' });
      doc.setFontSize(12);
      doc.text('KANTOR KEMENTERIAN AGAMA KABUPATEN MAJALENGKA', doc.internal.pageSize.getWidth() / 2, 20, { align: 'center' });
      doc.setFontSize(13);
      doc.text('MADRASAH ALIYAH NEGERI 1 MAJALENGKA', doc.internal.pageSize.getWidth() / 2, 26, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('Jl. K.H. Abdul Halim No. 503 Majalengka Jawa Barat • Website: www.man1majalengka.sch.id', doc.internal.pageSize.getWidth() / 2, 31, { align: 'center' });

      doc.setLineWidth(0.8);
      doc.line(14, 34, doc.internal.pageSize.getWidth() - 14, 34);
      doc.setLineWidth(0.3);
      doc.line(14, 35, doc.internal.pageSize.getWidth() - 14, 35);

      if (activeTab === 'absensi') {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(`REKAPITULASI PRESENSI SISWA - KELAS ${curPengajaran?.kelas || ''}`, 14, 42);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Mata Pelajaran: ${curPengajaran?.mapelNama || ''} | Guru: ${currentUser?.namaTampilan || ''}`, 14, 47);

        const head = [['No', 'NIS', 'Nama Siswa', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'H', 'S', 'I', 'A']];
        const body = absSiswaList.map((s, idx) => {
          const sId = s.SiswaID || s.siswaId || '';
          const att = absMap[sId] || {};
          let h = 0, sc = 0, ic = 0, a = 0;
          Object.values(att).forEach(v => {
            if (v === 'H') h++;
            else if (v === 'S') sc++;
            else if (v === 'I') ic++;
            else if (v === 'A') a++;
          });
          const pCols = Array.from({ length: 10 }, (_, i) => att[String(i + 1)] || '-');
          return [idx + 1, s.NIS || s.nis || '', s.NamaSiswa || s.namaSiswa || s.nama || '', ...pCols, h, sc, ic, a];
        });

        autoTable(doc, {
          startY: 52,
          head,
          body,
          theme: 'grid',
          headStyles: { fillColor: [0, 118, 133], textColor: 255, fontStyle: 'bold', fontSize: 8 },
          styles: { fontSize: 8, cellPadding: 2 },
        });
      } else if (activeTab === 'nilai') {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text(`LEDGER PENILAIAN SISWA - KELAS ${curPengajaran?.kelas || ''}`, 14, 42);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Mata Pelajaran: ${curPengajaran?.mapelNama || ''} | KKM: ${kkm}`, 14, 47);

        const head = [['No', 'NIS', 'Nama Siswa', 'Act 1', 'Act 2', 'Act 3', 'Act 4', 'Act 5', 'Rata', 'PAS', 'Akhir', 'Status']];
        const body = nilSiswaList.map((s, idx) => {
          const sId = s.SiswaID || s.siswaId || '';
          const acts = nilActMap[sId] || {};
          const validActs = Object.values(acts).filter(v => typeof v === 'number') as number[];
          const avgAct = validActs.length > 0 ? Math.round(validActs.reduce((a, b) => a + b, 0) / validActs.length) : 0;
          const pasVal = nilPasMap[sId] ?? 0;
          const finalScore = Math.round((avgAct * bobotAct + pasVal * bobotPas) / (bobotAct + bobotPas));
          const status = finalScore >= kkm ? 'TUNTAS' : 'REMEDI';

          return [
            idx + 1,
            s.NIS || s.nis || '',
            s.NamaSiswa || s.namaSiswa || s.nama || '',
            acts['act_1'] ?? '-',
            acts['act_2'] ?? '-',
            acts['act_3'] ?? '-',
            acts['act_4'] ?? '-',
            acts['act_5'] ?? '-',
            avgAct,
            pasVal,
            finalScore,
            status,
          ];
        });

        autoTable(doc, {
          startY: 52,
          head,
          body,
          theme: 'grid',
          headStyles: { fillColor: [0, 118, 133], textColor: 255, fontStyle: 'bold', fontSize: 8 },
          styles: { fontSize: 8, cellPadding: 2 },
        });
      } else if (activeTab === 'lkh') {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('LAPORAN JURNAL AKTIVITAS MENGAJAR (LKH)', 14, 42);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.text(`Nama Guru: ${currentUser?.namaTampilan || ''} | NIP: ${currentUser?.nip || ''}`, 14, 47);

        const head = [['No', 'Tanggal', 'Jenis', 'Mata Pelajaran', 'Jam Ke', 'Kelas', 'Uraian Aktivitas Kerja', 'Hasil Pembelajaran']];
        const body = lkhRecords.map((r, idx) => [
          idx + 1,
          r.Tanggal || r.tanggal || '',
          r.IsNonKbm || r.isNonKbm ? 'Non-KBM' : 'KBM',
          r.mapelNama || r.MataPelajaranID || '-',
          r.JamMulai ? `${r.JamMulai}-${r.JamSelesai}` : '-',
          r.Kelas || r.kelas || '-',
          r.UraianKerja || r.uraian || '',
          r.HasilPembelajaran || r.hasil || '',
        ]);

        autoTable(doc, {
          startY: 52,
          head,
          body,
          theme: 'grid',
          headStyles: { fillColor: [0, 118, 133], textColor: 255, fontStyle: 'bold', fontSize: 8 },
          styles: { fontSize: 8, cellPadding: 2 },
        });
      }

      // Teacher Digital Signature Bottom
      const finalY = (doc as any).lastAutoTable?.finalY || 140;
      if (finalY + 40 < doc.internal.pageSize.getHeight()) {
        const signX = doc.internal.pageSize.getWidth() - 70;
        doc.setFontSize(9);
        doc.text('Majalengka, ' + new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }), signX, finalY + 12);
        doc.text('Guru Mata Pelajaran,', signX, finalY + 17);

        if (currentUser?.parafUrl && currentUser.parafUrl.startsWith('data:image')) {
          try {
            doc.addImage(currentUser.parafUrl, 'PNG', signX, finalY + 19, 30, 15);
          } catch {}
        }

        doc.setFont('helvetica', 'bold');
        doc.text(currentUser?.namaTampilan || currentUser?.namaLengkap || 'Guru', signX, finalY + 38);
        doc.setFont('helvetica', 'normal');
        doc.text('NIP. ' + (currentUser?.nip || '-'), signX, finalY + 42);
      }

      doc.save(`Laporan_${activeTab.toUpperCase()}_MAN1Majalengka.pdf`);
      showToast('Laporan PDF resmi berhasil diunduh.', 'success');
    } catch (err: any) {
      showToast('Gagal membuat PDF: ' + err.message, 'error');
    }
  };

  // EXPORT WORD (HTML Document blob)
  const handleExportWord = () => {
    let content = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><title>Laporan MAN 1 Majalengka</title>
      <style>
        body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; }
        table { border-collapse: collapse; width: 100%; margin-top: 15px; }
        th, td { border: 1px solid #333; padding: 6px; text-align: left; }
        th { background-color: #007685; color: white; }
        .kop { text-align: center; border-bottom: 2px solid black; padding-bottom: 8px; margin-bottom: 12px; }
      </style>
      </head>
      <body>
        <div class="kop">
          <h3>KEMENTERIAN AGAMA REPUBLIK INDONESIA<br>MADRASAH ALIYAH NEGERI 1 MAJALENGKA</h3>
          <p>Jl. K.H. Abdul Halim No. 503 Majalengka</p>
        </div>
        <h4>REKAPITULASI LAPORAN ${activeTab.toUpperCase()}</h4>
        <p>Guru: ${currentUser?.namaTampilan || ''} | NIP: ${currentUser?.nip || ''}</p>
    `;

    if (activeTab === 'absensi') {
      content += `<table><tr><th>No</th><th>NIS</th><th>Nama Siswa</th><th>P1</th><th>P2</th><th>P3</th><th>H</th><th>S</th><th>I</th><th>A</th></tr>`;
      absSiswaList.forEach((s, idx) => {
        const sId = s.SiswaID || s.siswaId || '';
        const att = absMap[sId] || {};
        content += `<tr><td>${idx + 1}</td><td>${s.NIS || ''}</td><td>${s.NamaSiswa || ''}</td><td>${att['1'] || '-'}</td><td>${att['2'] || '-'}</td><td>${att['3'] || '-'}</td><td>${Object.values(att).filter(v => v === 'H').length}</td><td>${Object.values(att).filter(v => v === 'S').length}</td><td>${Object.values(att).filter(v => v === 'I').length}</td><td>${Object.values(att).filter(v => v === 'A').length}</td></tr>`;
      });
      content += `</table>`;
    } else if (activeTab === 'nilai') {
      content += `<table><tr><th>No</th><th>NIS</th><th>Nama Siswa</th><th>Act 1</th><th>Act 2</th><th>PAS</th><th>Nilai Akhir</th></tr>`;
      nilSiswaList.forEach((s, idx) => {
        const sId = s.SiswaID || s.siswaId || '';
        const acts = nilActMap[sId] || {};
        content += `<tr><td>${idx + 1}</td><td>${s.NIS || ''}</td><td>${s.NamaSiswa || ''}</td><td>${acts['act_1'] || '-'}</td><td>${acts['act_2'] || '-'}</td><td>${nilPasMap[sId] || '-'}</td><td>${acts['act_1'] || '-'}</td></tr>`;
      });
      content += `</table>`;
    } else {
      content += `<table><tr><th>No</th><th>Tanggal</th><th>Mapel</th><th>Kelas</th><th>Uraian Kerja</th><th>Hasil</th></tr>`;
      lkhRecords.forEach((r, idx) => {
        content += `<tr><td>${idx + 1}</td><td>${r.Tanggal || ''}</td><td>${r.mapelNama || ''}</td><td>${r.Kelas || ''}</td><td>${r.UraianKerja || ''}</td><td>${r.HasilPembelajaran || ''}</td></tr>`;
      });
      content += `</table>`;
    }

    content += `</body></html>`;
    const blob = new Blob(['\ufeff' + content], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Laporan_${activeTab.toUpperCase()}_MAN1Majalengka.doc`;
    a.click();
    showToast('Laporan Word berhasil diunduh.', 'success');
  };

  return (
    <div className="space-y-3.5 pb-24">
      {/* Tab Switcher */}
      <div className="bg-white/15 backdrop-blur-md p-1.5 rounded-2xl flex items-center space-x-1 border border-white/10 shadow-lg">
        <button
          onClick={() => setActiveTab('absensi')}
          className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeTab === 'absensi'
              ? 'bg-[#facc15] text-slate-900 shadow-md'
              : 'text-white/70 hover:text-white'
          }`}
        >
          Presensi
        </button>
        <button
          onClick={() => setActiveTab('nilai')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'nilai'
              ? 'bg-[#facc15] text-slate-900 shadow-md font-black'
              : 'text-white/70 hover:text-white'
          }`}
        >
          Penilaian
        </button>
        <button
          onClick={() => setActiveTab('lkh')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'lkh'
              ? 'bg-[#facc15] text-slate-900 shadow-md font-black'
              : 'text-white/70 hover:text-white'
          }`}
        >
          Jurnal LKH
        </button>
      </div>

      <div className="bg-[#002830]/80 backdrop-blur-2xl rounded-3xl p-4 text-white shadow-2xl border border-white/15 space-y-3.5">
        {/* Controls Row */}
        <div className="grid grid-cols-12 gap-2">
          {activeTab !== 'lkh' ? (
            <div className="col-span-7 sm:col-span-8">
              <select
                value={selectedPengajaranId}
                onChange={e => setSelectedPengajaranId(e.target.value)}
                className="w-full bg-[#00242c] border border-white/20 rounded-xl p-2.5 text-xs font-bold text-white outline-none cursor-pointer"
              >
                {pengajaranList.map((p, idx) => (
                  <option key={idx} value={`${p.mapelId}|${p.kelas}`}>
                    {p.mapelNama || p.mapelId} - Kelas {p.kelas}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="col-span-7 sm:col-span-8 flex items-center px-2">
              <span className="text-xs font-bold text-[#fde047]">
                Seluruh Jurnal LKH Guru
              </span>
            </div>
          )}

          <div className="col-span-5 sm:col-span-4 flex items-center gap-1.5 justify-end">
            <button
              onClick={handleExportExcel}
              className="px-2.5 py-2 bg-emerald-600/80 hover:bg-emerald-600 text-white rounded-xl text-[11px] font-extrabold flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
              title="Export Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>
            <button
              onClick={handleExportPdf}
              className="px-2.5 py-2 bg-rose-600/80 hover:bg-rose-600 text-white rounded-xl text-[11px] font-extrabold flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
              title="Export PDF Resmi"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
            <button
              onClick={handleExportWord}
              className="px-2 py-2 bg-blue-600/80 hover:bg-blue-600 text-white rounded-xl text-[11px] font-extrabold flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
              title="Export Word"
            >
              <span>Word</span>
            </button>
          </div>
        </div>

        {/* Setting sliders for Nilai ledger */}
        {activeTab === 'nilai' && (
          <div className="flex items-center justify-between bg-white/10 p-2.5 rounded-2xl text-[11px] font-bold text-white border border-white/10">
            <label className="flex items-center space-x-1">
              <span>KKM:</span>
              <input
                type="number"
                value={kkm}
                onChange={e => setKkm(parseInt(e.target.value, 10) || 75)}
                className="w-12 bg-white/20 text-white rounded-lg p-1 text-center font-bold border border-white/20"
              />
            </label>
            <label className="flex items-center space-x-1">
              <span>Bobot Act(%):</span>
              <input
                type="number"
                value={bobotAct}
                onChange={e => setBobotAct(parseInt(e.target.value, 10) || 66)}
                className="w-12 bg-white/20 text-white rounded-lg p-1 text-center font-bold border border-white/20"
              />
            </label>
            <label className="flex items-center space-x-1">
              <span>Bobot PAS(%):</span>
              <input
                type="number"
                value={bobotPas}
                onChange={e => setBobotPas(parseInt(e.target.value, 10) || 34)}
                className="w-12 bg-white/20 text-white rounded-lg p-1 text-center font-bold border border-white/20"
              />
            </label>
          </div>
        )}

        {/* Preview Table */}
        <div className="rounded-2xl border border-white/15 overflow-auto touch-scroll bg-[#00242c]/90 backdrop-blur-xl p-1 max-h-[calc(100vh-320px)] relative">
          {loading ? (
            <div className="text-center py-16 text-[#fde047] text-xs font-bold shimmer-box">
              Menyiapkan rekapitulasi data...
            </div>
          ) : activeTab === 'absensi' ? (
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="sticky top-0 bg-[#00242c] text-[#fde047] font-extrabold border-b border-white/20">
                <tr>
                  <th className="p-2">No</th>
                  <th className="p-2">NIS</th>
                  <th className="p-2">Nama Siswa</th>
                  {Array.from({ length: 12 }, (_, i) => (
                    <th key={i} className="p-2 text-center">
                      P{i + 1}
                    </th>
                  ))}
                  <th className="p-2 text-center text-emerald-400">H</th>
                  <th className="p-2 text-center text-amber-400">S</th>
                  <th className="p-2 text-center text-sky-400">I</th>
                  <th className="p-2 text-center text-rose-400">A</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 font-medium">
                {absSiswaList.map((s, idx) => {
                  const sId = s.SiswaID || s.siswaId || '';
                  const att = absMap[sId] || {};
                  let h = 0, sc = 0, ic = 0, a = 0;
                  Object.values(att).forEach(v => {
                    if (v === 'H') h++;
                    else if (v === 'S') sc++;
                    else if (v === 'I') ic++;
                    else if (v === 'A') a++;
                  });

                  return (
                    <tr key={idx} className="hover:bg-white/5">
                      <td className="p-2">{idx + 1}</td>
                      <td className="p-2 font-mono text-white/70">{s.NIS || s.nis || '-'}</td>
                      <td className="p-2 font-bold">{s.NamaSiswa || s.namaSiswa || s.nama}</td>
                      {Array.from({ length: 12 }, (_, i) => {
                        const st = att[String(i + 1)] || '-';
                        return (
                          <td key={i} className="p-2 text-center font-bold">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] ${
                                st === 'H'
                                  ? 'bg-emerald-500/20 text-emerald-300'
                                  : st === 'S'
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : st === 'I'
                                  ? 'bg-sky-500/20 text-sky-300'
                                  : st === 'A'
                                  ? 'bg-rose-500/20 text-rose-300'
                                  : 'text-white/30'
                              }`}
                            >
                              {st}
                            </span>
                          </td>
                        );
                      })}
                      <td className="p-2 text-center font-black text-emerald-400">{h}</td>
                      <td className="p-2 text-center font-bold text-amber-400">{sc}</td>
                      <td className="p-2 text-center font-bold text-sky-400">{ic}</td>
                      <td className="p-2 text-center font-bold text-rose-400">{a}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : activeTab === 'nilai' ? (
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="sticky top-0 bg-[#00242c] text-[#fde047] font-extrabold border-b border-white/20">
                <tr>
                  <th className="p-2">No</th>
                  <th className="p-2">NIS</th>
                  <th className="p-2">Nama Siswa</th>
                  <th className="p-2 text-center">Act 1</th>
                  <th className="p-2 text-center">Act 2</th>
                  <th className="p-2 text-center">Act 3</th>
                  <th className="p-2 text-center">Rata Format.</th>
                  <th className="p-2 text-center">PAS</th>
                  <th className="p-2 text-center text-[#fde047]">Nilai Akhir</th>
                  <th className="p-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 font-medium">
                {nilSiswaList.map((s, idx) => {
                  const sId = s.SiswaID || s.siswaId || '';
                  const acts = nilActMap[sId] || {};
                  const validActs = Object.values(acts).filter(v => typeof v === 'number') as number[];
                  const avgAct =
                    validActs.length > 0
                      ? Math.round(validActs.reduce((a, b) => a + b, 0) / validActs.length)
                      : 0;
                  const pasVal = nilPasMap[sId] ?? 0;
                  const finalScore = Math.round(
                    (avgAct * bobotAct + pasVal * bobotPas) / (bobotAct + bobotPas)
                  );
                  const isTuntas = finalScore >= kkm;

                  return (
                    <tr key={idx} className="hover:bg-white/5">
                      <td className="p-2">{idx + 1}</td>
                      <td className="p-2 font-mono text-white/70">{s.NIS || s.nis || '-'}</td>
                      <td className="p-2 font-bold">{s.NamaSiswa || s.namaSiswa || s.nama}</td>
                      <td className="p-2 text-center">{acts['act_1'] ?? '-'}</td>
                      <td className="p-2 text-center">{acts['act_2'] ?? '-'}</td>
                      <td className="p-2 text-center">{acts['act_3'] ?? '-'}</td>
                      <td className="p-2 text-center font-bold">{avgAct}</td>
                      <td className="p-2 text-center font-bold">{pasVal}</td>
                      <td className="p-2 text-center font-black text-sm text-[#fde047]">
                        {finalScore}
                      </td>
                      <td className="p-2 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                            isTuntas
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {isTuntas ? 'TUNTAS' : 'REMEDI'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="sticky top-0 bg-[#00242c] text-[#fde047] font-extrabold border-b border-white/20">
                <tr>
                  <th className="p-2">No</th>
                  <th className="p-2">Tanggal</th>
                  <th className="p-2">Mata Pelajaran</th>
                  <th className="p-2">Kelas</th>
                  <th className="p-2">Jam Ke</th>
                  <th className="p-2">Uraian Tugas / KBM</th>
                  <th className="p-2">Hasil Pembelajaran</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 font-medium">
                {lkhRecords.map((r, idx) => (
                  <tr key={idx} className="hover:bg-white/5">
                    <td className="p-2">{idx + 1}</td>
                    <td className="p-2 font-bold">{r.Tanggal || r.tanggal || '-'}</td>
                    <td className="p-2">
                      {r.IsNonKbm || r.isNonKbm ? 'Non-KBM' : r.mapelNama || r.MataPelajaranID}
                    </td>
                    <td className="p-2">{r.Kelas || r.kelas || '-'}</td>
                    <td className="p-2 text-center">
                      {r.JamMulai ? `${r.JamMulai}-${r.JamSelesai}` : '-'}
                    </td>
                    <td className="p-2 truncate max-w-xs">{r.UraianKerja || r.uraian}</td>
                    <td className="p-2 truncate max-w-xs">{r.HasilPembelajaran || r.hasil}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
