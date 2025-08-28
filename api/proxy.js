// api/proxy.js
const axios = require('axios');

export default async function handler(req, res) {
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
    const url = `https://apis.data.go.kr/B551982/plr/info?serviceKey=80j%2FK4JyieJVqIy2fT0qM5ziOrx42wpgHUNb%2BKZQOQ8fGYSohlz2aUfwIBnGQYO38KXJ2szvUBa%2FCOX2W95PuQ%3D%3D&pageNo=1&numOfRows=1000&type=json`;
    const response = await axios.get(url);
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Proxy error for library info:', error);
    res.status(500).json({ error: 'Failed to fetch library data' });
  }
}