import guide from "@/content/moviemax-api.md?raw";
import { splitDoc } from "@/lib/doc-pages";

export const DOC_TITLE = "MOVIE MAX Content API — Developer Guide";
export const DOC_PAGES = splitDoc(guide);
export const docPage = (slug: string) => DOC_PAGES.find((p) => p.slug === slug);
export { guide as DOC_SOURCE };
