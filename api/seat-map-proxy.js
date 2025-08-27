const axios = require('axios');

async function seatMapProxy(req, res) {
    console.log('Seat map proxy called');
    
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
        
        // CORS 헤더 설정
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
        res.header('Access-Control-Allow-Headers', 'Content-Type');
        
        // 데이터 반환
        res.json(response.data);
        
    } catch (error) {
        console.error('Error fetching seat map data:', error.message);
        
        // CORS 헤더 설정 (에러 응답에도)
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
        res.header('Access-Control-Allow-Headers', 'Content-Type');
        
        res.status(500).json({
            error: 'Failed to fetch seat map data',
            message: error.message
        });
    }
}

module.exports = seatMapProxy;