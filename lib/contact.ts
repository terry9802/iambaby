/**
 * 문의용 이메일.
 *
 * 개인 메일 주소를 코드에 박아두면 저장소가 공개될 때 같이 공개된다.
 * 그래서 환경변수로 받고, 없으면 주소 대신 "준비 중"으로 보여준다.
 * Vercel 환경변수에 NEXT_PUBLIC_CONTACT_EMAIL 을 넣으면 즉시 반영된다.
 */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || null;
