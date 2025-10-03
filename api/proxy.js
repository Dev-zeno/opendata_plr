// api/proxy.js - Using Node.js built-in https module
const https = require('https');

module.exports = async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
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
    const url = `https://opendata.klid.or.kr/hapi/pblib/info?pageNo=1&numOfRows=1000&serviceKey=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzUxMiJ9.eyJzdWIiOiJzZXJ2aWNlX2tleSIsImV4cCI6MjA1MjAxNDEwMywidXNlcl9jb2RlIjoiSE9NRSIsInVzZXJfcm9sZSI6InBiZG8ifQ.exJZSk_ABg7Jv3AaS0dsUzOFqT39F8M_gntxZt2EthZM40uqI9-RQtz7HTHd5UeFMF4brphJTYkmXDVg74_YTg';
    // const url = `https://apis.data.go.kr/B551982/plr/info?serviceKey=80j%2FK4JyieJVqIy2fT0qM5ziOrx42wpgHUNb%2BKZQOQ8fGYSohlz2aUfwIBnGQYO38KXJ2szvUBa%2FCOX2W95PuQ%3D%3D&pageNo=1&numOfRows=1000&type=json`;
    
    const data = await new Promise((resolve, reject) => {
      https.get(url, (response) => {
        let data = '';
        
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(new Error('Invalid JSON response'));
          }
        });
      }).on('error', (error) => {
        reject(error);
      });
    });
    
    res.status(200).json(data);
  } catch (error) {
    console.error('Proxy error for library info:', error);
    res.status(500).json({ error: 'Failed to fetch library data' });
  }
};
