/**
 * AdSense 심사와 수익 지급에 필요한 ads.txt.
 * NEXT_PUBLIC_ADSENSE_CLIENT(예: ca-pub-0000000000000000)를 넣으면 자동으로 만들어진다.
 */
export const dynamic = 'force-static';

export function GET() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  if (!client) {
    return new Response('# AdSense 퍼블리셔 ID가 아직 설정되지 않았습니다.\n', {
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }
  const publisherId = client.replace(/^ca-/, '');
  return new Response(`google.com, ${publisherId}, DIRECT, f08c47fec0942fa0\n`, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}
