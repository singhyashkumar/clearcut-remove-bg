import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../../public/seo.css', import.meta.url));
const version = createHash('sha256').update(css).digest('hex').slice(0, 12);

export const comparisonStylesheet = `/seo.css?v=${version}`;
