/**
 * 아주 작은 ZIP 만들기.
 *
 * 엑셀 파일(.xlsx)은 사실 XML 몇 장을 담은 ZIP이다. 시트를 나누려면 ZIP을
 * 만들 수 있어야 하는데, 그 하나 때문에 외부 라이브러리를 들이면 이 사이트가
 * 받는 파일 크기가 수백 KB씩 늘어난다. 지금 이 사이트는 실행 의존성이 네 개뿐이고
 * 그게 첫 화면이 빨리 뜨는 이유다.
 *
 * 그래서 압축 없이(store) 담기만 하는 ZIP을 직접 쓴다. 가계부 XML은 글자라
 * 압축하면 작아지겠지만, 몇 백 줄짜리 가계부는 압축해도 안 해도 수십 KB다.
 * 엑셀은 압축 안 된 ZIP도 아무 문제 없이 연다.
 */

export type ZipFile = { name: string; data: Uint8Array };

/** 표준 CRC-32. ZIP은 파일마다 이 값을 적어 둬야 한다. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** 리틀엔디언으로 쓰는 자리. ZIP의 숫자는 전부 이 꼴이다. */
class Writer {
  private parts: Uint8Array[] = [];
  length = 0;

  push(bytes: Uint8Array) {
    this.parts.push(bytes);
    this.length += bytes.length;
  }

  u16(value: number) {
    const b = new Uint8Array(2);
    new DataView(b.buffer).setUint16(0, value, true);
    this.push(b);
  }

  u32(value: number) {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, value >>> 0, true);
    this.push(b);
  }

  build(): Uint8Array {
    const out = new Uint8Array(this.length);
    let at = 0;
    for (const part of this.parts) {
      out.set(part, at);
      at += part.length;
    }
    return out;
  }
}

export function zip(files: ZipFile[]): Uint8Array {
  const enc = new TextEncoder();
  const out = new Writer();
  const central: { name: Uint8Array; crc: number; size: number; offset: number }[] = [];

  for (const file of files) {
    const name = enc.encode(file.name);
    const crc = crc32(file.data);
    central.push({ name, crc, size: file.data.length, offset: out.length });

    out.u32(0x04034b50); // 로컬 파일 머리
    out.u16(20); // 풀려면 필요한 버전
    out.u16(0x0800); // 이름이 UTF-8이라는 표시
    out.u16(0); // 압축 안 함
    out.u16(0); // 시각 — 안 쓴다
    out.u16(0); // 날짜 — 안 쓴다
    out.u32(crc);
    out.u32(file.data.length); // 압축 후 크기
    out.u32(file.data.length); // 원래 크기
    out.u16(name.length);
    out.u16(0); // 덧붙임 없음
    out.push(name);
    out.push(file.data);
  }

  const centralStart = out.length;
  for (const entry of central) {
    out.u32(0x02014b50); // 가운데 목록 머리
    out.u16(20); // 만든 버전
    out.u16(20); // 풀려면 필요한 버전
    out.u16(0x0800);
    out.u16(0);
    out.u16(0);
    out.u16(0);
    out.u32(entry.crc);
    out.u32(entry.size);
    out.u32(entry.size);
    out.u16(entry.name.length);
    out.u16(0); // 덧붙임
    out.u16(0); // 설명
    out.u16(0); // 디스크 번호
    out.u16(0); // 안쪽 속성
    out.u32(0); // 바깥 속성
    out.u32(entry.offset);
    out.push(entry.name);
  }

  /*
    목록 크기는 끝 표시를 쓰기 전에 재야 한다. 쓰고 나서 out.length를 읽으면
    방금 쓴 바이트까지 세어져서 크기가 12바이트 더 커지고, 그 ZIP은 아무 데서도
    안 열린다. 처음에 이 순서를 틀렸다가 파이썬 zipfile이 잡아 줬다.
  */
  const centralEnd = out.length;

  out.u32(0x06054b50); // 목록 끝 표시
  out.u16(0);
  out.u16(0);
  out.u16(central.length);
  out.u16(central.length);
  out.u32(centralEnd - centralStart);
  out.u32(centralStart);
  out.u16(0);

  return out.build();
}
