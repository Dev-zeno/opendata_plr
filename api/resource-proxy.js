// API proxy to fetch binary/text resources and bypass Mixed Content
const http = require('http');
const https = require('https');
const { URL } = require('url');

module.exports = async function handler(req, res) {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.status(200).end();
        return;
    }

    const targetUrl = req.query.url;
    if (!targetUrl) {
        res.status(400).send('URL parameter is required');
        return;
    }

    let finalUrlStr = targetUrl;
    try {
        const parsedTarget = new URL(targetUrl);
        for (const [key, value] of Object.entries(req.query)) {
            if (key !== 'url') {
                if (Array.isArray(value)) {
                    value.forEach(v => parsedTarget.searchParams.append(key, v));
                } else {
                    parsedTarget.searchParams.append(key, value);
                }
            }
        }
        finalUrlStr = parsedTarget.href;
    } catch(e) {}

    try {
        const parsedUrl = new URL(finalUrlStr);
        const client = parsedUrl.protocol === 'https:' ? https : http;

        const request = client.get(finalUrlStr, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': req.headers.accept || '*/*',
                'Accept-Language': req.headers['accept-language'] || 'ko-KR,ko;q=0.9',
            }
        }, (response) => {
            // 리다이렉트 처리
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                const redirectUrl = new URL(response.headers.location, targetUrl).href;
                // 리다이렉션도 동일한 resource-proxy를 통해 우회 (브라우저가 하도록 302 반환)
                res.writeHead(response.statusCode, {
                    ...response.headers,
                    'Location': `/api/resource-proxy?url=${encodeURIComponent(redirectUrl)}`,
                    'Access-Control-Allow-Origin': '*'
                });
                res.end();
                return;
            }

            // 원본 헤더 전달
            const headersToForward = ['content-type', 'content-length', 'cache-control', 'etag', 'last-modified', 'access-control-allow-origin'];
            headersToForward.forEach(key => {
                if (response.headers[key]) {
                    res.setHeader(key, response.headers[key]);
                }
            });
            res.setHeader('Access-Control-Allow-Origin', '*');

            res.status(response.statusCode || 200);
            response.pipe(res);
        });

        request.on('error', (err) => {
            console.error('Resource proxy error:', err.message);
            res.status(502).send('Bad Gateway');
        });
        
        request.setTimeout(10000, () => {
            request.destroy();
            res.status(504).send('Gateway Timeout');
        });

    } catch (error) {
        console.error('Resource proxy URL parse error:', error.message);
        res.status(400).send('Invalid URL');
    }
};
