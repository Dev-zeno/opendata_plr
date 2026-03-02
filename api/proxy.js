// api/proxy.js - Using Node.js built-in https module
const https = require('https');
const xml2js = require('xml2js');

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

  // 1000줄 변경
  try {
    const url = 'https://apis.data.go.kr/B551982/plr_v2/info_v2?serviceKey=80j%2FK4JyieJVqIy2fT0qM5ziOrx42wpgHUNb%2BKZQOQ8fGYSohlz2aUfwIBnGQYO38KXJ2szvUBa%2FCOX2W95PuQ%3D%3D&pageNo=1&numOfRows=1000&type=JSON';

    const data = await new Promise((resolve, reject) => {
      https.get(url, (response) => {
        let data = '';

        response.on('data', (chunk) => {
          data += chunk;
        });

        response.on('end', () => {
          try {
            // 응답이 JSON 형식인지 XML 형식인지 확인
            if (data.trim().startsWith('{') || data.trim().startsWith('[')) {
              // JSON 형식인 경우
              resolve(JSON.parse(data));
            } else {
              // XML 형식인 경우
              const parser = new xml2js.Parser({ explicitArray: false });
              parser.parseString(data, (err, result) => {
                if (err) {
                  reject(new Error('Invalid XML response'));
                } else {
                  resolve(result);
                }
              });
            }
          } catch (error) {
            reject(new Error('Invalid response format'));
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