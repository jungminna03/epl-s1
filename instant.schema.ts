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
      professor: i.string(),
      category: i.string(), // '일반' | '휴강' | '긴급'
      createdAt: i.number().indexed(),
    }),
  },
});

type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
