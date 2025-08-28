const axios = require('axios');

// Vercel 서버리스 함수 형식으로 수정
export default async function handler(req, res) {
    console.log('Seat map proxy called');
    
    // CORS 헤더 설정 (Vercel 방식)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // OPTIONS 요청 처리 (CORS preflight)
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    // GET 요청만 허용
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    
    try {
        // GitHub에서 좌석배치도 데이터 가져오기
        const apiUrl = 'https://raw.githubusercontent.com/Dev-zeno/opendata_plr/refs/heads/main/library_data.json';
        
        const response = await axios.get(apiUrl, {
            timeout: 10000,
            headers: {
                'User-Agent': 'OpenData-Library-App/1.0'
            }
        });

        console.log('Seat map data fetched successfully');
        
        // 데이터 반환
        res.status(200).json(response.data);
        
    } catch (error) {
        console.error('Error fetching seat map data:', error.message);
        
        res.status(500).json({
            error: 'Failed to fetch seat map data',
            message: error.message
        });
    }
}