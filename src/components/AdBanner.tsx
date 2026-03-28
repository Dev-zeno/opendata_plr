import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

export default function AdBanner() {
  const adRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);
  const [adLoaded, setAdLoaded] = useState(false);

  useEffect(() => {
    if (!pushed.current) {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
        pushed.current = true;
        // 광고가 로드되면 표시
        setTimeout(() => {
          if (adRef.current && adRef.current.offsetHeight > 0) {
            setAdLoaded(true);
          }
        }, 2000);
      } catch (e) {
        console.warn('AdSense push error:', e);
      }
    }
  }, []);

  return (
    <div className={`rounded-3xl overflow-hidden transition-all duration-500 ${adLoaded ? 'min-h-[200px]' : 'min-h-0 h-0 p-0 m-0 opacity-0'}`}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client="ca-pub-5020907728147444"
        data-ad-slot="9949854890"
        data-ad-format="fluid"
        data-full-width-responsive="true"
      />
    </div>
  );
}
