/**
 * APLIKASI AJAR (Administrasi & Jurnal Aktivitas Mengajar)
 * MAN 1 MAJALENGKA
 * Backend Engine - Hardened & Ultra-Accelerated In-Memory Batch Engine V11
 */

var SESSION_TTL_HOURS = 8;
var SESSION_TTL_SECONDS = SESSION_TTL_HOURS * 3600;
var CACHE_TTL_SECONDS = 6 * 3600; // 6 Jam CacheService
var PBKDF2_ITERATIONS = 1000; 

function getDbSpreadsheet() {
  var props = PropertiesService.getScriptProperties();
  var dbId = props.getProperty('SPREADSHEET_ID');
  if (!dbId) {
    throw new Error('Spreadsheet ID belum dikonfigurasi pada Script Properties!');
  }
  return SpreadsheetApp.openById(dbId);
}

function doGet(e) {
  // Jika diakses sebagai REST API ping / health-check
  if (e && e.parameter && (e.parameter.api === '1' || e.parameter.ping === '1')) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'ok',
      service: 'AJAR Google Apps Script API Gateway',
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  }

  var template = HtmlService.createTemplateFromFile('Index');
  return template.evaluate()
    .setTitle('AJAR - MAN 1 Majalengka')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * REST API Gateway untuk Vercel / External HTTP Clients
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Payload request kosong' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var payload = JSON.parse(e.postData.contents);
    var action = payload.action || payload.functionName;
    var args = payload.args || [];

    var publicApiMap = {
      'loginUser': loginUser,
      'registerGuru': registerGuru,
      'getReferencesData': getReferencesData,
      'getUserProfile': getUserProfile,
      'updateProfile': updateProfile,
      'uploadMediaFile': uploadMediaFile,
      'getDashboardData': getDashboardData,
      'getMasterAjarData': getMasterAjarData,
      'saveMasterAjar': saveMasterAjar,
      'getTeacherClasses': getTeacherClasses,
      'getMasterSiswa': getMasterSiswa,
      'saveSiswaManual': saveSiswaManual,
      'deleteSiswa': deleteSiswa,
      'bulkUploadSiswa': bulkUploadSiswa,
      'getAbsensiData': getAbsensiData,
      'saveAbsensiData': saveAbsensiData,
      'getNilaiData': getNilaiData,
      'saveNilaiData': saveNilaiData,
      'getPengajaranGuru': getPengajaranGuru,
      'getLkhInitialData': getLkhInitialData,
      'getLkhData': getLkhData,
      'saveLkhRecord': saveLkhRecord,
      'deleteLkhRecord': deleteLkhRecord,
      'renewUserSession': renewUserSession
    };

    if (typeof publicApiMap[action] !== 'function') {
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Action tidak dikenali: ' + action }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var result = publicApiMap[action].apply(null, args);
    return ContentService.createTextOutput(JSON.stringify(result !== undefined ? result : { success: true }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Internal Server Error: ' + error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getActiveAcademicYear() {
  var now = new Date();
  var year = now.getFullYear();
  var month = now.getMonth();
  if (month >= 6) {
    return year + '/' + (year + 1);
  } else {
    return (year - 1) + '/' + year;
  }
}

// ============================================================================
// CACHE SERVICE HELPERS (6 JAM TTL UNTUK REFERENSI & DATA STATIS)
// ============================================================================

function getFromCache(key) {
  try {
    var cache = CacheService.getScriptCache();
    var val = cache.get(key);
    if (val) {
      return JSON.parse(val);
    }
  } catch (e) {}
  return null;
}

function putToCache(key, data, ttlSeconds) {
  try {
    var cache = CacheService.getScriptCache();
    var str = JSON.stringify(data);
    // CacheService limit per item is 100KB
    if (str.length < 100000) {
      cache.put(key, str, ttlSeconds || CACHE_TTL_SECONDS);
    }
  } catch (e) {}
}

function removeFromCache(key) {
  try {
    var cache = CacheService.getScriptCache();
    cache.remove(key);
  } catch (e) {}
}

// ============================================================================
// CANONICAL DATABASE HELPER FUNCTIONS
// ============================================================================

function getSheetDataAsObjects(sheet) {
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  return data.map(function(row, index) {
    var obj = { _rowIndex: index + 2 };
    headers.forEach(function(header, colIndex) {
      if (header) {
        var val = row[colIndex];
        if (val instanceof Date) {
          val = val.toISOString();
        }
        obj[header] = val;
      }
    });
    return obj;
  });
}

function getColumnIndex(sheet, colName) {
  if (!sheet) return -1;
  var lastCol = sheet.getLastColumn();
  if (lastCol < 1) return -1;
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i]).trim().toLowerCase() === String(colName).trim().toLowerCase()) {
      return i + 1;
    }
  }
  return -1;
}

function getHeaderIndexMap(headersRow) {
  var map = {};
  for (var i = 0; i < headersRow.length; i++) {
    var h = String(headersRow[i] || '').trim();
    if (h) {
      map[h.toLowerCase()] = i;
    }
  }
  return map;
}

/**
 * Generator NIS Otomatis Berurutan
 */
function generateNextNIS(sheetSiswa) {
  var currentYear = new Date().getFullYear().toString();
  var baseNIS = parseInt(currentYear + '0001', 10);
  
  var allSiswa = getSheetDataAsObjects(sheetSiswa);
  var maxNIS = 0;
  
  allSiswa.forEach(function(s) {
    var val = String(s.NIS || s.nis || '').replace(/[^0-9]/g, '');
    if (val) {
      var num = parseInt(val, 10);
      if (num > maxNIS) maxNIS = num;
    }
  });

  if (maxNIS >= baseNIS) {
    return String(maxNIS + 1);
  } else if (maxNIS > 0 && String(maxNIS).length >= 4) {
    return String(maxNIS + 1);
  } else {
    return String(baseNIS);
  }
}

function logActivity(userId, action, module, description) {
  try {
    var ss = getDbSpreadsheet();
    var sheet = ss.getSheetByName('14_LOG_AKTIVITAS');
    if (!sheet) return;
    var logId = 'LOG-' + Utilities.getUuid().substring(0, 8).toUpperCase();
    sheet.appendRow([logId, userId || 'SYSTEM', action, module, description, new Date()]);
  } catch (e) {}
}


function resolveParafDataUrl(userRecord) {
  try {
    if (!userRecord) return '';
    var pUrl = String(userRecord.ParafGuruURL || userRecord.parafUrl || userRecord.ParafURL || '').trim();
    if (!pUrl) return '';
    if (pUrl.indexOf('data:image/') === 0) return pUrl;
    var fileId = String(userRecord.ParafGuruFileID || '').trim();
    if (!fileId && pUrl.indexOf('/d/') !== -1) {
      var parts = pUrl.split('/d/');
      if (parts[1]) fileId = parts[1].split('/')[0].split('?')[0];
    }
    if (fileId) {
      var cacheKey = 'paraf_b64_' + fileId;
      var cached = getFromCache(cacheKey);
      if (cached) return cached;
      var file = DriveApp.getFileById(fileId);
      var blob = file.getBlob();
      var b64 = 'data:' + (blob.getContentType() || 'image/png') + ';base64,' + Utilities.base64Encode(blob.getBytes());
      putToCache(cacheKey, b64, CACHE_TTL_SECONDS);
      return b64;
    }
    return pUrl;
  } catch (e) {
    return String((userRecord && (userRecord.ParafGuruURL || userRecord.parafUrl)) || '').trim();
  }
}

function resolveJabatanName(jabatanVal, ss) {
  if (!jabatanVal) return '-';
  try {
    var refData = getReferencesData();
    if (refData && refData.references && refData.references.Jabatan) {
      var found = refData.references.Jabatan.find(function(r) {
        return String(r.id) === String(jabatanVal) || 
               String(r.code) === String(jabatanVal) || 
               String(r.name) === String(jabatanVal);
      });
      if (found) return found.name;
    }
    return jabatanVal;
  } catch(e) {
    return jabatanVal;
  }
}

// ============================================================================
// SECURITY, CRYPTO & SESSION ENGINE
// ============================================================================

