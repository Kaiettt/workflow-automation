// Case, Vietnamese accents and extra spaces do not matter when matching text.
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

// "giá, Bảng giá , ,giá" → ['gia', 'bang gia']
export function parseKeywords(raw: unknown): string[] {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(',')
      : [];
  const keywords = list
    .filter((value): value is string => typeof value === 'string')
    .map(normalizeText)
    .filter(Boolean);
  return [...new Set(keywords)];
}

// No keywords: every text matches. Otherwise the text must contain one.
export function matchesKeywords(text: string, keywords: unknown): boolean {
  const wanted = parseKeywords(keywords);
  if (wanted.length === 0) return true;
  const normalized = normalizeText(text);
  return wanted.some((keyword) => normalized.includes(keyword));
}

export function header(
  headers: Record<string, string | string[] | undefined>,
  name: string,
): string | undefined {
  const value = headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}
