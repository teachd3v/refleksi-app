// Vercel Serverless Function: GET /api/submissions
module.exports = async (req, res) => {
    // Only allow GET
    if (req.method !== 'GET') {
        res.setHeader('Allow', ['GET']);
        return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` });
    }

    // Edge cache header: simpan di Edge CDN selama 5 menit
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');

    try {
        const url = 'https://script.google.com/macros/s/AKfycbyKKBGLNVeDgJQc8MX61QJzbEYzBCUw16KRzVu6q3dFL1nBo0cOv_3nFpfbv0k01w-nmg/exec';
        const response = await fetch(url);
        
        if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data)) {
                return res.status(200).json(data);
            }
        }
        return res.status(200).json([]);
    } catch (error) {
        console.error('Error fetching submissions from Google Sheets:', error);
        return res.status(500).json({ success: false, error: 'Gagal mengambil data dari spreadsheet.' });
    }
};
