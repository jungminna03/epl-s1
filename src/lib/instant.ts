"use client";

import { init, InstaQLEntity } from "@instantdb/react";
import schema, { type AppSchema } from "../../instant.schema";

/**
 * InstantDB 앱 ID는 .env.local 의 NEXT_PUBLIC_INSTANT_APP_ID 에서 읽는다.
 * 누락 시 프로덕션에서는 명시적으로 실패하도록 한다.
 */
const APP_ID =
  process.env.NEXT_PUBLIC_INSTANT_APP_ID ?? "__MISSING_INSTANT_APP_ID__";

/**
 * 카테고리 리터럴 — DB 는 string 으로 저장하지만 앱 레이어에서 타입으로 좁힌다.
 */
// "전체" 는 1~4학년의 합집합이 아니라 **대등한 5번째 대상**이다 (2026-09-09 결정).
// 디스코드도 학년 채널 4개와 별개로 전체 채널이 따로 있고, 전체를 고르면 그 채널에만 간다.
// 학년과 중복 선택 가능 — "1학년,전체" 는 1학년 채널 + 전체 채널 두 곳에 게시된다.
// "테스트" 는 디스코드 테스트 채널 전용 대상이다. 연동을 실채널에 내보내기 전에 확인하는 용도라
// 이 대상이 걸린 공지는 디스플레이/위젯에 절대 노출되지 않는다 (categories.ts 의 isNoticeVisible).
export const CATEGORIES = ["1학년", "2학년", "3학년", "4학년", "전체", "테스트"] as const;
export type Category = (typeof CATEGORIES)[number];

export { schema };

export const db = init({ appId: APP_ID, schema, devtool: false });

/**
 * 쿼리 결과 1건의 타입.
 */
export type Notice = InstaQLEntity<AppSchema, "notices">;
export type Admin = InstaQLEntity<AppSchema, "admins">;

/**
 * 런타임에서 카테고리 문자열을 안전하게 좁히는 헬퍼.
 */
export function asCategory(value: string): Category | null {
  return (CATEGORIES as readonly string[]).includes(value)
    ? (value as Category)
    : null;
}
