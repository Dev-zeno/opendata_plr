// Vercel 서버리스 함수 - 좌석배치도 URL 매핑 데이터 제공
const https = require('https');
const path = require('path');
const fs = require('fs');

module.exports = async function handler(req, res) {
    console.log('Seat map proxy called');
    
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    
    try {
        // 1순위: 로컬 파일에서 읽기 (개발 환경)
        let data;
        const localPath = path.join(process.cwd(), 'public', 'library_data.json');
        
        if (fs.existsSync(localPath)) {
            const fileContent = fs.readFileSync(localPath, 'utf-8');
            data = JSON.parse(fileContent);
        } else {
            // 2순위: GitHub에서 가져오기 (Vercel 배포 환경)
            const apiUrl = 'https://raw.githubusercontent.com/Dev-zeno/opendata_plr/main/library_data.json';
            
            data = await new Promise((resolve, reject) => {
                https.get(apiUrl, {
                    headers: {
                        'User-Agent': 'OpenData-Library-App/1.0'
                    }
                }, (response) => {
                    let rawData = '';
                    response.on('data', (chunk) => { rawData += chunk; });
                    response.on('end', () => {
                        try {
                            resolve(JSON.parse(rawData));
                        } catch (error) {
                            reject(new Error('Invalid JSON response'));
                        }
                    });
                }).on('error', (error) => {
                    reject(error);
                });
            });
        }
        
        let formattedData = data;
        if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object' && 'pblibNm' in data[0]) {
            const libraryMap = {};
            data.forEach(item => {
                const libName = item.pblibNm;
                if (!libraryMap[libName]) {
                    libraryMap[libName] = { name: libName, rooms: [] };
                }
                if (item.rdrmNm && item.rdrmUrl) {
                    libraryMap[libName].rooms.push({
                        name: item.rdrmNm,
                        url: item.rdrmUrl
                    });
                }
            });
            formattedData = Object.values(libraryMap);
        }
        
        console.log('Seat map data loaded successfully');
        res.status(200).json(formattedData);
        
    } catch (error) {
        console.error('Error loading seat map data:', error.message);
        
        // 빈 배열이라도 반환하여 앱이 크래시하지 않도록
        res.status(200).json([]);
    }
};