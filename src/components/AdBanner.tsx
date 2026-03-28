import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

export default function AdBanner() {
  const adRef = useRef<HTMLDivElement>(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (!pushed.current && adRef.current) {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        pushed.current = true;
      } catch (e) {
        console.warn('AdSense push error:', e);
      }
    }
  }, []);

  return (
    <div className="glass-panel rounded-3xl p-4 border border-white/40 flex items-center justify-center min-h-[200px] overflow-hidden">
      <ins
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', height: '100%', minHeight: '180px' }}
        data-ad-client="ca-pub-5020907728147444"
        data-ad-slot="auto"
        data-ad-format="fluid"
        data-full-width-responsive="true"
      />
      {/* 개발환경 플레이스홀더 (프로덕션에서는 광고가 표시됨) */}
      <noscript>
        <p className="text-xs text-gray-400 text-center">광고 영역</p>
      </noscript>
    </div>
  );
}
