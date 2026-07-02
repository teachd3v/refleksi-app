# Panduan Setup Google Sheets API Ke Aplikasi RuangRefleksi

Dokumen ini menjelaskan cara menghubungkan backend Node.js aplikasi **RuangRefleksi** langsung ke lembar kerja **Google Sheets** secara online.

Ada dua cara utama yang bisa kamu pilih:

---

## Metode 1: Menggunakan Google Apps Script (Sangat Direkomendasikan & Paling Mudah)
Metode ini tidak memerlukan konfigurasi Google Cloud Console yang rumit. Anda cukup menempelkan script kecil di Google Sheets Anda lalu mendeploynya sebagai Web App.

### Langkah 1: Siapkan Google Sheets Anda
1. Buat Google Sheets baru di Google Drive Anda.
2. Tulis baris pertama sebagai **Header** kolom (sesuaikan urutannya):
   `Timestamp` | `Nama` | `Wilayah` | `Kampus` | `Fokus Waktu` | `Paling Bermakna` | `Roles` | `Dominan` | `Terberat` | `Diabaikan` | `Paling Bangga` | `Penerima Dampak` | `Kontribusi` | `Perubahan`
3. Catat **ID Spreadsheet** Anda (ada di URL Google Sheets Anda):
   `https://docs.google.com/spreadsheets/d/ID_SPREADSHEET_ANDA/edit`

### Langkah 2: Buat Google Apps Script
1. Di Google Sheets Anda, klik menu **Ekstensi (Extensions)** -> **Apps Script**.
2. Hapus semua kode default di editor, lalu tempel kode berikut:

```javascript
function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);
    
    var nameToSearch = data.selectedUser ? data.selectedUser.name : '';
    
    // Format susunan kolom sesuai header sheet Anda
    var rowData = [
      new Date().toISOString(),
      nameToSearch,
      data.selectedUser ? data.selectedUser.region : '',
      data.selectedUser ? data.selectedUser.campus : '',
      data.timeAudit ? data.timeAudit.mostTime : '',
      data.timeAudit ? data.timeAudit.mostMeaning : '',
      data.roles ? data.roles.map(function(r){ return r.name; }).join('; ') : '',
      data.roleReflection ? data.roleReflection.dominant : '',
      data.roleReflection ? data.roleReflection.heaviest : '',
      data.roleReflection ? data.roleReflection.neglected : '',
      data.roleReflection ? data.roleReflection.proud : '',
      data.contribution ? data.contribution.person : '',
      data.contribution ? data.contribution.action : '',
      data.contribution ? data.contribution.change : ''
    ];
    
    // Cari apakah nama sudah terdaftar di kolom B (kolom ke-2)
    var rowFound = -1;
    if (sheet.getLastRow() > 1) {
      var nameColumnValues = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues(); // Mulai dari baris 2
      for (var i = 0; i < nameColumnValues.length; i++) {
        if (nameColumnValues[i][0] === nameToSearch) {
          rowFound = i + 2; // +2 karena index array mulai dari 0 dan kita mencari mulai dari baris 2
          break;
        }
      }
    }
    
    if (rowFound !== -1) {
      // Jika ditemukan, ganti baris data yang lama dengan yang baru (menimpa)
      sheet.getRange(rowFound, 1, 1, rowData.length).setValues([rowData]);
    } else {
      // Jika tidak ditemukan, buat baris baru di paling bawah
      sheet.appendRow(rowData);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ "result": "success" }))
                         .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ "result": "error", "error": error.toString() }))
                         .setMimeType(ContentService.MimeType.JSON);
  }
}
```

3. Klik ikon **Simpan (Save)** di atas editor.

### Langkah 3: Deploy sebagai Web App
1. Klik tombol **Terapkan (Deploy)** di pojok kanan atas -> pilih **Terapkan baru (New deployment)**.
2. Klik ikon gir (pilih jenis) -> Pilih **Aplikasi web (Web app)**.
3. Konfigurasikan:
   * **Deskripsi**: `Koneksi RuangRefleksi`
   * **Jalankan sebagai (Execute as)**: `Saya (Email Anda)`
   * **Siapa yang memiliki akses (Who has access)**: `Siapa saja (Anyone)` (Ini penting agar backend Node.js bisa mengirim data tanpa perlu login akun Google).
4. Klik **Terapkan (Deploy)**.
5. Google akan meminta izin otorisasi. Klik **Izinkan akses (Authorize access)** -> Login akun Google Anda -> Pilih **Lanjutan (Advanced)** -> Klik **Buka Koneksi RuangRefleksi (tidak aman)** -> Klik **Izinkan (Allow)**.
6. Salin **URL Aplikasi Web (Web App URL)** yang diberikan. URL-nya akan mirip seperti ini:
   `https://script.google.com/macros/s/AKfycb.../exec`

