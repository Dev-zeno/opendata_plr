// api/proxy-reading-room.js
const axios = require('axios');

module.exports = async (req, res) => {
  try {
    const url = `https://apis.data.go.kr/B551982/plr/rlt_rdrm_info?serviceKey=${process.env.PUBLIC_API_KEY}&pageNo=1&numOfRows=1000&type=json`;
    const response = await axios.get(url);
    res.status(200).json(response.data);
  } catch (error) {
    console.error('Proxy error for reading room:', error);
    res.status(500).json({ error: 'Failed to fetch reading room data' });
  }
};