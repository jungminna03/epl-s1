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
export const CATEGORIES = ["1학년", "2학년", "3학년", "4학년"] as const;
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