### Langkah 4: Hubungkan ke Backend NodeJS
1. Buka file [server.js](file:///C:/Users/Asus VivoBook/Documents/LOCALHOST/refleksi-app/server.js) Anda.
2. Di dalam endpoint `app.post('/api/submit', ...)`, tambahkan kode untuk meneruskan data ke URL Apps Script tersebut:

```javascript
// Install library unduhan (opsional jika menggunakan fetch bawaan NodeJS v18+)
// Di bagian atas server.js, teruskan data menggunakan fetch:
const fetch = require('node-fetch'); // jika NodeJS Anda versi lama (<18)

// Di dalam router POST /api/submit:
const APPS_SCRIPT_URL = "URL_WEB_APP_APPS_SCRIPT_ANDA_DISINI";
fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(submission)
})
.then(googleRes => googleRes.json())
.then(googleData => console.log('Data sukses diteruskan ke Google Sheets:', googleData))
.catch(err => console.error('Gagal mengirim ke Google Sheets:', err));
```

---

## Metode 2: Menggunakan Google Sheets API (Resmi via Google Cloud Console)
Metode ini lebih formal dan cocok untuk kebutuhan enterprise/production berskala besar.

### Langkah 1: Setup Google Cloud Console
1. Buka [Google Cloud Console](https://console.cloud.google.com/).
2. Buat Project Baru.
3. Di bilah pencarian, cari **Google Sheets API** lalu klik **Aktifkan (Enable)**.
4. Buka menu **APIs & Services** -> **Credentials**.
5. Klik **Create Credentials** -> Pilih **Service Account**.
6. Isi nama service account, lalu klik **Create and Continue** -> Pilih role (opsional, biarkan default) -> klik **Done**.
7. Klik pada alamat email service account yang baru dibuat -> Pilih tab **Keys** -> Klik **Add Key** -> **Create new key** -> Pilih format **JSON** -> Klik **Create**.
8. File JSON kredensial akan otomatis terunduh. Simpan file ini di direktori project Anda dengan nama `google-credentials.json` (Jangan unggah file ini ke GitHub publik karena bersifat rahasia!).

### Langkah 2: Bagikan Akses Google Sheets
1. Buka file JSON kredensial yang Anda unduh, lalu salin alamat email service account di dalam properti `client_email` (berakhiran `.gserviceaccount.com`).
2. Buka Google Sheets target Anda, klik tombol **Bagikan (Share)** di pojok kanan atas.
3. Tempel email service account tadi, beri akses sebagai **Editor**, lalu matikan centang pemberitahuan -> Klik **Bagikan (Share)**.

### Langkah 3: Install Package Google API di Node.js
Jalankan perintah berikut di terminal project Anda untuk menginstall package googleapis:
```bash
npm install googleapis
```

### Langkah 4: Tulis Kode Integrasi di NodeJS
Buka file `server.js` Anda dan gunakan kode berikut untuk melakukan append data ke Google Sheets secara langsung:

```javascript
const { google } = require('googleapis');
const keys = require('./google-credentials.json');

const client = new google.auth.JWT(
    keys.client_email,
    null,
    keys.private_key,
    ['https://www.googleapis.com/auth/spreadsheets']
);

async function appendToGoogleSheets(submission) {
    try {
        await client.authorize();
        const gsapi = google.sheets({ version: 'v4', auth: client });
        
        const spreadsheetId = 'ID_SPREADSHEET_GOOGLE_SHEETS_ANDA'; // Ganti dengan ID sheet Anda
        const range = 'Sheet1!A:N'; // Menyesuaikan nama tab dan range kolom
        
        const row = [
            new Date().toISOString(),
            submission.selectedUser?.name || '',
            submission.selectedUser?.region || '',
            submission.selectedUser?.campus || '',
            submission.timeAudit?.mostTime || '',
            submission.timeAudit?.mostMeaning || '',
            submission.roles?.map(r => r.name).join('; ') || '',
            submission.roleReflection?.dominant || '',
            submission.roleReflection?.heaviest || '',
            submission.roleReflection?.neglected || '',
            submission.roleReflection?.proud || '',
            submission.contribution?.person || '',
            submission.contribution?.action || '',
            submission.contribution?.change || ''
        ];

        const request = {
            spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [row] }
        };

        const response = await gsapi.spreadsheets.values.append(request);
        console.log('Sukses menulis data ke Google Sheets:', response.statusText);
    } catch (error) {
        console.error('Gagal menulis data ke Google Sheets:', error);
    }
}
```
Panggil fungsi `appendToGoogleSheets(submission)` ini di dalam endpoint `app.post('/api/submit', ...)` Anda.
