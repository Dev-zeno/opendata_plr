// api/get-stats.js - Returns aggregated occupancy stats for a library
const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const libId = req.query.id; // e.g. "1121500000-광진정보도서관"
  if (!libId) {
    res.status(400).json({ error: 'Library ID (id) is required' });
    return;
  }

  const UPSTASH_URL = process.env.KV_REST_API_URL;
  const UPSTASH_TOKEN = process.env.KV_REST_API_TOKEN;

  if (!UPSTASH_URL || !UPSTASH_TOKEN) {
    res.status(500).json({ error: 'Redis credentials not configured' });
    return;
  }

  try {
    // Get current KST day of week
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const kst = new Date(now.getTime() + kstOffset);
    const todayDow = kst.getUTCDay();

    // Determine which day to query (default: today, or use ?day= query param)
    const queryDay = req.query.day !== undefined ? parseInt(req.query.day, 10) : todayDow;

    // Fetch all data for this library + day from Redis
    const redisKey = `occ:${libId}:${queryDay}`;

    const redisRes = await new Promise((resolve, reject) => {
      const url = new URL(`/HGETALL/${encodeURIComponent(redisKey)}`, UPSTASH_URL);
      const options = {
        method: 'GET',
        hostname: url.hostname,
        path: `${url.pathname}${url.search}`,
        headers: {
          'Authorization': `Bearer ${UPSTASH_TOKEN}`,
        },
      };

      const request = https.request(options, (response) => {
        let data = '';
        response.on('data', (chunk) => { data += chunk; });
        response.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error('Invalid Redis response')); }
        });
      });
      request.on('error', reject);
      request.end();
    });

    // Parse Redis HGETALL result: { result: [field1, val1, field2, val2, ...] }
    const rawResult = redisRes?.result || [];
    if (!Array.isArray(rawResult) || rawResult.length === 0) {
      res.status(200).json({
        libraryId: libId,
        day: queryDay,
        dataPoints: 0,
        hourlyStats: [],
        peakHour: null,
        bestHour: null,
        message: '아직 수집된 데이터가 없습니다. 데이터 수집이 시작되면 통계가 표시됩니다.'
      });
      return;
    }

    // Group by time slot, average across dates
    const slotData = {}; // { "0900": [85, 90, 78, ...], "0930": [...], ... }
    for (let i = 0; i < rawResult.length; i += 2) {
      const field = rawResult[i]; // "0900:20260329"
      const value = parseInt(rawResult[i + 1], 10);
      const timeSlot = field.split(':')[0]; // "0900"

      if (!slotData[timeSlot]) slotData[timeSlot] = [];
      slotData[timeSlot].push(value);
    }

    // Calculate averages per time slot
    const hourlyStats = Object.entries(slotData)
      .map(([slot, values]) => ({
        time: slot,
        hour: parseInt(slot.substring(0, 2), 10),
        minute: parseInt(slot.substring(2, 4), 10),
        label: `${slot.substring(0, 2)}:${slot.substring(2, 4)}`,
        avgOccupancy: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
        maxOccupancy: Math.max(...values),
        minOccupancy: Math.min(...values),
        dataPoints: values.length,
      }))
      .sort((a, b) => a.time.localeCompare(b.time));

    // Find peak hour (highest average occupancy)
    const peakSlot = hourlyStats.reduce(
      (max, s) => (s.avgOccupancy > max.avgOccupancy ? s : max),
      hourlyStats[0]
    );

    // Find best hour (lowest average occupancy, but only during typical operating hours 7-22)
    const operatingSlots = hourlyStats.filter(s => s.hour >= 7 && s.hour <= 21);
    const bestSlot = operatingSlots.length > 0
      ? operatingSlots.reduce(
          (min, s) => (s.avgOccupancy < min.avgOccupancy ? s : min),
          operatingSlots[0]
        )
      : null;

    const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

    res.status(200).json({
      libraryId: libId,
      day: queryDay,
      dayName: dayNames[queryDay],
      dataPoints: rawResult.length / 2,
      hourlyStats,
      peakHour: peakSlot ? {
        label: peakSlot.label,
        occupancy: peakSlot.avgOccupancy,
        description: `${dayNames[queryDay]} 가장 붐비는 시간: ${peakSlot.label} (평균 ${peakSlot.avgOccupancy}%)`,
      } : null,
      bestHour: bestSlot ? {
        label: bestSlot.label,
        occupancy: bestSlot.avgOccupancy,
        description: `${dayNames[queryDay]} 추천 방문 시간: ${bestSlot.label} (평균 ${bestSlot.avgOccupancy}%)`,
      } : null,
    });

  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to get stats', message: error.message });
  }
};
