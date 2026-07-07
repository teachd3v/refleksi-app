const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_FILE = path.join(__dirname, 'submissions.json');
const CSV_FILE = path.join(__dirname, 'submissions.csv');

// Middleware
app.use(express.json());
app.use(express.static(__dirname));

// Ensure database files exist
function initDatabase() {
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf8');
    }
    if (!fs.existsSync(CSV_FILE)) {
        const headers = 'Timestamp,Nama,Wilayah,Kampus,Fokus Waktu,Paling Bermakna,Roles,Dominan,Terberat,Diabaikan,Paling Bangga,Penerima Dampak,Kontribusi,Perubahan,Detail Waktu\n';
        fs.writeFileSync(CSV_FILE, headers, 'utf8');
    }
}
initDatabase();

// API: Submit reflection data
app.post('/api/submit', async (req, res) => {
    try {
        const submission = req.body;
        submission.timestamp = new Date().toISOString();

        // 1. Save to JSON File
        const fileData = fs.readFileSync(DATA_FILE, 'utf8');
        const submissions = JSON.parse(fileData);
        
        // Prevent duplicate entries for the same person (update if exists, otherwise push)
        const existingIdx = submissions.findIndex(s => s.selectedUser?.name === submission.selectedUser?.name);
        if (existingIdx !== -1) {
            submissions[existingIdx] = submission;
        } else {
            submissions.push(submission);
        }
        
        fs.writeFileSync(DATA_FILE, JSON.stringify(submissions, null, 2), 'utf8');

        // 2. Save/Append to CSV File (Spreadsheet database)
        // Clean strings from commas and quotes for CSV
        const escapeCSV = (str) => {
            if (!str) return '';
            const cleaned = str.toString().replace(/"/g, '""');
            return cleaned.includes(',') || cleaned.includes('\n') || cleaned.includes('"') ? `"${cleaned}"` : cleaned;
        };

        const row = [
            escapeCSV(submission.timestamp),
            escapeCSV(submission.selectedUser?.name),
            escapeCSV(submission.selectedUser?.region),
            escapeCSV(submission.selectedUser?.campus),
            escapeCSV(submission.timeAudit?.mostTime),
            escapeCSV(submission.timeAudit?.mostMeaning),
            escapeCSV(submission.roles?.map(r => r.name).join('; ')),
            escapeCSV(submission.roleReflection?.dominant),
            escapeCSV(submission.roleReflection?.heaviest),
            escapeCSV(submission.roleReflection?.neglected),
            escapeCSV(submission.roleReflection?.proud),
            escapeCSV(submission.contribution?.person),
            escapeCSV(submission.contribution?.action),
            escapeCSV(submission.contribution?.change),
            escapeCSV(submission.timeAudit?.categories ? JSON.stringify(submission.timeAudit.categories) : '')
        ].join(',') + '\n';

        // Re-write CSV file entirely to keep it synced and avoid duplicate entries
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

        // Forward data to Google Apps Script Web App
        await forwardToGoogleSheets(submission);

        res.status(200).json({ success: true, message: 'Refleksi berhasil disimpan ke database spreadsheet!' });
    } catch (error) {
        console.error('Error saving submission:', error);
        res.status(500).json({ success: false, error: error.message || 'Gagal menyimpan data ke backend.' });
    }
});

// API: Get all submissions
// Fetch data from Google Sheets first, with local backup as fallback
app.get('/api/submissions', async (req, res) => {
    try {
        const url = 'https://script.google.com/macros/s/AKfycbyKKBGLNVeDgJQc8MX61QJzbEYzBCUw16KRzVu6q3dFL1nBo0cOv_3nFpfbv0k01w-nmg/exec';
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
        const fileData = fs.readFileSync(DATA_FILE, 'utf8');
        const submissions = JSON.parse(fileData);
        res.status(200).json(submissions);
    } catch (error) {
        console.error('Error reading submissions from backup:', error);
        res.status(500).json({ success: false, error: 'Gagal mengambil data dari database.' });
    }
});

// Serve frontend admin page
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'admin.html'));
});

// Helper: Forward data to Google Apps Script Web App
async function forwardToGoogleSheets(data) {
    const url = 'https://script.google.com/macros/s/AKfycbyKKBGLNVeDgJQc8MX61QJzbEYzBCUw16KRzVu6q3dFL1nBo0cOv_3nFpfbv0k01w-nmg/exec';
    
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

// Start Server
app.listen(PORT, () => {
    console.log(`Server RuangRefleksi backend berjalan di http://localhost:${PORT}`);
});
