import * as pdfjsLib from 'pdfjs-dist';

// Inisialisasi PDF.js Worker untuk browser
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
}

export interface ParsedStudentItem {
  noUrut: number;
  nis: string;
  nisn?: string;
  namaSiswa: string;
  rawNama: string;
  kelasAsal?: string;
  isLintasRombel: boolean;
}

export interface ParsedPdfResult {
  success: boolean;
  error?: string;
  detectedKelas?: string;
  detectedWaliKelas?: string;
  detectedMapel?: string;
  detectedSemester?: string;
  totalStudents: number;
  students: ParsedStudentItem[];
}

/**
 * Ekstraksi teks per halaman dengan mengelompokkan item berdasarkan koordinat vertikal (baris)
 */
async function extractLinesFromPdf(arrayBuffer: ArrayBuffer): Promise<string[]> {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  });

  const doc = await loadingTask.promise;
  const allLines: string[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();

    interface PositionedItem {
      str: string;
      x: number;
      y: number;
    }

    const items: PositionedItem[] = [];
    for (const item of content.items) {
      if ('str' in item && item.str.trim()) {
        const x = item.transform[4];
        const y = item.transform[5];
        items.push({ str: item.str, x, y });
      }
    }

    // Kelompokkan item teks yang berada pada baris vertikal yang sama (toleransi Y = 3.5px)
    items.sort((a, b) => b.y - a.y || a.x - b.x);

    const lineGroups: PositionedItem[][] = [];
    for (const item of items) {
      let placed = false;
      for (const group of lineGroups) {
        if (Math.abs(group[0].y - item.y) <= 3.5) {
          group.push(item);
          placed = true;
          break;
        }
      }
      if (!placed) {
        lineGroups.push([item]);
      }
    }

    // Sort tiap baris berdasarkan posisi horizontal (X) dari kiri ke kanan
    for (const group of lineGroups) {
      group.sort((a, b) => a.x - b.x);
      const lineStr = group.map(i => i.str.trim()).filter(Boolean).join(' ');
      if (lineStr) {
        allLines.push(lineStr);
      }
    }
  }

  return allLines;
}

/**
 * Parsing cerdas teks berkas PDF Daftar Hadir / Data Siswa Madrasah
 */
export async function parsePdfDataSiswa(fileOrBuffer: File | ArrayBuffer): Promise<ParsedPdfResult> {
  try {
    let buffer: ArrayBuffer;
    if (fileOrBuffer instanceof File) {
      buffer = await fileOrBuffer.arrayBuffer();
    } else {
      buffer = fileOrBuffer;
    }

    const lines = await extractLinesFromPdf(buffer);
    const fullText = lines.join('\n');

    // 1. Deteksi Metadata Header
    let detectedKelas: string | undefined;
    const kelasMatch = fullText.match(/KELAS\s*[:\s]\s*([X|XI|XII]+[\.\s]*\d+)/i);
    if (kelasMatch) {
      detectedKelas = kelasMatch[1].replace(/\s+/g, '.').toUpperCase();
    }

    let detectedMapel: string | undefined;
    const mapelMatch = fullText.match(/MATA\s*PELAJARAN\s*[:\s]\s*([A-Za-z0-9\s]+?)(?=\s*SEMESTER|\s*FASE|\s*WALI|$)/i);
    if (mapelMatch) {
      detectedMapel = mapelMatch[1].trim();
    }

    let detectedWaliKelas: string | undefined;
    const waliMatch = fullText.match(/WALI\s*KELAS\s*[:\s]\s*([A-Za-z0-9\s\.,]+?)(?=\s*MATA|\s*FASE|\s*SEMESTER|\s*SEKOLAH|$)/i);
    if (waliMatch) {
      detectedWaliKelas = waliMatch[1].trim();
    }

    let detectedSemester: string | undefined;
    const semesterMatch = fullText.match(/SEMESTER\s*[:\s]*([12]|Ganjil|Genap)/i);
    if (semesterMatch) {
      detectedSemester = semesterMatch[1].trim();
    }

    // 2. Deteksi Baris Siswa (No, NIS, Nama Murid)
    const students: ParsedStudentItem[] = [];
    const seenNis = new Set<string>();

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Pola: Nomor Urut (1-50), NIS (4-10 digit), Nama Siswa
      // Contoh: "1 250169 ABDUL BARRY" atau "34 250072 ALDINAR M. MALIK I.(XI.10)"
      const match = trimmed.match(/^(\d{1,2})\s+(\d{4,10})\s+(.+)$/);
      if (match) {
        const noUrut = parseInt(match[1], 10);
        const nis = match[2].trim();
        let rawContent = match[3].trim();

        // Abaikan jika baris header tabel atau salah tangkap
        if (/^(PERTEMUAN|TANGGAL|NAMA|TOTAL|TOTAL|JUMLAH)/i.test(rawContent)) {
          continue;
        }

        // Pisahkan nama dari kemungkinan angka-angka grid pertemuan di ujung kanan
        // Nama siswa umumnya alfabet, spasi, titik, koma, tanda petik, dan kurung kelas
        const namePartMatch = rawContent.match(/^([A-Za-z\s\.\'’\`\/\-\(\)\d]+?)(?:\s+\d{1,2}\s+\d{1,2}|\s+[HSI A]{1,4}|$)/);
        let extractedName = namePartMatch ? namePartMatch[1].trim() : rawContent;

        // Cek anotasi rombel asal seperti (XI.10) atau (X.2)
        let kelasAsal: string | undefined;
        const crossMatch = extractedName.match(/\s*\(((?:X|XI|XII)[\.\s]*\d+)\)\s*$/i);
        if (crossMatch) {
          kelasAsal = crossMatch[1].replace(/\s+/g, '.').toUpperCase();
          extractedName = extractedName.replace(/\s*\(((?:X|XI|XII)[\.\s]*\d+)\)\s*$/i, '').trim();
        }

        // Rapikan tanda petik / apostrof nama (misal: M.HAPIZ MA`RUP -> M.HAPIZ MA'RUP)
        const cleanName = extractedName.replace(/[`´’]/g, "'").replace(/\s+/g, ' ').trim();

        if (cleanName.length >= 2 && !seenNis.has(nis)) {
          seenNis.add(nis);
          students.push({
            noUrut,
            nis,
            namaSiswa: cleanName,
            rawNama: rawContent,
            kelasAsal,
            isLintasRombel: Boolean(kelasAsal),
          });
        }
      }
    }

    if (students.length === 0) {
      return {
        success: false,
        error: 'Tidak ditemukan baris data siswa yang sesuai pada berkas PDF. Pastikan format tabel memuat No, NIS, dan Nama Siswa.',
        totalStudents: 0,
        students: [],
      };
    }

    return {
      success: true,
      detectedKelas,
      detectedWaliKelas,
      detectedMapel,
      detectedSemester,
      totalStudents: students.length,
      students,
    };
  } catch (err: any) {
    return {
      success: false,
      error: 'Gagal memproses berkas PDF: ' + (err?.message || 'Format PDF tidak dapat dibaca'),
      totalStudents: 0,
      students: [],
    };
  }
}
