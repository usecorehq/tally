// Qore Catalog v1 response and request shapes. Prices are indicative, whole Naira.

export type HealthResponse = { status: "ok"; db: "up" };

export type Size = { value: number; unit: string } | null;

/** An approved, public product picture; null until a curator approves one. */
export type CatalogImage = { url: string; width: number | null; height: number | null } | null;

export type ImageView = "front" | "back" | "side" | "top" | "label" | "barcode" | "nutrition" | "on_shelf" | "in_hand";

export type UploadImageResponse = {
  sha256: string;
  qid: string;
  view: ImageView;
  status: "pending";
  width: number;
  height: number;
};

export type Product = {
  qid: string;
  name: string;
  variantLabel: string | null;
  size: Size;
  packQty: number;
  status: string;
  family: { slug: string; name: string };
  brand: { slug: string; name: string } | null;
  category: { path: string; name: string };
  image: CatalogImage;
};

export type Price = {
  currency: "NGN";
  indicative: true;
  median: number;
  min: number;
  max: number;
  offers: number;
  retailers: number;
  /** ISO 8601 */
  observedAt: string;
} | null;

export type Page<T> = { total: number; limit: number; offset: number; items: T[] };

// ── Products ──

export type ProductSearchParams = {
  q?: string;
  brand?: string;
  category?: string;
  /** 1-100, default 20 */
  limit?: number;
  offset?: number;
};

export type ProductSearchResult = Page<Product & { score: number }>;

export type ProductVariant = { qid: string; variantLabel: string | null; packQty: number };

export type ProductDetail = Product & { price: Price; variants: ProductVariant[] };

export type MergedProduct = { qid: string; status: "merged"; mergedInto: string };

// ── Match ──

export type MatchItem = { ref?: string; brand?: string; name: string; pack?: string };

export type MatchRequest = {
  /** 1-50 */
  items: MatchItem[];
  /** 1-10, default 5 */
  limit?: number;
};

export type MatchCandidate = Product & {
  price: Price;
  score: number;
  signals: { text: number; brand: number; size: number };
};

export type MatchResult = {
  ref: string | null;
  query: { brand: string | null; name: string; pack: string | null };
  parsedPack: { value: number | null; unit: string | null; packQty: number | null } | null;
  /** Empty = unidentified. */
  candidates: MatchCandidate[];
};

/** Results come back in request order. */
export type MatchResponse = { items: MatchResult[] };

// ── Business taxonomy ──

export type BusinessSubtype = { code: string; label: string };

export type BusinessVertical = {
  code: string;
  label: string;
  description: string | null;
  subtypes: BusinessSubtype[];
};

export type TemplateItem = {
  name: string;
  product: Product | null;
  /** Only when the template suggests products and suggestions > 0 was asked for. */
  suggestions?: MatchCandidate[];
};

export type TemplateGroup = { code: string; label: string; items: TemplateItem[] };

export type Template = {
  code: string;
  label: string;
  description: string | null;
  keywords: string[];
  suggestProducts: boolean;
  groups: TemplateGroup[];
};

export type SubtypeTemplates = {
  subtype: BusinessSubtype;
  vertical: { code: string; label: string };
  matchedBy: "subtype" | "vertical";
  templates: Template[];
};

// ── Brands / categories ──

export type BrandSearchParams = { q?: string; limit?: number; offset?: number };

export type Brand = {
  slug: string;
  name: string;
  countryOfOrigin: string | null;
  company: string | null;
  families: number;
};

export type Category = {
  path: string;
  name: string;
  depth: number;
  isLeaf: boolean;
  parent: string | null;
};

// ── Feedback ──

export type FeedbackOutcome = "accepted" | "corrected" | "new_item" | "removed";

/**
 * accepted needs suggestedQid or confirmedQid; corrected needs confirmedQid; new_item needs confirmedName, no Qid.
 * Idempotent per clientRef, so retries are safe.
 */
export type FeedbackItem = {
  clientRef: string;
  businessRef: string;
  subtypeCode?: string;
  source?: "photo" | "template" | "manual";
  input: { brand?: string; name: string; pack?: string };
  suggestedQid?: string;
  /** 0-1 */
  suggestedScore?: number;
  outcome: FeedbackOutcome;
  confirmedQid?: string;
  confirmedName?: string;
  confirmedPack?: string;
  quantity?: number;
  unitPriceNgn?: number;
};

export type FeedbackResponse = {
  received: number;
  recorded: number;
  duplicates: number;
  learnedAliases: number;
};

export type FeedbackStats = {
  total: number;
  outcomes: { accepted: number; corrected: number; newItem: number; removed: number };
  businesses: number;
  firstPassMatchRate: number | null;
  catalogueMatchRate: number | null;
  suggestionRate: number | null;
  from: string | null;
  to: string | null;
};

// ── Keys ──

export type ApiKeyInfo = {
  name: string;
  prefix: string;
  scopes: string[];
  expiresAt: string | null;
  createdAt: string;
};

// ── Errors ──

export type CatalogErrorBody = {
  statusCode: number;
  path: string;
  timestamp: string;
  message: string | string[];
  issues?: { path: string; message: string }[] | string[];
};
