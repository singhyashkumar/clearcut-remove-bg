export type GuideSection = readonly [heading: string, body: string];
export type GuideFaq = readonly [question: string, answer: string];

export interface EvidenceImage {
  readonly src: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
  readonly caption?: string;
  readonly srcset?: string;
  readonly sizes?: string;
}

export interface EvidenceTable {
  readonly caption?: string;
  readonly head: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

export interface GuidePageFields {
  readonly metaTitle?: string;
  readonly h1?: string;
  readonly lang?: string;
  readonly lastModified?: string;
  readonly images?: readonly EvidenceImage[];
  readonly tables?: readonly EvidenceTable[];
}

export type LegacyGuideSource = readonly [
  slug: string,
  title: string,
  description: string,
  sections: readonly GuideSection[],
  faqs?: readonly GuideFaq[],
  fields?: GuidePageFields,
];
