import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        /*
          public/ 아래 파일은 기본적으로 매번 서버에 "바뀌었나요?"를 묻는다.
          폰트 파일은 버전이 박힌 채로 바뀌지 않으므로 1년치 캐시를 준다.
          두 번째 방문부터는 네트워크를 아예 타지 않는다.
        */
        source: '/fonts/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/docs/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400' }],
      },
    ];
  },
};

export default nextConfig;
