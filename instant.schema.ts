import { i } from "@instantdb/react";

/**
 * InstantDB 스키마 정의 — `npx instant-cli push schema` 가 이 파일을 찾는다.
 * 앱 코드는 src/lib/instant.ts 를 통해 이 스키마를 사용.
 */
const _schema = i.schema({
  entities: {
    notices: i.entity({
      title: i.string(),
      content: i.string(),
      professor: i.string().optional(),
      category: i.string(), // '' | '1학년' | '2학년' | '3학년' | '4학년'
      createdAt: i.number().indexed(),
      link: i.string().optional(),
      startDate: i.number().optional(),
      endDate: i.number().optional(),
      checkCount: i.number().optional(),
      summary: i.string().optional(), // AI 요약. admin 저장 시 자동 생성, widget 자세히보기에서 노출.
    }),
    admins: i.entity({
      name: i.string(),
      position: i.string(),
      password: i.string(),
      createdAt: i.number().indexed(),
    }),
  },
});

type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
