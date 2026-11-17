export type GuideSection = readonly [heading: string, body: string];
export type GuideFaq = readonly [question: string, answer: string];

export interface GuidePageFields {
  readonly metaTitle?: string;
  readonly h1?: string;
  readonly lang?: string;
  readonly lastModified?: string;
}

export type LegacyGuideSource = readonly [
  slug: string,
  title: string,
  description: string,
  sections: readonly GuideSection[],
  faqs: readonly GuideFaq[],
  fields?: GuidePageFields,
];
