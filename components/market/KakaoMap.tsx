'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 카카오 지도 위에 단지를 찍는다.
 *
 * 마커 하나가 단지 하나고, 라벨에 그 단지 거래의 중앙값을 억 단위로 적는다.
 * 거래를 낱개로 찍으면 같은 자리에 수십 개가 겹쳐 아무것도 안 보인다.
 *
 * 지도 SDK는 카카오가 "어느 사이트에서 쓰는지" 등록된 도메인에서만 열어 준다.
 * 등록이 안 됐으면 빈 회색 네모가 되므로, 그때는 목록으로 보라고 알려 준다.
 */

export type MapPoint = {
  id: string;
  name: string;
  dong: string;
  count: number;
  medianAmount: number;
  medianUnitPrice: number;
  lat?: number;
  lng?: number;
};

type KakaoMapInstance = {
  setBounds: (b: unknown, ...pad: number[]) => void;
};
type KakaoOverlay = { setMap: (m: unknown) => void };
type KakaoNS = {
  maps: {
    load: (cb: () => void) => void;
    LatLng: new (lat: number, lng: number) => unknown;
    LatLngBounds: new () => { extend: (p: unknown) => void; isEmpty: () => boolean };
    Map: new (el: HTMLElement, opts: Record<string, unknown>) => KakaoMapInstance;
    CustomOverlay: new (opts: Record<string, unknown>) => KakaoOverlay;
  };
};
declare global {
  interface Window {
    kakao?: KakaoNS;
  }
}

/** 12.5억처럼 읽히게. 마커는 좁아서 자릿수를 다 쓸 수 없다. */
function shortMoney(won: number): string {
  const eok = won / 100000000;
  if (eok >= 10) return `${Math.round(eok)}억`;
  if (eok >= 1) return `${eok.toFixed(1)}억`;
  return `${Math.round(won / 10000000) * 1000}만`;
}

export function KakaoMap({
  appKey,
  points,
  selectedId,
  onSelect,
}: {
  /** 서버가 내려준 카카오 JavaScript 키. 없으면 지도를 띄울 수 없다. */
  appKey: string | null;
  points: MapPoint[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMapInstance | null>(null);
  const overlaysRef = useRef<KakaoOverlay[]>([]);
  const jsKey = appKey;
  // 키가 없으면 기다릴 것도 없다. 처음부터 막힌 상태로 시작한다.
  const [state, setState] = useState<'loading' | 'ready' | 'blocked'>(
    jsKey ? 'loading' : 'blocked',
  );

  useEffect(() => {
    if (!jsKey) return;

    let cancelled = false;
    const ready = () => {
      if (!cancelled) setState('ready');
    };
    const onLoad = () => window.kakao?.maps.load(ready);

    if (window.kakao?.maps) {
      // 이미 받아둔 경우. 그려도 되지만 지금 이 자리에서 바로 상태를 바꾸면
      // 렌더가 한 번 더 도므로 한 박자 미룬다.
      queueMicrotask(onLoad);
      return () => {
        cancelled = true;
      };
    }

    const existing = document.getElementById('kakao-maps-sdk');
    if (existing) {
      existing.addEventListener('load', onLoad);
      return () => {
        cancelled = true;
        existing.removeEventListener('load', onLoad);
      };
    }
    const script = document.createElement('script');
    script.id = 'kakao-maps-sdk';
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${jsKey}&autoload=false`;
    const onError = () => {
      if (!cancelled) setState('blocked');
    };
    script.addEventListener('load', onLoad);
    script.addEventListener('error', onError);
    document.head.appendChild(script);
    return () => {
      cancelled = true;
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
    };
  }, [jsKey]);

  const draw = useCallback(() => {
    const kakao = window.kakao;
    if (state !== 'ready' || !kakao?.maps || !boxRef.current) return;

    const withGeo = points.filter((p) => p.lat !== undefined && p.lng !== undefined);
    if (withGeo.length === 0) return;

    if (!mapRef.current) {
      mapRef.current = new kakao.maps.Map(boxRef.current, {
        center: new kakao.maps.LatLng(withGeo[0].lat as number, withGeo[0].lng as number),
        level: 5,
      });
    }
    const map = mapRef.current;

    for (const overlay of overlaysRef.current) overlay.setMap(null);
    overlaysRef.current = [];

    const bounds = new kakao.maps.LatLngBounds();
    for (const p of withGeo) {
      const pos = new kakao.maps.LatLng(p.lat as number, p.lng as number);
      bounds.extend(pos);

      const el = document.createElement('button');
      el.type = 'button';
      const on = p.id === selectedId;
      el.className = [
        'tnum -translate-x-1/2 -translate-y-full cursor-pointer whitespace-nowrap rounded-full',
        'px-2 py-1 text-[11px] font-bold shadow-sm',
        on
          ? 'border border-white bg-brand text-white'
          : 'border border-line-strong bg-surface text-ink',
      ].join(' ');
      el.textContent = `${p.name.slice(0, 7)} ${shortMoney(p.medianAmount)}`;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelect(p.id);
      });

      const overlay = new kakao.maps.CustomOverlay({ position: pos, content: el, yAnchor: 1 });
      overlay.setMap(map);
      overlaysRef.current.push(overlay);
    }

    if (!bounds.isEmpty()) map.setBounds(bounds, 48, 24, 24, 24);
  }, [state, points, selectedId, onSelect]);

  useEffect(() => {
    draw();
  }, [draw]);

  if (state === 'blocked') {
    return (
      <div className="flex h-full items-center justify-center bg-sunk px-6 py-10">
        <p className="text-center text-[13px] leading-relaxed text-ink-soft">
          {jsKey
            ? '지도를 불러오지 못했어요. 이 주소가 카카오에 등록돼 있지 않거나 잠시 연결이 끊긴 경우예요.'
            : '지도 기능이 아직 준비 중이에요.'}
          <br />
          목록 보기로는 같은 내용을 보실 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <div ref={boxRef} className="h-full w-full" />
      {state === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-sunk">
          <p className="text-[13px] text-ink-faint">지도를 불러오는 중…</p>
        </div>
      )}
    </div>
  );
}
