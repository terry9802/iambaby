import { toISODate } from '@/lib/format';

/**
 * 프로필로 채운 값과 예시로 채운 값을 구분해 모으는 도구.
 * effect로 늦게 채우지 않고 렌더 시점에 파생시켜야 첫 화면부터 결과가 보인다.
 */
export class Seeder<T extends object> {
  readonly autofilled = new Set<string>();
  readonly examples: { field: string; label: string }[] = [];
  private readonly values: Partial<T> = {};

  /** 프로필에 값이 있으면 그걸 쓰고, 없으면 예시값을 쓴다. */
  pick<K extends keyof T & string>(
    field: K,
    fromProfile: T[K] | undefined,
    example: { value: T[K]; label: string },
  ): void {
    if (fromProfile !== undefined && fromProfile !== null && fromProfile !== ('' as unknown)) {
      this.values[field] = fromProfile;
      this.autofilled.add(field);
    } else {
      this.values[field] = example.value;
      this.examples.push({ field, label: example.label });
    }
  }

  /** 예시로 대체하지 않는 값 (없으면 없는 대로 둔다) */
  set<K extends keyof T & string>(field: K, fromProfile: T[K] | undefined): void {
    if (fromProfile === undefined || fromProfile === null) return;
    this.values[field] = fromProfile;
    this.autofilled.add(field);
  }

  build(base: T): T {
    return { ...base, ...this.values };
  }
}

/**
 * 정적 프리렌더된 HTML과 첫 클라이언트 렌더가 같아야 하므로,
 * 하이드레이션 전에는 서버가 넘겨준 날짜를 쓰고 그 뒤에 진짜 오늘로 바꾼다.
 */
/** 사용자가 직접 고친 항목은 더 이상 예시가 아니므로 안내에서 뺀다. */
export function pendingExamples(
  examples: { field: string; label: string }[],
  edits: object,
): string[] {
  return examples.filter((e) => !(e.field in edits)).map((e) => e.label);
}

export function resolveToday(hydrated: boolean, fallbackToday: string): string {
  return hydrated ? toISODate(new Date()) : fallbackToday;
}
