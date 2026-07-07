const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');

const app = express();

// Path to write files (Vercel has read-only filesystem except /tmp)
// We will write to /tmp/ on Vercel, but we wrap in try-catch so it never crashes
const DATA_FILE = path.join('/tmp', 'submissions.json');
const CSV_FILE = path.join('/tmp', 'submissions.csv');

// Middleware
app.use(express.json());

// Ensure files exist in /tmp
function initDatabase() {
    try {
        if (!fs.existsSync(DATA_FILE)) {
            fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf8');
        }
        if (!fs.existsSync(CSV_FILE)) {
            const headers = 'Timestamp,Nama,Wilayah,Kampus,Fokus Waktu,Paling Bermakna,Roles,Dominan,Terberat,Diabaikan,Paling Bangga,Penerima Dampak,Kontribusi,Perubahan,Detail Waktu\n';
            fs.writeFileSync(CSV_FILE, headers, 'utf8');
        }
    } catch (e) {
        console.warn('Gagal inisialisasi file lokal (Abaikan jika berjalan di Vercel):', e.message);
    }
}
initDatabase();

// API: Submit reflection data
app.post('/api/submit', (req, res) => {
    try {
        const submission = req.body;
        submission.timestamp = new Date().toISOString();

        // 1. Save to JSON File (Optional backup in /tmp)
        let submissions = [];
        try {
            if (fs.existsSync(DATA_FILE)) {
                const fileData = fs.readFileSync(DATA_FILE, 'utf8');
                submissions = JSON.parse(fileData);
            }
            const existingIdx = submissions.findIndex(s => s.selectedUser?.name === submission.selectedUser?.name);
            if (existingIdx !== -1) {
                submissions[existingIdx] = submission;
            } else {
                submissions.push(submission);
            }
            fs.writeFileSync(DATA_FILE, JSON.stringify(submissions, null, 2), 'utf8');
        } catch (e) {
            console.warn('Tidak dapat menulis database JSON lokal di Vercel:', e.message);
        }

        // 2. Save/Append to CSV File (Optional backup in /tmp)
        try {
            const escapeCSV = (str) => {
                if (!str) return '';
                const cleaned = str.toString().replace(/"/g, '""');
                return cleaned.includes(',') || cleaned.includes('\n') || cleaned.includes('"') ? `"${cleaned}"` : cleaned;
            };

            let csvContent = 'Timestamp,Nama,Wilayah,Kampus,Fokus Waktu,Paling Bermakna,Roles,Dominan,Terberat,Diabaikan,Paling Bangga,Penerima Dampak,Kontribusi,Perubahan,Detail Waktu\n';
            submissions.forEach(s => {
                csvContent += [
                    escapeCSV(s.timestamp),
                    escapeCSV(s.selectedUser?.name),
                    escapeCSV(s.selectedUser?.region),
                    escapeCSV(s.selectedUser?.campus),
                    escapeCSV(s.timeAudit?.mostTime),
                    escapeCSV(s.timeAudit?.mostMeaning),
                    escapeCSV(s.roles?.map(r => r.name).join('; ')),
                    escapeCSV(s.roleReflection?.dominant),
                    escapeCSV(s.roleReflection?.heaviest),
                    escapeCSV(s.roleReflection?.neglected),
                    escapeCSV(s.roleReflection?.proud),
                    escapeCSV(s.contribution?.person),
                    escapeCSV(s.contribution?.action),
                    escapeCSV(s.contribution?.change),
                    escapeCSV(s.timeAudit?.categories ? JSON.stringify(s.timeAudit.categories) : '')
                ].join(',') + '\n';
            });
            fs.writeFileSync(CSV_FILE, csvContent, 'utf8');
        } catch (e) {
            console.warn('Tidak dapat menulis database CSV lokal di Vercel:', e.message);
        }

        // 3. Forward data to Google Apps Script Web App (Database Utama)
        await forwardToGoogleSheets(submission);

        res.status(200).json({ success: true, message: 'Refleksi berhasil disimpan ke database spreadsheet!' });
    } catch (error) {
        console.error('Error saving submission:', error);
        res.status(500).json({ success: false, error: error.message || 'Gagal menyimpan data ke backend.' });
    }
});

// API: Get all submissions
// Fetch data from Google Sheets first, with local /tmp backup as fallback
app.get('/api/submissions', async (req, res) => {
    try {
        const url = 'https://script.google.com/macros/s/AKfycbyj6UwGAY3b6C6v0OO-B_Mnio8857iJsEH8Y3MKG0K4EFLFefE40DweFEiEC_0jmOs4Pw/exec';
        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data)) {
                return res.status(200).json(data);
            }
        }
    } catch (error) {
        console.warn('Gagal mengambil data dari Google Sheets, menggunakan database lokal:', error.message);
    }

    try {
        if (fs.existsSync(DATA_FILE)) {
            const fileData = fs.readFileSync(DATA_FILE, 'utf8');
            const submissions = JSON.parse(fileData);
            return res.status(200).json(submissions);
        }
        res.status(200).json([]);
    } catch (error) {
        console.error('Error reading submissions from backup:', error);
        res.status(500).json({ success: false, error: 'Gagal mengambil data dari database.' });
    }
});

// Helper: Forward data to Google Apps Script Web App
async function forwardToGoogleSheets(data) {
    const url = 'https://script.google.com/macros/s/AKfycbyj6UwGAY3b6C6v0OO-B_Mnio8857iJsEH8Y3MKG0K4EFLFefE40DweFEiEC_0jmOs4Pw/exec';
    
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });

    if (!response.ok) {
        throw new Error(`Google Sheets responded with status ${response.status}`);
    }

    const resData = await response.json();
    if (resData.result === 'error') {
        throw new Error(`Google Sheets Apps Script Error: ${resData.error}`);
    }
    return resData;
}

// Export Express app for Vercel Serverless Function
module.exports = app;
