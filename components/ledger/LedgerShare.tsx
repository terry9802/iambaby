'use client';

import { useRef, useState } from 'react';
import { downloadCsv } from '@/lib/ledger/csv';
import { downloadXlsx } from '@/lib/ledger/xlsx';
import { mergeEntries, mergePreview, parseLedgerFile, toLedgerFile } from '@/lib/ledger/merge';
import type { Entry } from '@/lib/ledger/schema';
import { Icon } from '@/components/ui/Icon';

/**
 * 파일로 내보내고 가져오는 자리.
 *
 * 엑셀 파일은 사람이 보는 용도고, 합치기 파일은 앱이 읽는 용도다. 둘을 나눈
 * 이유는 엑셀에서 한 번 열었다 저장하면 서식이 바뀌어서 다시 읽기가 어렵기
 * 때문이다. 엑셀은 보기만 하고, 합칠 때는 합치기 파일을 쓰시면 된다.
 */
export function LedgerShare({
  entries,
  today,
  partnerLabel,
  onMerge,
}: {
  entries: Entry[];
  today: string;
  /**
   * 가져온 줄에 붙일 이름.
   *
   * 보낸 사람이 자기를 뭐라 부르는지는 받는 쪽에 아무 뜻이 없다. 신랑이
   * "나"로 보낸 파일을 신부가 가져오면 신부 화면에 "나"라고 적히는 꼴이다.
   * 그래서 이름은 받는 쪽에서 붙인다.
   */
  partnerLabel: string;
  onMerge: (next: Entry[]) => boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);

  const exportJson = () => {
    const file = toLedgerFile(entries, undefined, today);
    const blob = new Blob([JSON.stringify(file)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `가계부_합치기_${today}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const importFile = async (file: File) => {
    const text = await file.text();
    const read = parseLedgerFile(text);
    if ('error' in read) {
      setMessage({ tone: 'bad', text: read.error });
      return;
    }
    const preview = mergePreview(entries, read.entries);
    if (preview.added === 0) {
      setMessage({
        tone: 'ok',
        text: `${preview.total}건 모두 이미 있는 기록이에요. 더 들어온 줄은 없습니다.`,
      });
      return;
    }
    // 보낸 사람 기준으로 적힌 명의를 보는 쪽 기준으로 돌려 놓는다.
    const ok = onMerge(mergeEntries(entries, read.entries, partnerLabel, true));
    setMessage(
      ok
        ? {
            tone: 'ok',
            text: `${preview.added}건을 더했어요.${preview.duplicate > 0 ? ` ${preview.duplicate}건은 이미 있어서 건너뛰었습니다.` : ''}`,
          }
        : { tone: 'bad', text: '저장하지 못했어요. 브라우저 저장 공간을 확인해 주세요.' },
    );
  };

  return (
    <section className="flex flex-col gap-3 rounded-[12px] border border-line bg-surface px-4 py-4">
      <h2 className="text-[15px] font-bold text-ink">내려받기 · 합치기</h2>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => downloadXlsx(entries, today)}
          disabled={entries.length === 0}
          className={
            'flex items-center gap-1.5 rounded-[8px] px-3.5 py-2.5 text-[13.5px] font-semibold transition-colors ' +
            (entries.length > 0
              ? 'bg-brand-strong text-white hover:bg-brand-deep'
              : 'cursor-not-allowed bg-sunk text-ink-faint')
          }
        >
          <Icon name="download" size={16} />
          엑셀로 받기
        </button>
        <button
          type="button"
          onClick={() => downloadCsv(entries, today)}
          disabled={entries.length === 0}
          className={
            'flex items-center gap-1.5 rounded-[8px] border px-3.5 py-2.5 text-[13.5px] font-semibold transition-colors ' +
            (entries.length > 0
              ? 'border-line bg-surface text-ink-soft hover:border-line-strong'
              : 'cursor-not-allowed border-line bg-sunk text-ink-faint')
          }
        >
          <Icon name="download" size={16} />
          CSV로 받기
        </button>
        <button
          type="button"
          onClick={exportJson}
          disabled={entries.length === 0}
          className={
            'flex items-center gap-1.5 rounded-[8px] border px-3.5 py-2.5 text-[13.5px] font-semibold transition-colors ' +
            (entries.length > 0
              ? 'border-line bg-surface text-ink-soft hover:border-line-strong'
              : 'cursor-not-allowed border-line bg-sunk text-ink-faint')
          }
        >
          <Icon name="share" size={16} />
          합치기 파일 보내기
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 rounded-[8px] border border-line bg-surface px-3.5 py-2.5 text-[13.5px] font-semibold text-ink-soft hover:border-line-strong"
        >
          <Icon name="upload" size={16} />
          상대방 파일 가져오기
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void importFile(file);
            e.target.value = '';
          }}
        />
      </div>

      {message && (
        <p
          className={
            'rounded-[8px] px-3 py-2.5 text-[12.5px] leading-relaxed ' +
            (message.tone === 'ok' ? 'bg-good-soft text-good' : 'bg-alert-soft text-alert')
          }
        >
          {message.text}
        </p>
      )}

      <div className="rounded-[8px] bg-sunk px-3.5 py-3 text-[12.5px] leading-relaxed text-ink-soft">
        <p>
          <strong className="font-semibold text-ink">엑셀로 받기</strong>는 시트가 셋으로 나뉘어
          나옵니다. 전체 · 개인 생활비 · 커플 데이트비. CSV는 시트가 하나뿐이라 구글 스프레드시트
          같은 데 올릴 때만 쓰세요.
        </p>
        <p className="mt-1.5">
          <strong className="font-semibold text-ink">둘이 같이 쓰시려면</strong> 한 분이 합치기
          파일을 받아서 카톡으로 보내고, 다른 분이 그 파일을 가져오시면 됩니다. 같은 줄을 두 번
          가져와도 늘어나지 않아요.
        </p>
      </div>
    </section>
  );
}
