// Vercel 서버리스 함수 - iframe 프록시 (HTTPS/X-Frame-Options 우회)
const http = require('http');
const https = require('https');
const { URL } = require('url');

module.exports = async function handler(req, res) {
    // CORS 헤더 설정
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const targetUrl = req.query.url;
    if (!targetUrl) {
        res.status(400).send('URL parameter is required');
        return;
    }

    try {
        const parsedUrl = new URL(targetUrl);
        const client = parsedUrl.protocol === 'https:' ? https : http;
        let finalUrl = targetUrl;

        const data = await new Promise((resolve, reject) => {
            function decodeBuffer(buffer, contentTypeHeader) {
                let charset = 'utf-8';
                const contentType = contentTypeHeader || '';
                if (contentType.toLowerCase().includes('euc-kr')) {
                    charset = 'euc-kr';
                } else {
                    const head = buffer.toString('ascii', 0, Math.min(buffer.length, 2048)).toLowerCase();
                    if (head.includes('charset=euc-kr') || head.includes('charset="euc-kr"')) {
                        charset = 'euc-kr';
                    }
                }
                try {
                    return new TextDecoder(charset).decode(buffer);
                } catch (e) {
                    return buffer.toString('utf-8');
                }
            }

            const request = client.get(targetUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
                }
            }, (response) => {
                // 리다이렉트 처리
                if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    const redirectUrl = new URL(response.headers.location, targetUrl).href;
                    finalUrl = redirectUrl;
                    const redirectClient = redirectUrl.startsWith('https:') ? https : http;
                    redirectClient.get(redirectUrl, {
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                        }
                    }, (redirectResponse) => {
                        let chunks = [];
                        redirectResponse.on('data', chunk => { chunks.push(chunk); });
                        redirectResponse.on('end', () => {
                            const buffer = Buffer.concat(chunks);
                            resolve(decodeBuffer(buffer, redirectResponse.headers['content-type']));
                        });
                    }).on('error', reject);
                    return;
                }
                
                let chunks = [];
                response.on('data', (chunk) => { chunks.push(chunk); });
                response.on('end', () => {
                    const buffer = Buffer.concat(chunks);
                    resolve(decodeBuffer(buffer, response.headers['content-type']));
                });
            });
            
            request.on('error', reject);
            request.setTimeout(10000, () => {
                request.destroy();
                reject(new Error('Request timeout'));
            });
        });

        let html = data;

        // <base> 태그 삽입으로 상대경로 CSS/JS/이미지 수정
        const urlObj = new URL(finalUrl);
        const basePath = urlObj.pathname.substring(0, urlObj.pathname.lastIndexOf('/') + 1);
        const protocol = urlObj.protocol.replace(':', '');
        const host = urlObj.host;
        const mappedUrl = `/api/proxy/${protocol}/${host}${basePath}`;
        const baseTag = `<base href="${mappedUrl}">`;

        if (html.includes('<head>')) {
            html = html.replace('<head>', `<head>${baseTag}`);
        } else if (html.includes('<HEAD>')) {
            html = html.replace('<HEAD>', `<HEAD>${baseTag}`);
        } else {
            html = `${baseTag}${html}`;
        }

        // 1. 중첩 iframe/frame 의 절대경로(http://...)를 iframe-proxy로 우회
        html = html.replace(/(<i?frame[^>]*\ssrc=["'])(http:\/\/[^"']+)(["'][^>]*>)/gi, (match, prefix, url, suffix) => {
            return `${prefix}/api/iframe-proxy?url=${encodeURIComponent(url)}${suffix}`;
        });

        // 2. 외부 리소스의 절대경로(http://...)를 resource-proxy로 우회
        html = html.replace(/(<(?:img|link|script)[^>]*\s(?:src|href)=["'])(http:\/\/[^"']+)(["'][^>]*>)/gi, (match, prefix, url, suffix) => {
            try {
                const parsed = new URL(url);
                const rmUrl = `/api/proxy/${parsed.protocol.replace(':', '')}/${parsed.host}${parsed.pathname}${parsed.search}`;
                return `${prefix}${rmUrl}${suffix}`;
            } catch(e) {
                return match;
            }
        });

        // X-Frame-Options 제거하고 응답
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('X-Frame-Options', 'ALLOWALL');
        res.setHeader('Content-Security-Policy', '');
        res.status(200).send(html);
        
    } catch (error) {
        console.error('iframe proxy error:', error.message);
        res.status(200).send(`
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"></head>
            <body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:-apple-system,sans-serif;background:#f9fafb;">
                <div style="text-align:center;color:#6b7280;">
                    <p style="font-size:14px;font-weight:600;color:#374151;">좌석 배치도를 불러올 수 없습니다</p>
                    <p style="font-size:12px;margin-top:8px;">해당 도서관의 좌석 시스템에 일시적으로 접속할 수 없습니다.</p>
                    <a href="${targetUrl}" target="_blank" rel="noopener noreferrer" 
                       style="display:inline-block;margin-top:16px;padding:8px 16px;background:#3b82f6;color:white;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600;">
                        직접 열기
                    </a>
                </div>
            </body>
            </html>
        `);
    }
};
