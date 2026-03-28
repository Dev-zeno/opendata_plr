// api/collect-data.js - Collects reading room data every 30 min and stores in Upstash Redis
const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  // Simple auth to prevent unauthorized calls
  const authHeader = req.headers['authorization'];
  const cronSecret = process.env.CRON_SECRET || '';
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const UPSTASH_URL = process.env.KV_REST_API_URL;
  const UPSTASH_TOKEN = process.env.KV_REST_API_TOKEN;

  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    res.status(500).json({ error: 'Redis credentials not configured' });
    return;
  }

  try {
    // 1. Fetch current reading room data from public API
    const rdrmUrl = 'https://apis.data.go.kr/B551982/plr_v2/rlt_rdrm_info_v2?serviceKey=80j%2FK4JyieJVqIy2fT0qM5ziOrx42wpgHUNb%2BKZQOQ8fGYSohlz2aUfwIBnGQYO38KXJ2szvUBa%2FCOX2W95PuQ%3D%3D&pageNo=1&numOfRows=1000&type=json';

    const rdrmData = await new Promise((resolve, reject) => {
      https.get(rdrmUrl, (response) => {
        let data = '';
        response.on('data', (chunk) => { data += chunk; });
        response.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error('Invalid JSON response')); }
        });
      }).on('error', reject);
    });

    const items = rdrmData?.response?.body?.items?.item || rdrmData?.body?.item || [];
    const itemsArray = Array.isArray(items) ? items : [items];

    if (itemsArray.length === 0) {
      res.status(200).json({ message: 'No data available', collected: 0 });
      return;
    }

    // 2. Aggregate by library (pblibNm + stdgCd as unique key)
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const kst = new Date(now.getTime() + kstOffset);
    const dayOfWeek = kst.getUTCDay(); // 0=Sun, 1=Mon...6=Sat
    const hour = kst.getUTCHours();
    const minute = kst.getUTCMinutes();
    const dateStr = kst.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
    const timeSlot = `${String(hour).padStart(2, '0')}${minute < 30 ? '00' : '30'}`;

    // Group items by library
    const libMap = {};
    itemsArray.forEach(item => {
      if (!item || !item.stdgCd || !item.pblibId) return;
      const libKey = `${item.stdgCd}-${item.pblibId}`;
      if (!libMap[libKey]) {
        libMap[libKey] = { totalSeats: 0, usedSeats: 0, availableSeats: 0 };
      }
      libMap[libKey].totalSeats += parseInt(item.tseatCnt || '0', 10);
      libMap[libKey].usedSeats += parseInt(item.useSeatCnt || '0', 10);
      libMap[libKey].availableSeats += Math.max(0, parseInt(item.rmndSeatCnt || '0', 10));
    });

    // 3. Store in Redis using REST API (pipeline)
    const pipeline = [];
    const TTL_SECONDS = 90 * 24 * 60 * 60; // 90 days (3 months)

    for (const [libKey, data] of Object.entries(libMap)) {
      const occupancy = data.totalSeats > 0
        ? Math.round((data.usedSeats / data.totalSeats) * 100)
        : 0;

      // Key: occ:{libKey}:{dayOfWeek}
      // Field: {timeSlot}:{dateStr}
      // Value: occupancy percentage
      const redisKey = `occ:${libKey}:${dayOfWeek}`;
      const field = `${timeSlot}:${dateStr}`;

      pipeline.push(['HSET', redisKey, field, String(occupancy)]);
      pipeline.push(['EXPIRE', redisKey, String(TTL_SECONDS)]);
    }

    // Execute pipeline via Upstash REST API
    const pipelineRes = await new Promise((resolve, reject) => {
      const body = JSON.stringify(pipeline);
      const url = new URL('/pipeline', UPSTASH_URL);
      const options = {
        method: 'POST',
        hostname: url.hostname,
        path: url.pathname,
        headers: {
          'Authorization': `Bearer ${UPSTASH_TOKEN}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      };

      const request = https.request(options, (response) => {
        let data = '';
        response.on('data', (chunk) => { data += chunk; });
        response.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { resolve(data); }
        });
      });
      request.on('error', reject);
      request.write(body);
      request.end();
    });

    res.status(200).json({
      message: 'Data collected successfully',
      collected: Object.keys(libMap).length,
      timeSlot: `${dateStr}-${timeSlot}`,
      dayOfWeek,
    });

  } catch (error) {
    console.error('Collection error:', error);
    res.status(500).json({ error: 'Failed to collect data', message: error.message });
  }
};
