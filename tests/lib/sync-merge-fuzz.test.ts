import { describe, expect, it } from 'vitest';
import { buryIds, mergeSides, type Side } from '@/lib/ledger/sync-merge';
import type { Entry } from '@/lib/ledger/schema';

/**
 * 합치기가 멀쩡한 줄을 삼키는지 무작위로 두들겨 본다.
 *
 * 사장님 기록이 두 번 날아갔다. 코드를 읽어서는 '지운 표시(묘비)'가 있을 때만
 * 줄이 사라지게 돼 있는데, 읽어서 못 찾은 길이 있는지 봐야 한다. 그래서
 * 기기 셋이 제멋대로 적고 고치고 지우고 주고받는 상황을 수천 번 만들어 보고,
 * 한 번도 안 지운 줄이 사라지는지 본다.
 */

type Dev = { side: Side };

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function entry(id: string, at: string, amount = 1000): Entry {
  return {
    id,
    date: '2026-03-14',
    amount,
    purse: 'personal',
    method: 'credit',
    holder: 'me',
    category: 'general',
    at,
  };
}

/*
  '기록 전부 지우기'를 섞을지. 기본은 끈다.

  그 조작은 아직 어디에도 안 올린 줄을 진짜로 없앤다. 그건 합치기 잘못이 아니라
  지우기가 한 일이라, 섞어 두면 '합치기가 줄을 삼켰나'를 가릴 수 없다.
  FUZZ_WIPE=1로 켜면 그 경우까지 돌려 볼 수 있다.
*/
const WIPE = process.env.FUZZ_WIPE === '1';

describe('합치기가 멀쩡한 줄을 삼키지 않는다', () => {
  it('기기 셋이 제멋대로 적고 고치고 지우고 주고받아도, 안 지운 줄은 다 살아 있다', { timeout: 30_000 }, () => {
    for (let seed = 1; seed <= 12; seed += 1) {
      const rand = rng(seed);
      const devs: Dev[] = [
        { side: { entries: [], graves: [] } },
        { side: { entries: [], graves: [] } },
        { side: { entries: [], graves: [] } },
      ];
      /** 서버 방 하나. 기기가 올리고 내려받는다. */
      let room: Side = { entries: [], graves: [] };

      const born = new Set<string>();
      const killed = new Set<string>();
      let next = 0;
      /*
        시계는 반드시 앞으로만 가야 한다. 처음엔 시·분을 따로 계산하면서 24와 60으로
        나머지를 냈더니 하루가 지나면 시각이 뒤로 돌아갔고, 그 바람에 '지운 시각이
        적은 시각보다 앞선' 가짜 상황이 생겨 멀쩡한 동작이 틀린 것처럼 보였다.
      */
      const base = Date.UTC(2026, 2, 14, 0, 0, 0);
      let clock = 0;
      const tick = () => new Date(base + (clock += 1000)).toISOString();

      for (let step = 0; step < 1200; step += 1) {
        const d = devs[Math.floor(rand() * devs.length)]!;
        const roll = rand();

        if (roll < 0.35) {
          // 적기
          next += 1;
          const id = `e${next}`;
          born.add(id);
          d.side = { ...d.side, entries: [...d.side.entries, entry(id, tick())] };
        } else if (roll < 0.5 && d.side.entries.length > 0) {
          /*
            고치기.

            이미 어느 기기에서든 지운 줄은 건드리지 않는다. 지운 뒤에 고치면
            되살아나는 게 맞는 동작이기 때문이다(나중에 손댄 쪽이 이긴다).
            그걸 섞으면 '되살아나면 안 되는데 되살아났나'를 가릴 수 없다.
          */
          const alive = d.side.entries.filter((e) => !killed.has(e.id));
          if (alive.length === 0) continue;
          const target = alive[Math.floor(rand() * alive.length)]!;
          d.side = {
            ...d.side,
            entries: d.side.entries.map((e) =>
              e.id === target.id ? { ...e, amount: e.amount + 1, at: tick() } : e,
            ),
          };
        } else if (roll < 0.58 && d.side.entries.length > 0) {
          // 지우기 — 지운 줄만 따로 적어 둔다
          const i = Math.floor(rand() * d.side.entries.length);
          const target = d.side.entries[i]!;
          killed.add(target.id);
          d.side = {
            entries: d.side.entries.filter((e) => e.id !== target.id),
            graves: buryIds(d.side.graves, [target.id], tick()),
          };
        } else if (WIPE && roll < 0.62) {
          // '기록 전부 지우기' — 줄만 비우고 묘비는 그대로 둔다 (reset과 같게)
          d.side = { entries: [], graves: d.side.graves };
        } else {
          // 서버와 한 바퀴 맞추기 (내려받아 합치고 올리기)
          const merged = mergeSides(d.side, room);
          d.side = merged;
          room = merged;
        }
      }

      // 마지막에 다 같이 한 바퀴씩 더 돈다
      for (let round = 0; round < 3; round += 1) {
        for (const d of devs) {
          const merged = mergeSides(d.side, room);
          d.side = merged;
          room = merged;
        }
      }

      const survivors = new Set(room.entries.map((e) => e.id));
      const shouldLive = [...born].filter((id) => !killed.has(id));
      const lost = shouldLive.filter((id) => !survivors.has(id));
      const zombies = [...killed].filter((id) => survivors.has(id));

      /*
        '전부 지우기'를 섞은 판에서는 유실을 따지지 않는다. 그 조작은 아직 어디에도
        안 올린 줄을 진짜로 없애는 게 맞는 동작이라, 합치기 잘못과 섞이기 때문이다.
        그 경우의 셈은 따로 아래 시험에서 본다.
      */
      if (!WIPE) {
        expect({ seed, lost: lost.slice(0, 5), lostCount: lost.length }).toEqual({
          seed,
          lost: [],
          lostCount: 0,
        });
      }
      expect({ seed, zombies: zombies.slice(0, 5) }).toEqual({ seed, zombies: [] });

      // 기기 셋이 서버와 같은 자리에 모여 있어야 한다
      for (const d of devs) {
        expect(new Set(d.side.entries.map((e) => e.id))).toEqual(survivors);
      }
    }
  });

  it('시각이 없는 옛 줄(고친 적 없는 기록)도 안 지우면 안 사라진다', () => {
    const old: Entry = {
      id: 'old',
      date: '2026-01-02',
      amount: 5000,
      purse: 'personal',
      method: 'credit',
      holder: 'me',
      category: 'general',
    };
    let room: Side = { entries: [], graves: [] };
    let a: Side = { entries: [old], graves: [] };
    let b: Side = { entries: [], graves: [] };

    for (let i = 0; i < 10; i += 1) {
      a = mergeSides(a, room);
      room = a;
      b = mergeSides(b, room);
      room = b;
    }
    expect(room.entries.map((e) => e.id)).toEqual(['old']);
    expect(a.entries).toHaveLength(1);
    expect(b.entries).toHaveLength(1);
  });

  it("'전부 지우기'를 해도 서버에 있던 줄은 되살아난다 — 사라지는 쪽이 아니다", () => {
    const rows = [entry('a', '2026-03-01T00:00:00Z'), entry('b', '2026-03-02T00:00:00Z')];
    const room: Side = { entries: rows, graves: [] };
    const wiped: Side = { entries: [], graves: [] };
    expect(mergeSides(wiped, room).entries.map((e) => e.id).sort()).toEqual(['a', 'b']);
  });
});
