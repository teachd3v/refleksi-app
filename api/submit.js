// Vercel Serverless Function: POST /api/submit
module.exports = async (req, res) => {
    // Only allow POST
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });
    }

    try {
        const submission = req.body;
        if (!submission) {
            return res.status(400).json({ success: false, error: 'Data refleksi tidak boleh kosong' });
        }

        submission.timestamp = new Date().toISOString();

        // Forward data ke Google Apps Script Web App
        const url = 'https://script.google.com/macros/s/AKfycbyKKBGLNVeDgJQc8MX61QJzbEYzBCUw16KRzVu6q3dFL1nBo0cOv_3nFpfbv0k01w-nmg/exec';
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(submission)
        });

        if (!response.ok) {
            throw new Error(`Google Sheets responded with status ${response.status}`);
        }

        const resData = await response.json();
        if (resData.result === 'error') {
            throw new Error(`Google Sheets Apps Script Error: ${resData.error}`);
        }

        return res.status(200).json({ success: true, message: 'Refleksi berhasil disimpan ke database spreadsheet!' });
    } catch (error) {
        console.error('Error saving submission:', error);
        return res.status(500).json({ success: false, error: error.message || 'Gagal menyimpan data ke backend.' });
    }
};
