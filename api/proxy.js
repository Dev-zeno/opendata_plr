// api/proxy.js
const axios = require('axios');

module.exports = async (req, res) => {
  try {
    const url = `https://apis.data.go.kr/B551982/plr/info?serviceKey=80j%2FK4JyieJVqIy2fT0qM5ziOrx42wpgHUNb%2BKZQOQ8fGYSohlz2aUfwIBnGQYO38KXJ2szvUBa%2FCOX2W95PuQ%3D%3D&pageNo=1&numOfRows=1000&type=json`;
    const response = await axios.get(url);
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Proxy error for library info:', error);
    res.status(500).json({ error: 'Failed to fetch library data' });
  }
};