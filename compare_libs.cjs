const https = require('https');
const fs = require('fs');

const url = 'https://apis.data.go.kr/B551982/plr_v2/rlt_rdrm_info_v2?serviceKey=80j%2FK4JyieJVqIy2fT0qM5ziOrx42wpgHUNb%2BKZQOQ8fGYSohlz2aUfwIBnGQYO38KXJ2szvUBa%2FCOX2W95PuQ%3D%3D&pageNo=1&numOfRows=1000&type=json';

https.get(url, (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    const json = JSON.parse(data);
    const items = json.body.item;

    const apiLibs = [...new Set(items.map(i => i.pblibNm))];
    console.log('API 도서관 수: ' + apiLibs.length);

    const seatData = JSON.parse(fs.readFileSync('public/library_data.json', 'utf-8'));
    const seatLibNames = new Set(seatData.map(d => d.pblibNm));
    console.log('library_data.json 도서관 수: ' + seatLibNames.size);

    const missing = apiLibs.filter(name => !seatLibNames.has(name));
    console.log('\n좌석배치도 정보가 없는 도서관 (' + missing.length + '개):');
    missing.forEach(name => {
      const libItems = items.filter(i => i.pblibNm === name);
      const rooms = libItems.map(i => i.rdrmNm);
      const first = libItems[0];
      console.log('  - [' + first.lclgvNm + '] ' + name + ' (stdgCd:' + first.stdgCd + ', pblibId:' + first.pblibId + ') : ' + rooms.join(', '));
    });
  });
});