function hashToken(token) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(token || ''), Utilities.Charset.UTF_8);
  return digest.map(function(b) {
    var hex = (b < 0 ? b + 256 : b).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

function generateSessionToken() {
  return Utilities.getUuid() + '-' + Utilities.getUuid();
}

function createSession(user) {
  var rawToken = generateSessionToken();
  var tHash = hashToken(rawToken);
  var cache = CacheService.getScriptCache();
  var sessionData = {
    userId: user.UserID || user.userId,
    username: String(user.Username || user.username || '').replace(/'/g, '').trim(),
    role: user.Role || user.role || 'GURU',
    createdAt: new Date().getTime(),
    lastActivity: new Date().getTime()
  };
  cache.put('session:' + tHash, JSON.stringify(sessionData), SESSION_TTL_SECONDS);
  return rawToken;
}

function requireAuth(token) {
  if (!token || typeof token !== 'string') {
    throw new Error('AUTH_REQUIRED');
  }
  var tHash = hashToken(token);
  var cached = CacheService.getScriptCache().get('session:' + tHash);
  if (!cached) {
    throw new Error('SESSION_EXPIRED');
  }

  var sessionObj = JSON.parse(cached);
  var ss = getDbSpreadsheet();
  var users = getSheetDataAsObjects(ss.getSheetByName('01_USERS'));
  var user = users.find(function(u) { return (u.UserID || u.userId) === sessionObj.userId; });

  if (!user || String(user.Status || user.status || 'ACTIVE').toUpperCase() !== 'ACTIVE') {
    throw new Error('SESSION_INVALID');
  }

  sessionObj.lastActivity = new Date().getTime();
  CacheService.getScriptCache().put('session:' + tHash, JSON.stringify(sessionObj), SESSION_TTL_SECONDS);

  return {
    userId: user.UserID || user.userId,
    role: user.Role || user.role || 'GURU',
    username: String(user.Username || user.username || '').replace(/'/g, '').trim(),
    userRecord: user
  };
}

function pbkdf2HmacSha256(password, saltStr, iterations, keyByteLen) {
  iterations = iterations || PBKDF2_ITERATIONS;
  keyByteLen = keyByteLen || 32;
  var passBytes = Utilities.newBlob(String(password || '')).getBytes();
  var saltBytes = Utilities.newBlob(String(saltStr || '')).getBytes();

  var blocks = Math.ceil(keyByteLen / 32);
  var result = [];

  for (var i = 1; i <= blocks; i++) {
    var blockInt = [(i >> 24) & 0xff, (i >> 16) & 0xff, (i >> 8) & 0xff, i & 0xff];
    var saltAndInt = saltBytes.concat(blockInt);
    var u = Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_256, saltAndInt, passBytes);
    var f = u.slice();

    for (var j = 1; j < iterations; j++) {
      u = Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_256, u, passBytes);
      for (var k = 0; k < u.length; k++) {
        f[k] ^= u[k];
      }
    }
    result = result.concat(f);
  }

  return result.slice(0, keyByteLen).map(function(b) {
    var hex = (b < 0 ? b + 256 : b).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

function generateSalt() {
  return Utilities.getUuid().substring(0, 8);
}

// ============================================================================
// AUTHENTICATION & USER API
// ============================================================================

function loginUser(usernameOrNip, password) {
  try {
    if (!usernameOrNip || !password) {
      return { success: false, message: 'Username/NIP dan Password wajib diisi!' };
    }

    var ss = getDbSpreadsheet();
    var sheetUsers = ss.getSheetByName('01_USERS');
    if (!sheetUsers) return { success: false, message: 'Tabel Users belum siap.' };

    var users = getSheetDataAsObjects(sheetUsers);
    var displayValues = [];
    var lastRow = sheetUsers.getLastRow();
    var lastCol = sheetUsers.getLastColumn();
    if (lastRow >= 2 && lastCol >= 1) {
      displayValues = sheetUsers.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();
    }
    
    var colHeaders = sheetUsers.getRange(1, 1, 1, Math.max(1, lastCol)).getValues()[0].map(function(h) {
      return String(h).trim().toLowerCase();
    });

    var inputStr = String(usernameOrNip).trim();
    var inputClean = inputStr.replace(/['\s]/g, '').toLowerCase();
    var inputDigits = inputStr.replace(/[^0-9]/g, '');

    var user = null;

    for (var i = 0; i < users.length; i++) {
      var u = users[i];
      var rawUsername = u.Username !== undefined ? u.Username : (u.username || u.USERNAME || '');
      var uName = String(rawUsername).replace(/['\s]/g, '').toLowerCase();

      var rawNip = u.NIP !== undefined ? u.NIP : (u.nip || u.Nip || '');
      var uNipStr = (typeof rawNip === 'number') ? rawNip.toFixed(0) : String(rawNip).replace(/['\s]/g, '');
      var uNipDigits = uNipStr.replace(/[^0-9]/g, '');

      var matchFound = false;
      if (inputClean && (uName === inputClean || uNipStr.toLowerCase() === inputClean)) {
        matchFound = true;
      } else if (inputDigits && inputDigits.length >= 8 && (uNipDigits === inputDigits || uName === inputDigits)) {
        matchFound = true;
      }

      if (!matchFound && displayValues[i]) {
        for (var c = 0; c < displayValues[i].length; c++) {
          var headerName = colHeaders[c] || '';
          if (headerName === 'username' || headerName === 'nip') {
            var dispVal = String(displayValues[i][c] || '').replace(/['\s]/g, '').toLowerCase();
            var dispDigits = String(displayValues[i][c] || '').replace(/[^0-9]/g, '');
            if (dispVal === inputClean || (inputDigits && inputDigits.length >= 8 && dispDigits === inputDigits)) {
              matchFound = true;
              break;
            }
          }
        }
      }

      if (matchFound) {
        user = u;
        break;
      }
    }

    if (!user) {
      return { success: false, message: 'Username/NIP atau Password salah!' };
    }

    var userStatus = String(user.Status || user.status || 'ACTIVE').toUpperCase();
    if (userStatus !== 'ACTIVE') {
      return { success: false, message: 'Akun Anda tidak aktif.' };
    }

    var storedHash = String(user.PasswordHash || user.passwordHash || user.Password || user.password || '').trim();
    var salt = String(user.PasswordSalt || user.passwordSalt || user.Salt || user.salt || '').trim();

    var isPasswordValid = false;
    var inputPwd = String(password).trim();

    if (storedHash) {
      if (inputPwd === storedHash) {
        isPasswordValid = true;
      }
      
      if (!isPasswordValid) {
        var calculatedHash = pbkdf2HmacSha256(inputPwd, salt, PBKDF2_ITERATIONS, 32);
        if (calculatedHash.toLowerCase() === storedHash.toLowerCase()) {
          isPasswordValid = true;
        }
      }

      if (!isPasswordValid) {
        try {
          var rawWithSalt = salt ? (inputPwd + salt) : inputPwd;
          var digestBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, rawWithSalt, Utilities.Charset.UTF_8);
          var hexSha256 = digestBytes.map(function(b) {
            var hex = (b < 0 ? b + 256 : b).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
          }).join('');
          if (hexSha256.toLowerCase() === storedHash.toLowerCase()) {
            isPasswordValid = true;
          }
        } catch (e) {}
      }
    }

    if (!isPasswordValid) {
      return { success: false, message: 'Username/NIP atau Password salah!' };
    }

    var token = createSession(user);
    logActivity(user.UserID || user.userId, 'LOGIN', 'AUTH', 'User login berhasil: ' + (user.Username || user.username || inputStr));

    var rawNipVal = user.NIP !== undefined ? user.NIP : (user.nip || '');
    var cleanNipVal = (typeof rawNipVal === 'number') ? rawNipVal.toFixed(0) : String(rawNipVal || '').replace(/['\s]/g, '');

    return {
      success: true,
      token: token,
      user: {
        userId: user.UserID || user.userId || '',
        username: String(user.Username || user.username || '').replace(/['\s]/g, ''),
        namaLengkap: user.NamaLengkap || user.namaLengkap || '',
        namaTampilan: user.NamaTampilan || user.namaTampilan || user.NamaLengkap || user.namaLengkap || '',
        nip: cleanNipVal,
        jabatan: resolveJabatanName(user.JabatanID || user.jabatanId, ss),
        jabatanId: user.JabatanID || user.jabatanId || '',
        gelarDepan: user.GelarDepan || user.gelarDepan || '',
        gelarBelakang: user.GelarBelakang || user.gelarBelakang || '',
        namaAtasan: user.NamaAtasan || user.namaAtasan || '',
        fotoUrl: user.FotoURL || user.fotoUrl || '',
        parafUrl: resolveParafDataUrl(user)
      }
    };
  } catch (err) {
    return { success: false, message: 'Gagal login: ' + err.message };
  }
}

function registerGuru(data) {
  try {
    if (!data.namaLengkap || !data.nip || !data.password) {
      return { success: false, message: 'Lengkapi seluruh data wajib!' };
    }
    if (data.password !== data.confirmPassword) {
      return { success: false, message: 'Konfirmasi password tidak sesuai!' };
    }

    var ss = getDbSpreadsheet();
    var sheetUsers = ss.getSheetByName('01_USERS');
    var users = getSheetDataAsObjects(sheetUsers);
    var cleanNip = String(data.nip).replace(/[^0-9]/g, '').trim();

    var existing = users.find(function(u) {
      return String(u.NIP || '').replace(/[^0-9]/g, '') === cleanNip;
    });

    if (existing) {
      return { success: false, message: 'NIP sudah terdaftar!' };
    }

    var salt = generateSalt();
    var hash = pbkdf2HmacSha256(data.password, salt, PBKDF2_ITERATIONS, 32);
    var userId = 'USR-' + Utilities.getUuid().substring(0, 8).toUpperCase();
    var now = new Date();
    var namaTampilan = (data.gelarDepan ? data.gelarDepan + ' ' : '') + data.namaLengkap.trim() + (data.gelarBelakang ? ', ' + data.gelarBelakang : '');

    sheetUsers.appendRow([
      userId,
      data.gelarDepan || '',
      data.namaLengkap.trim(),
      data.gelarBelakang || '',
      namaTampilan,
      cleanNip,
      'MAN 1 Majalengka',
      data.jabatanId || '',
      'GURU',
      cleanNip,
      hash,
      salt,
      '', '', '', '',
      'Iyan Arif Hasyim, S.Pd, M.Pd',
      'ACTIVE',
      now, now, '', 2
    ]);

    logActivity(userId, 'REGISTER', 'AUTH', 'Registrasi guru baru berhasil: ' + namaTampilan);
    return { success: true, message: 'Registrasi akun berhasil! Silakan login.' };
  } catch (err) {
    return { success: false, message: 'Gagal mendaftar: ' + err.message };
  }
}

/**
 * Mengambil data referensi dengan CACHE SERVICE (6 Jam)
 */
function getReferencesData() {
  try {
    var cacheKey = 'ref_data_v11';
    var cached = getFromCache(cacheKey);
    if (cached) {
      return { success: true, references: cached };
    }

    var ss = getDbSpreadsheet();
    var refs = getSheetDataAsObjects(ss.getSheetByName('10_REFERENSI'));
    var map = { GelarDepan: [], GelarBelakang: [], Jabatan: [], MataPelajaran: [], Kelas: [], UraianKerja: [], Hasil: [] };

    refs.forEach(function(r) {
      if (String(r.Status || 'ACTIVE').toUpperCase() === 'ACTIVE') {
        var type = r.ReferenceType;
        if (map[type]) {
          map[type].push({ id: r.ReferenceID, code: r.ReferenceCode, name: r.ReferenceName });
        }
      }
    });

    putToCache(cacheKey, map, CACHE_TTL_SECONDS);
    return { success: true, references: map };
  } catch (err) {
    return { success: false, references: { GelarDepan: [], GelarBelakang: [], Jabatan: [], MataPelajaran: [], Kelas: [], UraianKerja: [], Hasil: [] } };
  }
}

function getUserProfile(token) {
  try {
    var session = requireAuth(token);
    var ss = getDbSpreadsheet();
    var u = session.userRecord;
    return {
      userId: u.UserID || u.userId,
      username: u.Username || u.username,
      namaLengkap: u.NamaLengkap || u.namaLengkap,
      namaTampilan: u.NamaTampilan || u.namaTampilan || u.NamaLengkap,
      nip: u.NIP || u.nip,
      jabatan: resolveJabatanName(u.JabatanID || u.jabatanId, ss),
      jabatanId: u.JabatanID || u.jabatanId,
      gelarDepan: u.GelarDepan || u.gelarDepan,
      gelarBelakang: u.GelarBelakang || u.gelarBelakang,
      namaAtasan: u.NamaAtasan || u.namaAtasan,
      fotoUrl: u.FotoURL || u.fotoUrl,
      parafUrl: resolveParafDataUrl(u)
    };
  } catch (e) {
    return null;
  }
}

function updateProfile(token, payload) {
  try {
    var session = requireAuth(token);
    var ss = getDbSpreadsheet();
    var sheetUsers = ss.getSheetByName('01_USERS');
    var users = getSheetDataAsObjects(sheetUsers);
    var user = users.find(function(u) { return (u.UserID || u.userId) === session.userId; });

    if (!user) return { success: false, message: 'Pengguna tidak ditemukan.' };

    var rowIdx = user._rowIndex;

    if (payload.type === 'NAMA_GELAR') {
      var colG = getColumnIndex(sheetUsers, 'GelarDepan');
      var colN = getColumnIndex(sheetUsers, 'NamaLengkap');
      var colB = getColumnIndex(sheetUsers, 'GelarBelakang');
      var colT = getColumnIndex(sheetUsers, 'NamaTampilan');

      if (colG > 0) sheetUsers.getRange(rowIdx, colG).setValue(payload.gelarDepan || '');
      if (colN > 0) sheetUsers.getRange(rowIdx, colN).setValue(payload.namaLengkap);
      if (colB > 0) sheetUsers.getRange(rowIdx, colB).setValue(payload.gelarBelakang || '');
      var tampilan = (payload.gelarDepan ? payload.gelarDepan + ' ' : '') + payload.namaLengkap + (payload.gelarBelakang ? ', ' + payload.gelarBelakang : '');
      if (colT > 0) sheetUsers.getRange(rowIdx, colT).setValue(tampilan);

    } else if (payload.type === 'JABATAN') {
      var colJ = getColumnIndex(sheetUsers, 'JabatanID');
      if (colJ > 0) sheetUsers.getRange(rowIdx, colJ).setValue(payload.jabatan);

    } else if (payload.type === 'ATASAN') {
      var colA = getColumnIndex(sheetUsers, 'NamaAtasan');
      if (colA > 0) sheetUsers.getRange(rowIdx, colA).setValue(payload.namaAtasan);

    } else if (payload.type === 'USERNAME') {
      var colU = getColumnIndex(sheetUsers, 'Username');
      if (colU > 0) sheetUsers.getRange(rowIdx, colU).setValue(payload.username);

    } else if (payload.type === 'PASSWORD') {
      var currentHash = pbkdf2HmacSha256(payload.currentPassword, user.PasswordSalt || user.Salt, PBKDF2_ITERATIONS, 32);
      if (currentHash !== (user.PasswordHash || user.Password)) return { success: false, message: 'Password saat ini salah!' };
      
      var newSalt = generateSalt();
      var newHash = pbkdf2HmacSha256(payload.newPassword, newSalt, PBKDF2_ITERATIONS, 32);
      sheetUsers.getRange(rowIdx, getColumnIndex(sheetUsers, 'PasswordHash')).setValue(newHash);
      sheetUsers.getRange(rowIdx, getColumnIndex(sheetUsers, 'PasswordSalt')).setValue(newSalt);
    }

    var colUp = getColumnIndex(sheetUsers, 'UpdatedAt');
    if (colUp > 0) sheetUsers.getRange(rowIdx, colUp).setValue(new Date());

    var updatedUsers = getSheetDataAsObjects(sheetUsers);
    var updatedU = updatedUsers.find(function(u) { return (u.UserID || u.userId) === session.userId; });

    return {
      success: true,
      message: 'Profil berhasil diperbarui!',
      user: {
        userId: updatedU.UserID || updatedU.userId,
        username: updatedU.Username || updatedU.username,
        namaLengkap: updatedU.NamaLengkap || updatedU.namaLengkap,
        namaTampilan: updatedU.NamaTampilan || updatedU.namaTampilan || updatedU.NamaLengkap,
        nip: updatedU.NIP || updatedU.nip,
        jabatan: resolveJabatanName(updatedU.JabatanID || updatedU.jabatanId, ss),
        jabatanId: updatedU.JabatanID || updatedU.jabatanId,
        gelarDepan: updatedU.GelarDepan || updatedU.gelarDepan,
        gelarBelakang: updatedU.GelarBelakang || updatedU.gelarBelakang,
        namaAtasan: updatedU.NamaAtasan || updatedU.namaAtasan,
        fotoUrl: updatedU.FotoURL || updatedU.fotoUrl,
        parafUrl: resolveParafDataUrl(updatedU)
      }
    };
  } catch (err) {
    return { success: false, message: 'Gagal memperbarui profil: ' + err.message };
  }
}

function uploadMediaFile(token, base64, fileName, mimeType, type) {
  try {
    var session = requireAuth(token);
    var blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, fileName);
    var folder = DriveApp.getRootFolder();
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var fileUrl = "https://lh3.googleusercontent.com/d/" + file.getId();

    var ss = getDbSpreadsheet();
    var sheetUsers = ss.getSheetByName('01_USERS');
    var users = getSheetDataAsObjects(sheetUsers);
    var user = users.find(function(u) { return (u.UserID || u.userId) === session.userId; });

    if (user) {
      var col = (type === 'FOTO') ? getColumnIndex(sheetUsers, 'FotoURL') : getColumnIndex(sheetUsers, 'ParafGuruURL');
      if (col > 0) sheetUsers.getRange(user._rowIndex, col).setValue(fileUrl);
    }

    var parafDataUrl = (type === 'PARAF') ? ('data:' + (mimeType || 'image/png') + ';base64,' + base64) : '';
    return { success: true, message: 'Upload berkas berhasil!', fileUrl: fileUrl, parafDataUrl: parafDataUrl };
  } catch (err) {
    return { success: false, message: 'Gagal upload berkas: ' + err.message };
  }
}

// ============================================================================
// DASHBOARD & MASTER AJAR SERVICES (ACCELERATED)
// ============================================================================

function getDashboardData(token) {
  try {
    var session = requireAuth(token);
    var activeYear = getActiveAcademicYear();
    var ss = getDbSpreadsheet();

    var pengajaran = getSheetDataAsObjects(ss.getSheetByName('03_MASTER_PENGAJARAN')).filter(function(p) {
      var uId = p.UserID || p.userId || p.USERID || '';
      var tYr = p.TahunAjaran || p.tahunAjaran || p.TAHUNAJARAN || '';
      return String(uId) === String(session.userId) && String(tYr) === String(activeYear);
    });

    var classSet = {};
    pengajaran.forEach(function(p) {
      var k = String(p.Kelas || p.kelas || '').trim();
      if (k) classSet[k] = true;
    });
    var teacherClasses = Object.keys(classSet);
    var totalKelas = teacherClasses.length;

    var mapelSet = {};
    pengajaran.forEach(function(p) {
      var m = p.MataPelajaranID || p.mapelId;
      if (m) mapelSet[String(m).trim()] = true;
    });
    var totalMapel = Object.keys(mapelSet).length;

    var totalSiswa = 0;
    if (teacherClasses.length > 0) {
      var sheetSiswaKelas = ss.getSheetByName('05_SISWA_KELAS') || ss.getSheetByName('05_SIWA_KELAS');
      if (sheetSiswaKelas) {
        var allSK = getSheetDataAsObjects(sheetSiswaKelas);
        var filtered = allSK.filter(function(s) {
          return teacherClasses.indexOf(String(s.Kelas || s.kelas)) !== -1 && 
                 String(s.TahunAjaran) === String(activeYear) && 
                 String(s.Status || 'ACTIVE').toUpperCase() === 'ACTIVE';
        });
        totalSiswa = filtered.length;
      } else {
        var sheetSiswa = ss.getSheetByName('04_SISWA') || ss.getSheetByName('04_MASTER_SISWA');
        if (sheetSiswa) {
          var allSiswa = getSheetDataAsObjects(sheetSiswa);
          var filteredDirect = allSiswa.filter(function(s) {
            return teacherClasses.indexOf(String(s.Kelas || s.kelas)) !== -1;
          });
          totalSiswa = filteredDirect.length;
        }
      }
    }

    return {
      tahunAjaran: activeYear,
      totalKelas: totalKelas,
      totalMapel: totalMapel,
      totalSiswa: totalSiswa
    };
  } catch (e) {
    return { tahunAjaran: getActiveAcademicYear(), totalKelas: 0, totalMapel: 0, totalSiswa: 0 };
  }
}

function getMasterAjarData(token) {
  try {
    var session = requireAuth(token);
    var activeYear = getActiveAcademicYear();
    var ss = getDbSpreadsheet();

    var waliKelas = 'Bukan Wali Kelas';
    var mapelUtamaId = '';
    var sheetMA = ss.getSheetByName('02_MASTER_AJAR');
    if (sheetMA) {
      var listMA = getSheetDataAsObjects(sheetMA);
      var existMA = listMA.find(function(m) { 
        var uId = m.UserID || m.userId || m.USERID || '';
        var tYr = m.TahunAjaran || m.tahunAjaran || m.TAHUNAJARAN || '';
        return String(uId) === String(session.userId) && String(tYr) === String(activeYear); 
      });
      if (existMA) {
        if (existMA.WaliKelas) waliKelas = existMA.WaliKelas;
        if (existMA.MapelUtamaID || existMA.mapelUtamaId || existMA.MataPelajaranUtamaID) {
          mapelUtamaId = String(existMA.MapelUtamaID || existMA.mapelUtamaId || existMA.MataPelajaranUtamaID).trim();
        }
      }
    }

    var refObj = getReferencesData();
    var listKelas = (refObj && refObj.references && refObj.references.Kelas) ? refObj.references.Kelas : [];
    var listMapel = (refObj && refObj.references && refObj.references.MataPelajaran) ? refObj.references.MataPelajaran : [];

    var mapelRefMap = {};
    listMapel.forEach(function(m) {
      var id = typeof m === 'object' ? (m.code || m.id || m.name) : m;
      var name = typeof m === 'object' ? (m.name || m.code || m) : m;
      mapelRefMap[String(id)] = name;
      mapelRefMap[String(name)] = name;
    });

    var sheetMP = ss.getSheetByName('03_MASTER_PENGAJARAN');
    var pengajaran = [];
    var mapelAgg = {};

    if (sheetMP) {
      var rawPengajaran = getSheetDataAsObjects(sheetMP);
      var teacherRows = rawPengajaran.filter(function(p) {
        var uId = p.UserID || p.userId || p.USERID || '';
        var tYr = p.TahunAjaran || p.tahunAjaran || p.TAHUNAJARAN || '';
        return String(uId) === String(session.userId) && String(tYr) === String(activeYear);
      });

      // Deteksi mapelUtamaId dari row jika di 02_MASTER_AJAR belum tersimpan
      if (!mapelUtamaId && teacherRows.length > 0) {
        var utamaRow = teacherRows.find(function(p) {
          var j = String(p.JenisMapel || p.jenisMapel || p.Jenis || '').toUpperCase();
          return j === 'UTAMA';
        });
        if (utamaRow) {
          mapelUtamaId = String(utamaRow.MataPelajaranID || utamaRow.mapelId || utamaRow.MataPelajaran || '').trim();
        } else {
          // Default ke mapel pertama jika belum ada
          mapelUtamaId = String(teacherRows[0].MataPelajaranID || teacherRows[0].mapelId || teacherRows[0].MataPelajaran || '').trim();
        }
      }

      teacherRows.forEach(function(p) {
        var mId = String(p.MataPelajaranID || p.mapelId || p.MataPelajaran || p.mapel || '').trim();
        var kVal = String(p.Kelas || p.kelas || '').trim();
        var jenis = String(p.JenisMapel || p.jenisMapel || p.Jenis || '').toUpperCase();
        if (!jenis) {
          jenis = (mapelUtamaId && mId === mapelUtamaId) ? 'UTAMA' : 'TAMBAHAN';
        }
        var isUtama = (jenis === 'UTAMA') || (mapelUtamaId && mId === mapelUtamaId);

        pengajaran.push({
          _rowIndex: p._rowIndex,
          PengajaranID: p.PengajaranID || p.pengajaranId || p.MPGID || '',
          UserID: p.UserID || p.userId || session.userId,
          TahunAjaran: p.TahunAjaran || p.tahunAjaran || activeYear,
          MataPelajaranID: mId,
          mapelId: mId,
          mapelNama: mapelRefMap[mId] || mId,
          Kelas: kVal,
          kelas: kVal,
          jenisMapel: jenis,
          isUtama: isUtama
        });

        if (mId && kVal) {
          if (!mapelAgg[mId]) {
            mapelAgg[mId] = { mapelId: mId, mapelNama: mapelRefMap[mId] || mId, kelases: [], isUtama: isUtama };
          }
          if (!mapelAgg[mId].kelases.includes(kVal)) {
            mapelAgg[mId].kelases.push(kVal);
          }
          if (isUtama) mapelAgg[mId].isUtama = true;
        }
      });
    }

    var mapelUtama = null;
    var mapelTambahan = [];

    Object.keys(mapelAgg).forEach(function(mId) {
      if (String(mId) === String(mapelUtamaId) || mapelAgg[mId].isUtama) {
        if (!mapelUtama) {
          mapelUtama = mapelAgg[mId];
        } else {
          mapelTambahan.push(mapelAgg[mId]);
        }
      } else {
        mapelTambahan.push(mapelAgg[mId]);
      }
    });

    var mapelUtamaNama = '';
    if (mapelUtamaId) {
      mapelUtamaNama = mapelRefMap[mapelUtamaId] || (mapelUtama ? mapelUtama.mapelNama : mapelUtamaId);
    }

    return {
      success: true,
      waliKelas: waliKelas,
      mapelUtamaId: mapelUtamaId,
      mapelUtamaNama: mapelUtamaNama,
      mapelUtama: mapelUtama,
      mapelTambahan: mapelTambahan,
      pengajaran: pengajaran,
      tahunAjaran: activeYear,
      listKelas: listKelas,
      listMapel: listMapel
    };
  } catch (err) {
    return {
      success: false,
      error: err.message || err.toString(),
      tahunAjaran: getActiveAcademicYear(),
      waliKelas: 'Bukan Wali Kelas',
      listKelas: [],
      listMapel: [],
      pengajaran: []
    };
  }
}

/**
 * SIMPAN MASTER AJAR: DIOPTIMASI DENGAN BULK IN-MEMORY REWRITE (TANPA LOOP deleteRow)
 */
function saveMasterAjar(token, waliKelas, payloadPengajaran, optMapelUtamaId) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    var session = requireAuth(token);
    var activeYear = getActiveAcademicYear();
    var ss = getDbSpreadsheet();

    // Normalisasi payload pengajaran:
    // Format 1: { mapelUtama: { mapelId, kelases }, mapelTambahan: [ { mapelId, kelases } ] }
    // Format 2: Array of items [{ mapelId, kelases, isUtama }]
    var mapelUtamaItem = null;
    var mapelTambahanItems = [];
    var mapelUtamaId = '';

    if (payloadPengajaran && typeof payloadPengajaran === 'object' && !Array.isArray(payloadPengajaran)) {
      mapelUtamaItem = payloadPengajaran.mapelUtama || null;
      mapelTambahanItems = Array.isArray(payloadPengajaran.mapelTambahan) ? payloadPengajaran.mapelTambahan : [];
      if (mapelUtamaItem && mapelUtamaItem.mapelId) {
        mapelUtamaId = String(mapelUtamaItem.mapelId).trim();
      }
    } else if (Array.isArray(payloadPengajaran)) {
      if (optMapelUtamaId) mapelUtamaId = String(optMapelUtamaId).trim();
      payloadPengajaran.forEach(function(item) {
        if (item.isUtama || (mapelUtamaId && String(item.mapelId) === String(mapelUtamaId))) {
          mapelUtamaItem = item;
          mapelUtamaId = String(item.mapelId).trim();
        } else {
          mapelTambahanItems.push(item);
        }
      });
      if (!mapelUtamaItem && payloadPengajaran.length > 0) {
        mapelUtamaItem = payloadPengajaran[0];
        mapelUtamaId = String(mapelUtamaItem.mapelId).trim();
        mapelTambahanItems = payloadPengajaran.slice(1);
      }
    }

    // 1. Simpan atau Update Wali Kelas dan MapelUtamaID di 02_MASTER_AJAR
    var sheetMA = ss.getSheetByName('02_MASTER_AJAR');
    if (sheetMA) {
      var lastRowMA = sheetMA.getLastRow();
      var now = new Date();
      var headerMA = [];
      if (lastRowMA >= 1) {
        headerMA = sheetMA.getRange(1, 1, 1, Math.max(1, sheetMA.getLastColumn())).getValues()[0];
      } else {
        headerMA = ['MasterAjarID', 'UserID', 'TahunAjaran', 'WaliKelas', 'CreatedAt', 'UpdatedAt', 'MapelUtamaID'];
        sheetMA.appendRow(headerMA);
        lastRowMA = 1;
      }

      var hMapMA = getHeaderIndexMap(headerMA);
      var colUserMA = hMapMA['userid'] !== undefined ? hMapMA['userid'] : 1;
      var colTaMA = hMapMA['tahunajaran'] !== undefined ? hMapMA['tahunajaran'] : 2;
      var colWaliMA = hMapMA['walikelas'] !== undefined ? hMapMA['walikelas'] : 3;
      var colUpdMA = hMapMA['updatedat'] !== undefined ? hMapMA['updatedat'] : 5;
      var colMapelUtamaMA = hMapMA['mapelutamaid'] !== undefined ? hMapMA['mapelutamaid'] : (hMapMA['mapelutama'] !== undefined ? hMapMA['mapelutama'] : -1);

      if (colMapelUtamaMA === -1) {
        colMapelUtamaMA = headerMA.length;
        sheetMA.getRange(1, colMapelUtamaMA + 1).setValue('MapelUtamaID');
      }

      if (lastRowMA >= 2) {
        var dataMA = sheetMA.getRange(1, 1, lastRowMA, Math.max(headerMA.length, colMapelUtamaMA + 1)).getValues();
        var foundIdx = -1;
        for (var i = 1; i < dataMA.length; i++) {
          if (String(dataMA[i][colUserMA]) === String(session.userId) && String(dataMA[i][colTaMA]) === String(activeYear)) {
            foundIdx = i + 1;
            break;
          }
        }

        if (foundIdx > 0) {
          sheetMA.getRange(foundIdx, colWaliMA + 1).setValue(waliKelas || 'Bukan Wali Kelas');
          sheetMA.getRange(foundIdx, colUpdMA + 1).setValue(now);
          sheetMA.getRange(foundIdx, colMapelUtamaMA + 1).setValue(mapelUtamaId);
        } else {
          var maId = 'MA-' + Utilities.getUuid().substring(0, 8).toUpperCase();
          var newRowMA = new Array(colMapelUtamaMA + 1);
          newRowMA[0] = maId;
          newRowMA[colUserMA] = session.userId;
          newRowMA[colTaMA] = activeYear;
          newRowMA[colWaliMA] = waliKelas || 'Bukan Wali Kelas';
          newRowMA[4] = now;
          newRowMA[colUpdMA] = now;
          newRowMA[colMapelUtamaMA] = mapelUtamaId;
          sheetMA.appendRow(newRowMA);
        }
      } else {
        var maId = 'MA-' + Utilities.getUuid().substring(0, 8).toUpperCase();
        var newRowMA = new Array(colMapelUtamaMA + 1);
        newRowMA[0] = maId;
        newRowMA[colUserMA] = session.userId;
        newRowMA[colTaMA] = activeYear;
        newRowMA[colWaliMA] = waliKelas || 'Bukan Wali Kelas';
        newRowMA[4] = now;
        newRowMA[colUpdMA] = now;
        newRowMA[colMapelUtamaMA] = mapelUtamaId;
        sheetMA.appendRow(newRowMA);
      }
    }

    // 2. BULK IN-MEMORY REWRITE untuk 03_MASTER_PENGAJARAN (Diberi kolom JenisMapel)
    var sheetMP = ss.getSheetByName('03_MASTER_PENGAJARAN');
    if (sheetMP) {
      var lastRowMP = sheetMP.getLastRow();
      var lastColMP = Math.max(7, sheetMP.getLastColumn());
      var headerRow = [];
      var filteredRows = [];

      if (lastRowMP >= 1) {
        var allDataMP = sheetMP.getRange(1, 1, lastRowMP, lastColMP).getValues();
        headerRow = allDataMP[0];
        var hMap = getHeaderIndexMap(headerRow);
        var colUser = hMap['userid'] !== undefined ? hMap['userid'] : 1;
        var colTa = hMap['tahunajaran'] !== undefined ? hMap['tahunajaran'] : 2;

        for (var r = 1; r < allDataMP.length; r++) {
          var row = allDataMP[r];
          var uId = String(row[colUser] || '');
          var tYr = String(row[colTa] || '');
          if (!(uId === String(session.userId) && tYr === String(activeYear))) {
            filteredRows.push(row);
          }
        }
      } else {
        headerRow = ['PengajaranID', 'UserID', 'TahunAjaran', 'MataPelajaranID', 'Kelas', 'CreatedAt', 'UpdatedAt', 'JenisMapel'];
      }

      var hMapMP = getHeaderIndexMap(headerRow);
      var colJenis = hMapMP['jenismapel'] !== undefined ? hMapMP['jenismapel'] : (hMapMP['kategori'] !== undefined ? hMapMP['kategori'] : -1);
      if (colJenis === -1) {
        colJenis = headerRow.length;
        headerRow.push('JenisMapel');
      }

      var nowMP = new Date();
      var colPId = hMapMP['pengajaranid'] !== undefined ? hMapMP['pengajaranid'] : 0;
      var colPUser = hMapMP['userid'] !== undefined ? hMapMP['userid'] : 1;
      var colPTa = hMapMP['tahunajaran'] !== undefined ? hMapMP['tahunajaran'] : 2;
      var colPMapel = hMapMP['matapelajaranid'] !== undefined ? hMapMP['matapelajaranid'] : 3;
      var colPKelas = hMapMP['kelas'] !== undefined ? hMapMP['kelas'] : 4;
      var colPCre = hMapMP['createdat'] !== undefined ? hMapMP['createdat'] : 5;
      var colPUpd = hMapMP['updatedat'] !== undefined ? hMapMP['updatedat'] : 6;

      // Masukkan baris Mata Pelajaran Utama
      if (mapelUtamaItem && mapelUtamaItem.mapelId) {
        (mapelUtamaItem.kelases || []).forEach(function(k) {
          var mpgId = 'MPG-' + Utilities.getUuid().substring(0, 8).toUpperCase();
          var newRow = new Array(headerRow.length);
          newRow[colPId] = mpgId;
          newRow[colPUser] = session.userId;
          newRow[colPTa] = activeYear;
          newRow[colPMapel] = mapelUtamaItem.mapelId;
          newRow[colPKelas] = k;
          newRow[colPCre] = nowMP;
          newRow[colPUpd] = nowMP;
          newRow[colJenis] = 'UTAMA';
          filteredRows.push(newRow);
        });
      }

      // Masukkan baris Mata Pelajaran Tambahan
      (mapelTambahanItems || []).forEach(function(item) {
        if (!item || !item.mapelId) return;
        (item.kelases || []).forEach(function(k) {
          var mpgId = 'MPG-' + Utilities.getUuid().substring(0, 8).toUpperCase();
          var newRow = new Array(headerRow.length);
          newRow[colPId] = mpgId;
          newRow[colPUser] = session.userId;
          newRow[colPTa] = activeYear;
          newRow[colPMapel] = item.mapelId;
          newRow[colPKelas] = k;
          newRow[colPCre] = nowMP;
          newRow[colPUpd] = nowMP;
          newRow[colJenis] = 'TAMBAHAN';
          filteredRows.push(newRow);
        });
      });

      var totalRows = filteredRows.length + 1;
      var new2D = [headerRow].concat(filteredRows);

      sheetMP.clearContents();
      sheetMP.getRange(1, 1, totalRows, headerRow.length).setValues(new2D);
    }

    // Ambil nama mapel utama untuk feedback dan cache
    var refObj = getReferencesData();
    var listMapel = (refObj && refObj.references && refObj.references.MataPelajaran) ? refObj.references.MataPelajaran : [];
    var mapelUtamaNama = mapelUtamaId;
    var foundM = listMapel.find(function(m) {
      var id = typeof m === 'object' ? (m.code || m.id || m.name) : m;
      return String(id) === String(mapelUtamaId);
    });
    if (foundM) mapelUtamaNama = typeof foundM === 'object' ? (foundM.name || foundM.code || foundM) : foundM;

    logActivity(session.userId, 'SAVE_MASTER_AJAR', 'MASTER_AJAR', 'Simpan Master Ajar berhasil: Mapel Utama ' + mapelUtamaNama);
    return {
      success: true,
      message: 'Master Ajar berhasil disimpan!',
      mapelUtamaId: mapelUtamaId,
      mapelUtamaNama: mapelUtamaNama
    };
  } catch (e) {
    return { success: false, message: 'Gagal menyimpan Master Ajar: ' + e.message };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================
// MASTER SISWA SERVICES
// ============================================================================

function getTeacherClasses(token) {
  try {
    var session = requireAuth(token);
    var activeYear = getActiveAcademicYear();
    var ss = getDbSpreadsheet();

    var pengajaran = getSheetDataAsObjects(ss.getSheetByName('03_MASTER_PENGAJARAN')).filter(function(p) {
      return String(p.UserID || p.userId) === String(session.userId) && String(p.TahunAjaran || p.tahunAjaran) === String(activeYear);
    });

    var classSet = {};
    pengajaran.forEach(function(p) {
      var k = String(p.Kelas || p.kelas || '').trim();
      if (k) classSet[k] = true;
    });

    return { success: true, kelasAjar: Object.keys(classSet) };
  } catch (err) {
    return { success: false, kelasAjar: [] };
  }
}

function getMasterSiswa(token, kelas) {
  try {
    var session = requireAuth(token);
    var activeYear = getActiveAcademicYear();
    var ss = getDbSpreadsheet();

    var sheetSiswa = ss.getSheetByName('04_SISWA');
    var sheetSiswaKelas = ss.getSheetByName('05_SISWA_KELAS') || ss.getSheetByName('05_SIWA_KELAS');

    if (!sheetSiswa || !sheetSiswaKelas) {
      return { success: false, message: 'Tabel Siswa tidak ditemukan', data: [] };
    }

    if (!kelas) {
      return { success: true, data: [] };
    }

    var listSiswa = getSheetDataAsObjects(sheetSiswa);
    var listSiswaKelas = getSheetDataAsObjects(sheetSiswaKelas);

    var siswaMap = {};
    listSiswa.forEach(function(s) {
      siswaMap[String(s.SiswaID || s.siswaId).trim()] = s;
    });

    var result = [];
    listSiswaKelas.forEach(function(sk) {
      var matchTA = !sk.TahunAjaran || String(sk.TahunAjaran || sk.tahunAjaran).trim() === String(activeYear).trim();
      var matchKelas = String(sk.Kelas || sk.kelas).trim().toLowerCase() === String(kelas).trim().toLowerCase();
      var matchStatus = String(sk.Status || sk.status || 'ACTIVE').toUpperCase() !== 'INACTIVE';

      if (matchTA && matchKelas && matchStatus) {
        var sId = String(sk.SiswaID || sk.siswaId).trim();
        var student = siswaMap[sId];
        if (student) {
          result.push({
            siswaId: student.SiswaID || student.siswaId,
            nis: student.NIS || student.nis || '-',
            nisn: student.NISN || student.nisn || '-',
            namaSiswa: student.NamaSiswa || student.namaSiswa || '',
            kelas: kelas
          });
        }
      }
    });

    result.sort(function(a, b) { return a.namaSiswa.localeCompare(b.namaSiswa); });
    return { success: true, data: result };
  } catch (err) {
    return { success: false, message: 'Gagal mengambil data siswa: ' + err.message, data: [] };
  }
}

function saveSiswaManual(token, kelas, data) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var session = requireAuth(token);
    var activeYear = getActiveAcademicYear();
    var ss = getDbSpreadsheet();

    var sheetSiswa = ss.getSheetByName('04_SISWA');
    var sheetSiswaKelas = ss.getSheetByName('05_SISWA_KELAS') || ss.getSheetByName('05_SIWA_KELAS');

    if (!sheetSiswa || !sheetSiswaKelas) {
      return { success: false, message: 'Tabel Siswa tidak ditemukan.' };
    }

    var now = new Date();
    var inputNisn = String(data.nisn || '').trim();
    var inputNama = String(data.namaSiswa || '').trim();
    var inputNis = String(data.nis || '').trim();
    var targetSiswaId = data.siswaId || '';

    var allSiswa = getSheetDataAsObjects(sheetSiswa);

    if (inputNisn) {
      var foundByNisn = allSiswa.find(function(s) {
        return String(s.NISN || s.nisn || '').trim() === inputNisn;
      });
      if (foundByNisn) targetSiswaId = foundByNisn.SiswaID || foundByNisn.siswaId;
    }

    if (targetSiswaId) {
      var sRecord = allSiswa.find(function(s) { return (s.SiswaID || s.siswaId) === targetSiswaId; });
      if (sRecord) {
        var rIdx = sRecord._rowIndex;
        var colNama = getColumnIndex(sheetSiswa, 'NamaSiswa');
        var colNis = getColumnIndex(sheetSiswa, 'NIS');
        var colNisn = getColumnIndex(sheetSiswa, 'NISN');
        var colUp = getColumnIndex(sheetSiswa, 'UpdatedAt');

        if (!inputNis || inputNis === '-') {
          inputNis = sRecord.NIS || sRecord.nis || generateNextNIS(sheetSiswa);
        }

        if (colNama > 0) sheetSiswa.getRange(rIdx, colNama).setValue(inputNama);
        if (colNis > 0) sheetSiswa.getRange(rIdx, colNis).setValue(inputNis);
        if (colNisn > 0) sheetSiswa.getRange(rIdx, colNisn).setValue(inputNisn);
        if (colUp > 0) sheetSiswa.getRange(rIdx, colUp).setValue(now);
      }
    } else {
      targetSiswaId = 'SISWA-' + Utilities.getUuid().substring(0, 8).toUpperCase();
      if (!inputNis || inputNis === '-') {
        inputNis = generateNextNIS(sheetSiswa);
      }
      sheetSiswa.appendRow([targetSiswaId, inputNis, inputNisn, inputNama, now, now]);
    }

    var allSK = getSheetDataAsObjects(sheetSiswaKelas);
    var existingSK = allSK.find(function(sk) {
      return String(sk.SiswaID || sk.siswaId).trim() === targetSiswaId &&
             String(sk.TahunAjaran || sk.tahunAjaran).trim() === activeYear &&
             String(sk.Kelas || sk.kelas).trim() === kelas.trim();
    });

    if (!existingSK) {
      var skId = 'SK-' + Utilities.getUuid().substring(0, 8).toUpperCase();
      sheetSiswaKelas.appendRow([skId, targetSiswaId, activeYear, kelas, 'ACTIVE', now, now]);
    } else {
      var colStatus = getColumnIndex(sheetSiswaKelas, 'Status');
      if (colStatus > 0) sheetSiswaKelas.getRange(existingSK._rowIndex, colStatus).setValue('ACTIVE');
    }

    return { success: true, message: 'Data siswa berhasil disimpan!' };
  } catch (err) {
    return { success: false, message: 'Gagal menyimpan siswa: ' + err.message };
  } finally {
    lock.releaseLock();
  }
}

function deleteSiswa(token, siswaId, kelas) {
  try {
    var session = requireAuth(token);
    var activeYear = getActiveAcademicYear();
    var ss = getDbSpreadsheet();
    var sheetSiswaKelas = ss.getSheetByName('05_SISWA_KELAS') || ss.getSheetByName('05_SIWA_KELAS');

    if (sheetSiswaKelas) {
      var allSK = getSheetDataAsObjects(sheetSiswaKelas);
      var match = allSK.find(function(sk) {
        return String(sk.SiswaID || sk.siswaId).trim() === String(siswaId).trim() &&
               String(sk.TahunAjaran || sk.tahunAjaran).trim() === String(activeYear).trim() &&
               String(sk.Kelas || sk.kelas).trim() === String(kelas).trim();
      });

      if (match) {
        var colStatus = getColumnIndex(sheetSiswaKelas, 'Status');
        if (colStatus > 0) sheetSiswaKelas.getRange(match._rowIndex, colStatus).setValue('INACTIVE');
      }
    }

    return { success: true, message: 'Siswa berhasil dihapus dari kelas!' };
  } catch (err) {
    return { success: false, message: 'Gagal menghapus siswa: ' + err.message };
  }
}

function bulkUploadSiswa(token, kelas, listSiswa) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    var session = requireAuth(token);
    var activeYear = getActiveAcademicYear();
    var ss = getDbSpreadsheet();

    var sheetSiswa = ss.getSheetByName('04_SISWA');
    var sheetSiswaKelas = ss.getSheetByName('05_SISWA_KELAS') || ss.getSheetByName('05_SIWA_KELAS');

    if (!sheetSiswa || !sheetSiswaKelas) {
      return { success: false, message: 'Tabel Siswa/Siswa Kelas tidak ditemukan.' };
    }

    var existingSiswa = getSheetDataAsObjects(sheetSiswa);
    var existingSiswaKelas = getSheetDataAsObjects(sheetSiswaKelas);
    var now = new Date();
    var insertedCount = 0;
    var updatedCount = 0;

    var nisnMap = {};
    existingSiswa.forEach(function(s) {
      var nisnClean = String(s.NISN || s.nisn || '').trim();
      if (nisnClean) nisnMap[nisnClean] = s;
    });

    listSiswa.forEach(function(item) {
      var inputNisn = String(item.nisn || item.NISN || '').trim();
      var inputNama = String(item.namaSiswa || item.NamaSiswa || '').trim();
      var inputNis = String(item.nis || item.NIS || '').trim();

      if (!inputNama) return;

      var targetSiswaId = '';
      var existingRecord = inputNisn ? nisnMap[inputNisn] : null;

      if (existingRecord) {
        targetSiswaId = existingRecord.SiswaID || existingRecord.siswaId;
        var rIdx = existingRecord._rowIndex;

        var colNama = getColumnIndex(sheetSiswa, 'NamaSiswa');
        var colNis = getColumnIndex(sheetSiswa, 'NIS');
        var colUp = getColumnIndex(sheetSiswa, 'UpdatedAt');

        var currentNIS = existingRecord.NIS || existingRecord.nis || '';
        if (!currentNIS || currentNIS === '-') {
          inputNis = inputNis || generateNextNIS(sheetSiswa);
        } else {
          inputNis = currentNIS;
        }

        if (colNama > 0) sheetSiswa.getRange(rIdx, colNama).setValue(inputNama);
        if (colNis > 0 && inputNis) sheetSiswa.getRange(rIdx, colNis).setValue(inputNis);
        if (colUp > 0) sheetSiswa.getRange(rIdx, colUp).setValue(now);

        updatedCount++;
      } else {
        targetSiswaId = 'SISWA-' + Utilities.getUuid().substring(0, 8).toUpperCase();
        if (!inputNis || inputNis === '-') {
          inputNis = generateNextNIS(sheetSiswa);
        }
        sheetSiswa.appendRow([targetSiswaId, inputNis, inputNisn, inputNama, now, now]);

        var newObj = { SiswaID: targetSiswaId, NIS: inputNis, NISN: inputNisn, NamaSiswa: inputNama };
        if (inputNisn) nisnMap[inputNisn] = newObj;

        insertedCount++;
      }

      var existingSK = existingSiswaKelas.find(function(sk) {
        return String(sk.SiswaID || sk.siswaId).trim() === targetSiswaId &&
               String(sk.TahunAjaran || sk.tahunAjaran).trim() === activeYear &&
               String(sk.Kelas || sk.kelas).trim() === kelas.trim();
      });

      if (existingSK) {
        var colStatus = getColumnIndex(sheetSiswaKelas, 'Status');
        var colUpSK = getColumnIndex(sheetSiswaKelas, 'UpdatedAt');
        if (colStatus > 0) sheetSiswaKelas.getRange(existingSK._rowIndex, colStatus).setValue('ACTIVE');
        if (colUpSK > 0) sheetSiswaKelas.getRange(existingSK._rowIndex, colUpSK).setValue(now);
      } else {
        var skId = 'SK-' + Utilities.getUuid().substring(0, 8).toUpperCase();
        sheetSiswaKelas.appendRow([skId, targetSiswaId, activeYear, kelas, 'ACTIVE', now, now]);
      }
    });

    logActivity(session.userId, 'UPLOAD_SISWA', 'MASTER_SISWA', 'Upload siswa kelas ' + kelas + ': ' + insertedCount + ' baru, ' + updatedCount + ' diperbarui.');

    return {
      success: true,
      message: 'Upload berhasil! ' + insertedCount + ' siswa baru ditambahkan, ' + updatedCount + ' siswa diperbarui.'
    };
  } catch (err) {
    return { success: false, message: 'Gagal memproses upload siswa: ' + err.message };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================
// ABSENSI SERVICES (ULTRA ACCELERATED BATCH IN-MEMORY PROCESSING)
// ============================================================================

function getAbsensiData(token, pengajaranId, semester) {
  try {
    var session = requireAuth(token);
    var ss = getDbSpreadsheet();
    semester = semester || 'Ganjil';

    if (!pengajaranId) {
      return { success: false, message: 'Pengajaran belum dipilih', siswa: [], absensiMap: {}, datesMap: {} };
    }

    var sheetMP = ss.getSheetByName('03_MASTER_PENGAJARAN');
    var pengajaranList = getSheetDataAsObjects(sheetMP);
    var targetPengajaran = pengajaranList.find(function(p) {
      var uId = p.UserID || p.userId;
      var pId = p.PengajaranID || p.pengajaranId;
      return String(uId) === String(session.userId) && String(pId) === String(pengajaranId);
    });

    if (!targetPengajaran) {
      return { success: false, message: 'Akses ditolak atau Pengajaran tidak ditemukan.', siswa: [], absensiMap: {}, datesMap: {} };
    }

    var kelasAjar = targetPengajaran.Kelas || targetPengajaran.kelas;
    var resSiswa = getMasterSiswa(token, kelasAjar);
    var listSiswa = resSiswa.data || [];

    var sheetAbs = ss.getSheetByName('06_ABSENSI');
    var absensiMap = {};
    var datesMap = {};

    if (sheetAbs && sheetAbs.getLastRow() >= 2) {
      var rawAbs = sheetAbs.getRange(1, 1, sheetAbs.getLastRow(), sheetAbs.getLastColumn()).getValues();
      var hMap = getHeaderIndexMap(rawAbs[0]);

      var colUId = hMap['userid'] !== undefined ? hMap['userid'] : 1;
      var colPId = hMap['pengajaranid'] !== undefined ? hMap['pengajaranid'] : 4;
      var colSId = hMap['siswaid'] !== undefined ? hMap['siswaid'] : 5;
      var colPKe = hMap['pertemuanke'] !== undefined ? hMap['pertemuanke'] : 6;
      var colTgl = hMap['tanggal'] !== undefined ? hMap['tanggal'] : 7;
      var colStat = hMap['status'] !== undefined ? hMap['status'] : 8;
      var colSem = hMap['semester'] !== undefined ? hMap['semester'] : 3;

      for (var r = 1; r < rawAbs.length; r++) {
        var row = rawAbs[r];
        var uId = row[colUId];
        var pId = row[colPId];
        var sId = row[colSId];
        var pKe = row[colPKe];
        var sem = row[colSem] || '';

        var matchSem = !sem || String(sem).toLowerCase() === String(semester).toLowerCase() ||
                       (String(semester) === 'Ganjil' && String(sem) === '1') ||
                       (String(semester) === 'Genap' && String(sem) === '2');

        if (String(uId) === String(session.userId) && String(pId) === String(pengajaranId) && matchSem) {
          var key = sId + '_' + pKe;
          absensiMap[key] = row[colStat] || '';
          if (row[colTgl] && !datesMap[pKe]) {
            var dt = row[colTgl];
            datesMap[pKe] = (dt instanceof Date) ? dt.toISOString() : String(dt);
          }
        }
      }
    }

    return {
      success: true,
      kelas: kelasAjar,
      siswa: listSiswa,
      absensiMap: absensiMap,
      datesMap: datesMap
    };
  } catch (err) {
    return { success: false, message: err.message, siswa: [], absensiMap: {}, datesMap: {} };
  }
}

/**
 * SIMPAN ABSENSI: BATCH IN-MEMORY 2D ARRAY
 * Mengubah ratusan pemanggilan setValue() lambat menjadi 1 kali setValues() instan.
 */
function saveAbsensiData(token, pengajaranId, semester, datesData, attendanceData) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    var session = requireAuth(token);
    var ss = getDbSpreadsheet();
    var activeYear = getActiveAcademicYear();
    semester = semester || 'Ganjil';
    var sheetAbs = ss.getSheetByName('06_ABSENSI');

    if (!sheetAbs) {
      return { success: false, message: 'Sheet 06_ABSENSI tidak ditemukan.' };
    }

    var sheetMP = ss.getSheetByName('03_MASTER_PENGAJARAN');
    var pengajaranList = getSheetDataAsObjects(sheetMP);
    var targetPengajaran = pengajaranList.find(function(p) {
      return String(p.UserID || p.userId) === String(session.userId) && 
             String(p.PengajaranID || p.pengajaranId) === String(pengajaranId);
    });

    if (!targetPengajaran) {
      return { success: false, message: 'Anda tidak memiliki hak akses menyimpan absensi ini!' };
    }

    var lastRow = sheetAbs.getLastRow();
    var lastCol = Math.max(11, sheetAbs.getLastColumn());
    var allData = [];
    var headers = [];

    if (lastRow >= 1) {
      allData = sheetAbs.getRange(1, 1, lastRow, lastCol).getValues();
      headers = allData[0];
    } else {
      headers = ['AbsensiID', 'UserID', 'TahunAjaran', 'Semester', 'PengajaranID', 'SiswaID', 'PertemuanKe', 'Tanggal', 'Status', 'CreatedAt', 'UpdatedAt'];
      allData = [headers];
    }

    var hMap = getHeaderIndexMap(headers);
    var colAbsId = hMap['absensiid'] !== undefined ? hMap['absensiid'] : 0;
    var colUserId = hMap['userid'] !== undefined ? hMap['userid'] : 1;
    var colTa = hMap['tahunajaran'] !== undefined ? hMap['tahunajaran'] : 2;
    var colSem = hMap['semester'] !== undefined ? hMap['semester'] : 3;
    var colPengId = hMap['pengajaranid'] !== undefined ? hMap['pengajaranid'] : 4;
    var colSiswaId = hMap['siswaid'] !== undefined ? hMap['siswaid'] : 5;
    var colPKe = hMap['pertemuanke'] !== undefined ? hMap['pertemuanke'] : 6;
    var colTgl = hMap['tanggal'] !== undefined ? hMap['tanggal'] : 7;
    var colStat = hMap['status'] !== undefined ? hMap['status'] : 8;
    var colCre = hMap['createdat'] !== undefined ? hMap['createdat'] : 9;
    var colUpd = hMap['updatedat'] !== undefined ? hMap['updatedat'] : 10;

    // Buat lookup index map untuk pencarian O(1) di RAM
    var rowMap = {};
    for (var r = 1; r < allData.length; r++) {
      var row = allData[r];
      var rSem = String(row[colSem] || '').toLowerCase();
      var targetSem = String(semester).toLowerCase();
      var matchSem = !rSem || rSem === targetSem || (targetSem === 'ganjil' && rSem === '1') || (targetSem === 'genap' && rSem === '2');

      if (String(row[colUserId]) === String(session.userId) &&
          String(row[colPengId]) === String(pengajaranId) &&
          matchSem) {
        var sKey = String(row[colSiswaId]) + '_' + String(row[colPKe]);
        rowMap[sKey] = r;
      }
    }

    var now = new Date();

    (attendanceData || []).forEach(function(item) {
      var sId = String(item.siswaId || '');
      var pKe = String(item.pertemuanKe || '');
      var statusVal = item.status || '';
      var tglVal = (datesData && datesData[pKe]) ? datesData[pKe] : '';
      var sKey = sId + '_' + pKe;

      if (rowMap[sKey] !== undefined) {
        // Baris sudah ada -> Mutasi langsung di RAM
        var existingRowIdx = rowMap[sKey];
        allData[existingRowIdx][colStat] = statusVal;
        if (tglVal) allData[existingRowIdx][colTgl] = tglVal;
        allData[existingRowIdx][colSem] = semester;
        allData[existingRowIdx][colUpd] = now;
      } else if (statusVal) {
        // Baris baru -> Push ke array 2D RAM
        var newAbsId = 'ABS-' + Utilities.getUuid().substring(0, 8).toUpperCase();
        var newRow = new Array(headers.length);
        newRow[colAbsId] = newAbsId;
        newRow[colUserId] = session.userId;
        newRow[colTa] = activeYear;
        newRow[colSem] = semester;
        newRow[colPengId] = pengajaranId;
        newRow[colSiswaId] = sId;
        newRow[colPKe] = pKe;
        newRow[colTgl] = tglVal;
        newRow[colStat] = statusVal;
        newRow[colCre] = now;
        newRow[colUpd] = now;

        allData.push(newRow);
        rowMap[sKey] = allData.length - 1;
      }
    });

    // Tulis SELURUH data kembali dengan 1 panggilan setValues()
    sheetAbs.getRange(1, 1, allData.length, headers.length).setValues(allData);

    logActivity(session.userId, 'SAVE_ABSENSI', 'ABSENSI', 'Menyimpan absensi batch PengajaranID: ' + pengajaranId + ', Semester: ' + semester);
    return { success: true, message: 'Absensi berhasil disimpan!' };
  } catch (err) {
    return { success: false, message: 'Gagal menyimpan absensi: ' + err.message };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================
// PENILAIAN SERVICES (ULTRA ACCELERATED BATCH IN-MEMORY PROCESSING)
// ============================================================================

function getNilaiData(token, pengajaranId, semester) {
  try {
    var session = requireAuth(token);
    var ss = getDbSpreadsheet();
    semester = semester || 'Ganjil';

    if (!pengajaranId) {
      return { success: false, message: 'Pengajaran belum dipilih', siswa: [], aktivitasMap: {}, pasMap: {} };
    }

    var sheetMP = ss.getSheetByName('03_MASTER_PENGAJARAN');
    var pengajaranList = getSheetDataAsObjects(sheetMP);
    var targetPengajaran = pengajaranList.find(function(p) {
      var uId = p.UserID || p.userId;
      var pId = p.PengajaranID || p.pengajaranId;
      return String(uId) === String(session.userId) && String(pId) === String(pengajaranId);
    });

    if (!targetPengajaran) {
      return { success: false, message: 'Akses ditolak atau Pengajaran tidak ditemukan.', siswa: [], aktivitasMap: {}, pasMap: {} };
    }

    var kelasAjar = targetPengajaran.Kelas || targetPengajaran.kelas;
    var resSiswa = getMasterSiswa(token, kelasAjar);
    var listSiswa = resSiswa.data || [];

    var sheetNilai = ss.getSheetByName('07_NILAI');
    var sheetNilaiAkt = ss.getSheetByName('08_NILAI_AKTIVITAS');

    var aktivitasMap = {};
    var pasMap = {};
    var bobotAct = 66;
    var bobotPas = 34;
    var kkm = 75;
    var maxAct = 1;

    if (sheetNilai && sheetNilai.getLastRow() >= 2) {
      var rawNilai = sheetNilai.getRange(1, 1, sheetNilai.getLastRow(), sheetNilai.getLastColumn()).getValues();
      var hMapNilai = getHeaderIndexMap(rawNilai[0]);

      var colUIdN = hMapNilai['userid'] !== undefined ? hMapNilai['userid'] : 1;
      var colPIdN = hMapNilai['pengajaranid'] !== undefined ? hMapNilai['pengajaranid'] : 3;
      var colSIdN = hMapNilai['siswaid'] !== undefined ? hMapNilai['siswaid'] : 4;
      var colSemN = hMapNilai['semester'] !== undefined ? hMapNilai['semester'] : 5;
      var colPasN = hMapNilai['pas'] !== undefined ? hMapNilai['pas'] : 6;
      var colNIdN = hMapNilai['nilaiid'] !== undefined ? hMapNilai['nilaiid'] : 0;
      var colBAct = hMapNilai['bobotaktivitas'] !== undefined ? hMapNilai['bobotaktivitas'] : 8;
      var colBPas = hMapNilai['bobotpas'] !== undefined ? hMapNilai['bobotpas'] : 9;
      var colKkm = hMapNilai['standarkelulusan'] !== undefined ? hMapNilai['standarkelulusan'] : 11;

      var nilaiIdToSiswaId = {};

      for (var r = 1; r < rawNilai.length; r++) {
        var row = rawNilai[r];
        var uId = row[colUIdN];
        var pId = row[colPIdN];
        var sem = row[colSemN];
        
        var matchSem = String(sem).toLowerCase() === String(semester).toLowerCase() ||
                       (String(semester) === 'Ganjil' && String(sem) === '1') ||
                       (String(semester) === 'Genap' && String(sem) === '2');

        if (String(uId) === String(session.userId) && String(pId) === String(pengajaranId) && matchSem) {
          var sId = row[colSIdN];
          var nId = row[colNIdN];
          if (sId) {
            pasMap[sId] = row[colPasN] !== undefined ? row[colPasN] : '';
            if (nId) nilaiIdToSiswaId[nId] = sId;
            if (row[colBAct] !== undefined && row[colBAct] !== '') bobotAct = Number(row[colBAct]);
            if (row[colBPas] !== undefined && row[colBPas] !== '') bobotPas = Number(row[colBPas]);
            if (row[colKkm] !== undefined && row[colKkm] !== '') kkm = Number(row[colKkm]);
          }
        }
      }

      if (sheetNilaiAkt && Object.keys(nilaiIdToSiswaId).length > 0 && sheetNilaiAkt.getLastRow() >= 2) {
        var rawAkt = sheetNilaiAkt.getRange(1, 1, sheetNilaiAkt.getLastRow(), sheetNilaiAkt.getLastColumn()).getValues();
        var hMapAkt = getHeaderIndexMap(rawAkt[0]);
        var colNIdA = hMapAkt['nilaiid'] !== undefined ? hMapAkt['nilaiid'] : 1;
        var colAKeA = hMapAkt['aktivitaske'] !== undefined ? hMapAkt['aktivitaske'] : 2;
        var colNilA = hMapAkt['nilai'] !== undefined ? hMapAkt['nilai'] : 3;

        for (var a = 1; a < rawAkt.length; a++) {
          var aRow = rawAkt[a];
          var nId = aRow[colNIdA];
          var sId = nilaiIdToSiswaId[nId];
          var aKe = aRow[colAKeA];
          var val = aRow[colNilA] !== undefined ? aRow[colNilA] : '';
          if (sId && aKe) {
            aktivitasMap[sId + '_' + aKe] = val;
            var numA = parseInt(aKe, 10);
            if (!isNaN(numA) && numA > maxAct) maxAct = numA;
          }
        }
      }
    }

    return {
      success: true,
      kelas: kelasAjar,
      siswa: listSiswa,
      aktivitasMap: aktivitasMap,
      pasMap: pasMap,
      bobotAct: bobotAct,
      bobotPas: bobotPas,
      kkm: kkm,
      maxAct: maxAct
    };
  } catch (err) {
    return { success: false, message: err.message, siswa: [], aktivitasMap: {}, pasMap: {} };
  }
}

/**
 * SIMPAN NILAI: BATCH IN-MEMORY 2D ARRAY
 * Mengubah ratusan pemanggilan setValue() lambat menjadi 2 kali setValues() instan.
 */
function saveNilaiData(token, pengajaranId, semester, kkm, bobotAct, bobotPas, nilaiData, maxAct) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    var session = requireAuth(token);
    var ss = getDbSpreadsheet();
    var activeYear = getActiveAcademicYear();
    semester = semester || 'Ganjil';

    var sheetNilai = ss.getSheetByName('07_NILAI');
    var sheetNilaiAkt = ss.getSheetByName('08_NILAI_AKTIVITAS');

    if (!sheetNilai || !sheetNilaiAkt) {
      return { success: false, message: 'Sheet 07_NILAI atau 08_NILAI_AKTIVITAS tidak ditemukan.' };
    }

    var sheetMP = ss.getSheetByName('03_MASTER_PENGAJARAN');
    var pengajaranList = getSheetDataAsObjects(sheetMP);
    var targetPengajaran = pengajaranList.find(function(p) {
      return String(p.UserID || p.userId) === String(session.userId) && 
             String(p.PengajaranID || p.pengajaranId) === String(pengajaranId);
    });

    if (!targetPengajaran) {
      return { success: false, message: 'Anda tidak memiliki hak akses menyimpan nilai ini!' };
    }

    // 1. Siapkan 2D Array untuk 07_NILAI
    var lastRowN = sheetNilai.getLastRow();
    var lastColN = Math.max(15, sheetNilai.getLastColumn());
    var allNilaiData = [];
    var headersN = [];

    if (lastRowN >= 1) {
      allNilaiData = sheetNilai.getRange(1, 1, lastRowN, lastColN).getValues();
      headersN = allNilaiData[0];
    } else {
      headersN = ['NilaiID', 'UserID', 'TahunAjaran', 'PengajaranID', 'SiswaID', 'Semester', 'PAS', 'NilaiAktivitas', 'BobotAktivitas', 'BobotPAS', 'NilaiAkhir', 'StandarKelulusan', 'StatusKelulusan', 'CreatedAt', 'UpdatedAt'];
      allNilaiData = [headersN];
    }

    var hMapN = getHeaderIndexMap(headersN);
    var colN_Id = hMapN['nilaiid'] !== undefined ? hMapN['nilaiid'] : 0;
    var colN_User = hMapN['userid'] !== undefined ? hMapN['userid'] : 1;
    var colN_TA = hMapN['tahunajaran'] !== undefined ? hMapN['tahunajaran'] : 2;
    var colN_Peng = hMapN['pengajaranid'] !== undefined ? hMapN['pengajaranid'] : 3;
    var colN_Siswa = hMapN['siswaid'] !== undefined ? hMapN['siswaid'] : 4;
    var colN_Sem = hMapN['semester'] !== undefined ? hMapN['semester'] : 5;
    var colN_Pas = hMapN['pas'] !== undefined ? hMapN['pas'] : 6;
    var colN_Akt = hMapN['nilaiaktivitas'] !== undefined ? hMapN['nilaiaktivitas'] : 7;
    var colN_BAct = hMapN['bobotaktivitas'] !== undefined ? hMapN['bobotaktivitas'] : 8;
    var colN_BPas = hMapN['bobotpas'] !== undefined ? hMapN['bobotpas'] : 9;
    var colN_Na = hMapN['nilaiakhir'] !== undefined ? hMapN['nilaiakhir'] : 10;
    var colN_Kkm = hMapN['standarkelulusan'] !== undefined ? hMapN['standarkelulusan'] : 11;
    var colN_Stat = hMapN['statuskelulusan'] !== undefined ? hMapN['statuskelulusan'] : 12;
    var colN_Cre = hMapN['createdat'] !== undefined ? hMapN['createdat'] : 13;
    var colN_Upd = hMapN['updatedat'] !== undefined ? hMapN['updatedat'] : 14;

    // Lookup map 07_NILAI berdasarkan SiswaID
    var nilaiRowMap = {};
    for (var r = 1; r < allNilaiData.length; r++) {
      var nRow = allNilaiData[r];
      var rSem = String(nRow[colN_Sem] || '').toLowerCase();
      var tSem = String(semester).toLowerCase();
      var matchSem = rSem === tSem || (tSem === 'ganjil' && rSem === '1') || (tSem === 'genap' && rSem === '2');

      if (String(nRow[colN_User]) === String(session.userId) &&
          String(nRow[colN_Peng]) === String(pengajaranId) &&
          matchSem &&
          String(nRow[colN_TA]) === String(activeYear)) {
        var sIdKey = String(nRow[colN_Siswa]);
        nilaiRowMap[sIdKey] = r;
      }
    }

    // 2. Siapkan 2D Array untuk 08_NILAI_AKTIVITAS
    var lastRowAkt = sheetNilaiAkt.getLastRow();
    var lastColAkt = Math.max(6, sheetNilaiAkt.getLastColumn());
    var allAktData = [];
    var headersAkt = [];

    if (lastRowAkt >= 1) {
      allAktData = sheetNilaiAkt.getRange(1, 1, lastRowAkt, lastColAkt).getValues();
      headersAkt = allAktData[0];
    } else {
      headersAkt = ['NilaiAktivitasID', 'NilaiID', 'AktivitasKe', 'Nilai', 'CreatedAt', 'UpdatedAt'];
      allAktData = [headersAkt];
    }

    var hMapAkt = getHeaderIndexMap(headersAkt);
    var colA_Id = hMapAkt['nilaiaktivitasid'] !== undefined ? hMapAkt['nilaiaktivitasid'] : 0;
    var colA_NId = hMapAkt['nilaiid'] !== undefined ? hMapAkt['nilaiid'] : 1;
    var colA_Ke = hMapAkt['aktivitaske'] !== undefined ? hMapAkt['aktivitaske'] : 2;
    var colA_Nil = hMapAkt['nilai'] !== undefined ? hMapAkt['nilai'] : 3;
    var colA_Cre = hMapAkt['createdat'] !== undefined ? hMapAkt['createdat'] : 4;
    var colA_Upd = hMapAkt['updatedat'] !== undefined ? hMapAkt['updatedat'] : 5;

    // Lookup map 08_NILAI_AKTIVITAS berdasarkan (NilaiID + '_' + AktivitasKe)
    var aktRowMap = {};
    for (var a = 1; a < allAktData.length; a++) {
      var aRow = allAktData[a];
      var keyAkt = String(aRow[colA_NId]) + '_' + String(aRow[colA_Ke]);
      aktRowMap[keyAkt] = a;
    }

    var now = new Date();

    (nilaiData || []).forEach(function(item) {
      var sId = String(item.siswaId || '');
      var pasRaw = item.pas;
      var pasVal = (pasRaw !== '' && !isNaN(Number(pasRaw))) ? Number(pasRaw) : '';

      var aktList = item.aktivitas || [];
      var sumAkt = 0;
      var countAkt = 0;

      aktList.forEach(function(akt) {
        var v = akt.nilai;
        if (v !== '' && !isNaN(Number(v))) {
          sumAkt += Number(v);
          countAkt++;
        }
      });

      var avgAkt = countAkt > 0 ? (sumAkt / countAkt) : '';
      var bAct = Number(bobotAct) || 66;
      var bPas = Number(bobotPas) || 34;
      var totalB = bAct + bPas;
      
      var naVal = '';
      var statusLulus = '';

      if (avgAkt !== '' || pasVal !== '') {
        var aScore = avgAkt !== '' ? Number(avgAkt) : 0;
        var pScore = pasVal !== '' ? Number(pasVal) : 0;
        naVal = totalB > 0 ? Math.round(((aScore * bAct + pScore * bPas) / totalB) * 100) / 100 : 0;
        statusLulus = naVal >= (Number(kkm) || 75) ? 'LULUS' : 'TIDAK LULUS';
      }

      var targetNilaiId = '';

      if (nilaiRowMap[sId] !== undefined) {
        var rIdx = nilaiRowMap[sId];
        targetNilaiId = allNilaiData[rIdx][colN_Id];
        allNilaiData[rIdx][colN_Pas] = pasVal;
        allNilaiData[rIdx][colN_Akt] = avgAkt;
        allNilaiData[rIdx][colN_BAct] = bAct;
        allNilaiData[rIdx][colN_BPas] = bPas;
        allNilaiData[rIdx][colN_Na] = naVal;
        allNilaiData[rIdx][colN_Kkm] = kkm;
        allNilaiData[rIdx][colN_Stat] = statusLulus;
        allNilaiData[rIdx][colN_Sem] = semester;
        allNilaiData[rIdx][colN_Upd] = now;
      } else {
        targetNilaiId = 'NIL-' + Utilities.getUuid().substring(0, 8).toUpperCase();
        var newNRow = new Array(headersN.length);
        newNRow[colN_Id] = targetNilaiId;
        newNRow[colN_User] = session.userId;
        newNRow[colN_TA] = activeYear;
        newNRow[colN_Peng] = pengajaranId;
        newNRow[colN_Siswa] = sId;
        newNRow[colN_Sem] = semester;
        newNRow[colN_Pas] = pasVal;
        newNRow[colN_Akt] = avgAkt;
        newNRow[colN_BAct] = bAct;
        newNRow[colN_BPas] = bPas;
        newNRow[colN_Na] = naVal;
        newNRow[colN_Kkm] = kkm;
        newNRow[colN_Stat] = statusLulus;
        newNRow[colN_Cre] = now;
        newNRow[colN_Upd] = now;

        allNilaiData.push(newNRow);
        nilaiRowMap[sId] = allNilaiData.length - 1;
      }

      aktList.forEach(function(akt) {
        var aKe = String(akt.aktivitasKe || '');
        var aVal = (akt.nilai !== '' && !isNaN(Number(akt.nilai))) ? Number(akt.nilai) : (akt.nilai || '');
        var aKey = targetNilaiId + '_' + aKe;

        if (aktRowMap[aKey] !== undefined) {
          var arIdx = aktRowMap[aKey];
          allAktData[arIdx][colA_Nil] = aVal;
          allAktData[arIdx][colA_Upd] = now;
        } else if (aVal !== '') {
          var nakId = 'NAK-' + Utilities.getUuid().substring(0, 8).toUpperCase();
          var newAktRow = new Array(headersAkt.length);
          newAktRow[colA_Id] = nakId;
          newAktRow[colA_NId] = targetNilaiId;
          newAktRow[colA_Ke] = aKe;
          newAktRow[colA_Nil] = aVal;
          newAktRow[colA_Cre] = now;
          newAktRow[colA_Upd] = now;

          allAktData.push(newAktRow);
          aktRowMap[aKey] = allAktData.length - 1;
        }
      });
    });

    // 3. Tulis SELURUH data kembali dengan 1 panggilan setValues() masing-masing
    sheetNilai.getRange(1, 1, allNilaiData.length, headersN.length).setValues(allNilaiData);
    sheetNilaiAkt.getRange(1, 1, allAktData.length, headersAkt.length).setValues(allAktData);

    logActivity(session.userId, 'SAVE_NILAI', 'NILAI', 'Menyimpan nilai batch PengajaranID: ' + pengajaranId + ', Semester: ' + semester);
    return { success: true, message: 'Nilai berhasil disimpan!' };
  } catch (err) {
    return { success: false, message: 'Gagal menyimpan nilai: ' + err.message };
  } finally {
    lock.releaseLock();
  }
}

function getPengajaranGuru(token) {
  try {
    var session = requireAuth(token);
    var ss = getDbSpreadsheet();
    var sheetPengajaran = ss.getSheetByName('03_MASTER_PENGAJARAN');
    if (!sheetPengajaran) return { success: false, message: 'Sheet 03_MASTER_PENGAJARAN tidak ditemukan.', data: [] };

    var taAktif = getActiveAcademicYear();
    var listPengajaran = getSheetDataAsObjects(sheetPengajaran);

    var refs = getReferencesData();
    var mapelMap = {};
    if (refs && refs.references && refs.references.MataPelajaran) {
      refs.references.MataPelajaran.forEach(function(m) {
        if (m.code) mapelMap[m.code] = m.name;
        if (m.id) mapelMap[m.id] = m.name;
      });
    }

    var result = listPengajaran.filter(function(p) {
      var uId = p.UserID || p.userId;
      var ta = p.TahunAjaran || p.tahunAjaran;
      return String(uId) === String(session.userId) && String(ta) === String(taAktif);
    }).map(function(p) {
      var mapelId = p.MataPelajaranID || p.mataPelajaranId || '';
      var mapelName = mapelMap[mapelId] || mapelId;
      var kelas = p.Kelas || p.kelas || '';
      var pengajaranId = p.PengajaranID || p.pengajaranId || '';
      return {
        pengajaranId: pengajaranId,
        mapelId: mapelId,
        mapelNama: mapelName,
        kelas: kelas,
        displayText: mapelName + ' - Kelas ' + kelas
      };
    });

    return { success: true, data: result };
  } catch (err) {
    return { success: false, message: err.message, data: [] };
  }
}

// ============================================================================
// JURNAL LKH SERVICES (ACCELERATED)
// ============================================================================

function getOrInitLkhReferences(sheetRef) {
  var initialUraian = [
    'Pembiasaan Sholat Dhuha Bersama',
    'Pembiasaan membaca ayat suci Al-Qur’an',
    'Pelaksanaan Briefing rutinan setiap awal bulan',
    'Melaksanakan KBM, yaitu siswa mengerjakan latihan soal konsep pendapatan nasional',
    'Melaksanakan KBM, yaitu membahas materi tentang pendapatan nasional'
  ];
  var initialHasil = [
    'Siswa memahami materi dengan baik',
    'Tugas terselesaikan tepat waktu',
    'Siswa aktif dalam diskusi kelas'
  ];

  var allRefs = getSheetDataAsObjects(sheetRef);
  var uraianRefs = allRefs.filter(function(r) {
    return String(r.ReferenceType) === 'UraianKerja' && String(r.Status || 'ACTIVE').toUpperCase() === 'ACTIVE';
  });
  var hasilRefs = allRefs.filter(function(r) {
    return String(r.ReferenceType) === 'Hasil' && String(r.Status || 'ACTIVE').toUpperCase() === 'ACTIVE';
  });

  var now = new Date();

  if (uraianRefs.length === 0) {
    initialUraian.forEach(function(item, idx) {
      var refId = 'REF-UK-' + (idx + 1);
      var refCode = 'UK_' + (idx + 1);
      sheetRef.appendRow([refId, 'UraianKerja', refCode, item, idx + 1, 'ACTIVE', now, now]);
    });
    uraianRefs = initialUraian.map(function(item) { return { ReferenceName: item }; });
  }

  if (hasilRefs.length === 0) {
    initialHasil.forEach(function(item, idx) {
      var refId = 'REF-HS-' + (idx + 1);
      var refCode = 'HS_' + (idx + 1);
      sheetRef.appendRow([refId, 'Hasil', refCode, item, idx + 1, 'ACTIVE', now, now]);
    });
    hasilRefs = initialHasil.map(function(item) { return { ReferenceName: item }; });
  }

  return {
    listUraian: uraianRefs.map(function(r) { return r.ReferenceName || r.name; }),
    listHasil: hasilRefs.map(function(r) { return r.ReferenceName || r.name; })
  };
}

function appendReferenceIfNew(sheetRef, refType, value) {
  if (!value || typeof value !== 'string') return;
  var trimmed = value.trim();
  if (!trimmed) return;

  var allRefs = getSheetDataAsObjects(sheetRef);
  var exists = allRefs.some(function(r) {
    return String(r.ReferenceType) === refType && 
           String(r.ReferenceName || '').trim().toLowerCase() === trimmed.toLowerCase();
  });

  if (!exists) {
    var prefix = (refType === 'UraianKerja') ? 'UK' : ((refType === 'Hasil') ? 'HS' : 'REF');
    var refId = 'REF-' + prefix + '-' + Utilities.getUuid().substring(0, 8).toUpperCase();
    var refCode = prefix + '_' + Utilities.getUuid().substring(0, 6).toUpperCase();
    var now = new Date();
    sheetRef.appendRow([refId, refType, refCode, trimmed, 99, 'ACTIVE', now, now]);
    // Bersihkan cache referensi agar data baru langsung masuk
    removeFromCache('ref_data_v11');
    removeFromCache('lkh_init_v11');
  }
}

function getLkhInitialData(token) {
  try {
    var session = requireAuth(token);
    var cacheKey = 'lkh_init_v11_' + session.userId;
    var cached = getFromCache(cacheKey);
    if (cached) {
      return cached;
    }

    var ss = getDbSpreadsheet();
    var activeYear = getActiveAcademicYear();

    var listJam = [];
    var sheetJam = ss.getSheetByName('11_JAM_PELAJARAN');
    if (sheetJam) {
      var rawJam = getSheetDataAsObjects(sheetJam);
      listJam = rawJam.filter(function(j) {
        return !j.Status || String(j.Status).toUpperCase() === 'ACTIVE';
      }).map(function(j) {
        var jamKe = j.JamKe || j.jamKe;
        return { jamKe: jamKe, label: 'Jam Ke ' + jamKe };
      });
    }

    if (listJam.length === 0) {
      for (var i = 1; i <= 10; i++) {
        listJam.push({ jamKe: i, label: 'Jam Ke ' + i });
      }
    }

    var sheetMP = ss.getSheetByName('03_MASTER_PENGAJARAN');
    var listPengajaran = [];
    if (sheetMP) {
      var rawMP = getSheetDataAsObjects(sheetMP);
      var refs = getReferencesData();
      var mapelMap = {};
      if (refs && refs.references && refs.references.MataPelajaran) {
        refs.references.MataPelajaran.forEach(function(m) {
          if (m.code) mapelMap[m.code] = m.name;
          if (m.id) mapelMap[m.id] = m.name;
        });
      }

      listPengajaran = rawMP.filter(function(p) {
        return String(p.UserID || p.userId) === String(session.userId) &&
               String(p.TahunAjaran || p.tahunAjaran) === String(activeYear);
      }).map(function(p) {
        var mId = p.MataPelajaranID || p.mapelId || '';
        return {
          pengajaranId: p.PengajaranID || p.pengajaranId || '',
          mapelId: mId,
          mapelNama: mapelMap[mId] || mId,
          kelas: p.Kelas || p.kelas || ''
        };
      });
    }

    var listUraian = [];
    var listHasil = [];
    var sheetRef = ss.getSheetByName('10_REFERENSI');
    if (sheetRef) {
      var refData = getOrInitLkhReferences(sheetRef);
      listUraian = refData.listUraian;
      listHasil = refData.listHasil;
    }

    var mapelUtamaId = '';
    var mapelUtamaNama = '';
    var sheetMA = ss.getSheetByName('02_MASTER_AJAR');
    if (sheetMA) {
      var listMA = getSheetDataAsObjects(sheetMA);
      var existMA = listMA.find(function(m) { 
        var uId = m.UserID || m.userId || '';
        var tYr = m.TahunAjaran || m.tahunAjaran || '';
        return String(uId) === String(session.userId) && String(tYr) === String(activeYear); 
      });
      if (existMA && (existMA.MapelUtamaID || existMA.mapelUtamaId)) {
        mapelUtamaId = String(existMA.MapelUtamaID || existMA.mapelUtamaId).trim();
      }
    }
    if (mapelUtamaId && mapelMap[mapelUtamaId]) {
      mapelUtamaNama = mapelMap[mapelUtamaId];
    } else if (listPengajaran.length > 0) {
      mapelUtamaNama = listPengajaran[0].mapelNama;
    }

    var response = {
      success: true,
      listJam: listJam,
      pengajaran: listPengajaran,
      listUraian: listUraian,
      listHasil: listHasil,
      mapelUtamaId: mapelUtamaId,
      mapelUtamaNama: mapelUtamaNama
    };

    putToCache(cacheKey, response, 1800); // 30 menit cache per guru
    return response;
  } catch (e) {
    return { success: false, message: e.message, listJam: [], pengajaran: [], listUraian: [], listHasil: [] };
  }
}

function getLkhData(token, bulan, mapelId) {
  try {
    var session = requireAuth(token);
    var ss = getDbSpreadsheet();
    var activeYear = getActiveAcademicYear();
    var sheetLKH = ss.getSheetByName('09_LKH');

    if (!sheetLKH || sheetLKH.getLastRow() < 2) return { success: true, data: [] };

    var listLkh = getSheetDataAsObjects(sheetLKH);
    var userLkh = listLkh.filter(function(r) {
      var uId = r.UserID || r.userId;
      var tYr = r.TahunAjaran || r.tahunAjaran;
      return String(uId) === String(session.userId) && (!tYr || String(tYr) === String(activeYear));
    });

    var filtered = userLkh.filter(function(r) {
      var tglStr = r.Tanggal || r.tanggal;
      if (!tglStr) return false;
      var tgl = new Date(tglStr);

      if (bulan) {
        var m = tgl.getMonth() + 1;
        if (String(m) !== String(bulan)) return false;
      }

      if (mapelId) {
        var rMapel = r.MataPelajaranID || r.mataPelajaranId || '';
        if (String(rMapel) !== String(mapelId)) {
          return false;
        }
      }

      return true;
    });

    filtered.sort(function(a, b) {
      return new Date(a.Tanggal || a.tanggal) - new Date(b.Tanggal || b.tanggal);
    });

    return { success: true, data: filtered };
  } catch (e) {
    return { success: false, message: e.message, data: [] };
  }
}

/**
 * SIMPAN ATAU UPDATE RECORD LKH (DIOPTIMASI BULK IN-MEMORY)
 */
function saveLkhRecord(token, payload) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var session = requireAuth(token);
    var ss = getDbSpreadsheet();
    var activeYear = getActiveAcademicYear();
    var sheetLKH = ss.getSheetByName('09_LKH');
    if (!sheetLKH) return { success: false, message: 'Sheet 09_LKH tidak ditemukan.' };

    var now = new Date();
    var lkhId = payload.lkhId || '';
    var parafUrl = session.userRecord.ParafGuruURL || session.userRecord.parafUrl || '';
    var parafFileId = session.userRecord.ParafGuruFileID || '';

    // Pengelolaan auto-reference Uraian & Hasil
    var sheetRef = ss.getSheetByName('10_REFERENSI');
    if (sheetRef) {
      if (payload.uraianKerja) {
        appendReferenceIfNew(sheetRef, 'UraianKerja', payload.uraianKerja);
      }
      if (payload.hasil && !payload.isNonKbm) {
        appendReferenceIfNew(sheetRef, 'Hasil', payload.hasil);
      }
    }

    var lastRow = sheetLKH.getLastRow();
    var lastCol = Math.max(14, sheetLKH.getLastColumn());
    var allData = sheetLKH.getRange(1, 1, Math.max(1, lastRow), lastCol).getValues();
    var headers = allData[0];
    var hMap = getHeaderIndexMap(headers);

    var colLkhId = hMap['lkhid'] !== undefined ? hMap['lkhid'] : 0;
    var colUserId = hMap['userid'] !== undefined ? hMap['userid'] : 1;
    var colTA = hMap['tahunajaran'] !== undefined ? hMap['tahunajaran'] : 2;
    var colTgl = hMap['tanggal'] !== undefined ? hMap['tanggal'] : 3;
    var colMapel = hMap['matapelajaranid'] !== undefined ? hMap['matapelajaranid'] : 4;
    var colJam = hMap['jamke'] !== undefined ? hMap['jamke'] : 5;
    var colKelas = hMap['kelas'] !== undefined ? hMap['kelas'] : 6;
    var colUraian = hMap['uraiankerja'] !== undefined ? hMap['uraiankerja'] : 7;
    var colHasil = hMap['hasil'] !== undefined ? hMap['hasil'] : 8;
    var colNonKBM = hMap['harinonkbm'] !== undefined ? hMap['harinonkbm'] : 9;
    var colPFile = hMap['parafgurufileid'] !== undefined ? hMap['parafgurufileid'] : 10;
    var colParaf = hMap['parafguruurl'] !== undefined ? hMap['parafguruurl'] : 11;
    var colCre = hMap['createdat'] !== undefined ? hMap['createdat'] : 12;
    var colUpd = hMap['updatedat'] !== undefined ? hMap['updatedat'] : 13;

    // MODE EDIT / UPDATE RECORD LKH (Tulis 1 baris sekaligus via setValues)
    if (lkhId) {
      for (var r = 1; r < allData.length; r++) {
        var row = allData[r];
        if (String(row[colLkhId]) === String(lkhId) && String(row[colUserId]) === String(session.userId)) {
          row[colTgl] = payload.tanggal;
          row[colMapel] = payload.mapelId || '';
          row[colJam] = payload.jamKe || '';
          row[colKelas] = payload.isNonKbm ? '' : (payload.kelas || '');
          row[colUraian] = payload.uraianKerja || '';
          row[colHasil] = payload.isNonKbm ? '' : (payload.hasil || '');
          row[colNonKBM] = payload.isNonKbm ? 'YA' : 'TIDAK';
          if (parafUrl) row[colParaf] = parafUrl;
          row[colUpd] = now;

          sheetLKH.getRange(r + 1, 1, 1, headers.length).setValues([row]);
          logActivity(session.userId, 'UPDATE_LKH', 'LKH', 'Memperbarui LKH ID: ' + lkhId);
          return { success: true, message: 'LKH berhasil diperbarui!' };
        }
      }
    }

    // MODE TAMBAH BARU (INSERT ROW)
    var newId = 'LKH-' + Utilities.getUuid().substring(0, 8).toUpperCase();
    var newLkhRow = new Array(headers.length);
    newLkhRow[colLkhId] = newId;
    newLkhRow[colUserId] = session.userId;
    newLkhRow[colTA] = activeYear;
    newLkhRow[colTgl] = payload.tanggal;
    newLkhRow[colMapel] = payload.mapelId || '';
    newLkhRow[colJam] = payload.jamKe || '';
    newLkhRow[colKelas] = payload.isNonKbm ? '' : (payload.kelas || '');
    newLkhRow[colUraian] = payload.uraianKerja || '';
    newLkhRow[colHasil] = payload.isNonKbm ? '' : (payload.hasil || '');
    newLkhRow[colNonKBM] = payload.isNonKbm ? 'YA' : 'TIDAK';
    newLkhRow[colPFile] = parafFileId;
    newLkhRow[colParaf] = parafUrl;
    newLkhRow[colCre] = now;
    newLkhRow[colUpd] = now;

    sheetLKH.appendRow(newLkhRow);

    logActivity(session.userId, 'SAVE_LKH', 'LKH', 'Menambahkan LKH baru ID: ' + newId);
    return { success: true, message: 'LKH berhasil disimpan!' };
  } catch (e) {
    return { success: false, message: 'Gagal menyimpan LKH: ' + e.message };
  } finally {
    lock.releaseLock();
  }
}

function deleteLkhRecord(token, lkhId) {
  try {
    var session = requireAuth(token);
    var ss = getDbSpreadsheet();
    var sheetLKH = ss.getSheetByName('09_LKH');
    if (!sheetLKH) return { success: false, message: 'Sheet 09_LKH tidak ditemukan.' };

    var allLkh = getSheetDataAsObjects(sheetLKH);
    var match = allLkh.find(function(r) {
      return (r.LKHID || r.lkhId) === lkhId && String(r.UserID || r.userId) === String(session.userId);
    });

    if (match) {
      sheetLKH.deleteRow(match._rowIndex);
      logActivity(session.userId, 'DELETE_LKH', 'LKH', 'Menghapus LKH ID: ' + lkhId);
      return { success: true, message: 'LKH berhasil dihapus!' };
    }
    return { success: false, message: 'Data LKH tidak ditemukan.' };
  } catch (e) {
    return { success: false, message: 'Gagal menghapus LKH: ' + e.message };
  }
}


/**
 * Memperbarui / menyambung sesi user yang tersimpan di localStorage (Remember Me)
 * secara aman jika CacheService telah kedaluwarsa tanpa perlu input password ulang.
 */
function renewUserSession(usernameOrNip, cachedUserId) {
  try {
    if (!usernameOrNip && !cachedUserId) return null;
    var ss = getDbSpreadsheet();
    var sheetUsers = ss.getSheetByName('01_USERS');
    if (!sheetUsers) return null;

    var users = getSheetDataAsObjects(sheetUsers);
    var uClean = usernameOrNip ? String(usernameOrNip).replace(/['\s]/g, '').toLowerCase() : '';
    var uidClean = cachedUserId ? String(cachedUserId).trim() : '';

    var user = users.find(function(u) {
      var un = String(u.Username || u.username || '').replace(/['\s]/g, '').toLowerCase();
      var nip = String(u.NIP || u.nip || '').replace(/['\s]/g, '');
      var uid = String(u.UserID || u.userId || '').trim();
      return (uidClean && uid === uidClean) || (uClean && (un === uClean || nip.toLowerCase() === uClean));
    });

    if (!user || String(user.Status || user.status || 'ACTIVE').toUpperCase() !== 'ACTIVE') {
      return null;
    }

    var freshToken = createSession(user);
    logActivity(user.UserID || user.userId, 'RENEW_SESSION', 'AUTH', 'Auto-renew session (Remember Me)');

    var rawNipVal = user.NIP !== undefined ? user.NIP : (user.nip || '');
    var cleanNipVal = (typeof rawNipVal === 'number') ? rawNipVal.toFixed(0) : String(rawNipVal || '').replace(/['\s]/g, '');

    return {
      success: true,
      token: freshToken,
      user: {
        userId: user.UserID || user.userId,
        username: user.Username || user.username,
        namaLengkap: user.NamaLengkap || user.namaLengkap,
        namaTampilan: user.NamaTampilan || user.namaTampilan || user.NamaLengkap,
        nip: cleanNipVal,
        jabatan: resolveJabatanName(user.JabatanID || user.jabatanId, ss),
        jabatanId: user.JabatanID || user.jabatanId,
        gelarDepan: user.GelarDepan || user.gelarDepan,
        gelarBelakang: user.GelarBelakang || user.gelarBelakang,
        namaAtasan: user.NamaAtasan || user.namaAtasan,
        fotoUrl: user.FotoURL || user.fotoUrl,
        parafUrl: resolveParafDataUrl(user)
      }
    };
  } catch (e) {
    return null;
  }
}
