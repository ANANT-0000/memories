/**
 * Utility functions for filename normalization and similarity calculation
 * to detect duplicate or near-duplicate uploads.
 */

export function extractBaseName(urlOrPath: string): string {
  const filename = urlOrPath.split('/').pop() ?? urlOrPath;
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
  // Format is: <timestamp>-<optionalRandom>-<baseName>
  const match = nameWithoutExt.match(/^\d+(?:-[a-z0-9]{6})?-(.+)$/);
  if (match && match[1]) {
    return match[1].toLowerCase().trim();
  }
  return nameWithoutExt.toLowerCase().trim();
}

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.[^/.]+$/, '') // strip extension
    .replace(/[^a-z0-9]/g, '-') // normalize non-alphanumeric to dashes
    .replace(/-+/g, '-') // collapse multiple dashes
    .replace(/^-|-$/g, '') // trim dashes
    .trim();
}

/**
 * Strips copy/version suffixes like (1), _copy, -2 to catch duplicate variants
 */
export function cleanCopySuffix(name: string): string {
  return name
    .replace(/[-_]?(?:\(\d+\)|\bcopy\b|\bv?\d+\b)$/i, '')
    .replace(/^-|-$/g, '')
    .trim();
}

export function levenshteinDistance(s1: string, s2: string): number {
  if (s1 === s2) return 0;
  if (s1.length === 0) return s2.length;
  if (s2.length === 0) return s1.length;

  const m = s1.length;
  const n = s2.length;
  let prevRow = Array.from({ length: n + 1 }, (_, i) => i);
  let currRow = Array.from({ length: n + 1 }, () => 0);

  for (let i = 0; i < m; i++) {
    const char1 = s1[i];
    currRow[0] = i + 1;

    for (let j = 0; j < n; j++) {
      const char2 = s2[j];
      const cost = char1 === char2 ? 0 : 1;
      const prevDel = prevRow[j + 1];
      const currIns = currRow[j];
      const prevSub = prevRow[j];

      if (prevDel !== undefined && currIns !== undefined && prevSub !== undefined) {
        currRow[j + 1] = Math.min(
          prevDel + 1,      // deletion
          currIns + 1,      // insertion
          prevSub + cost    // substitution
        );
      }
    }

    const temp = prevRow;
    prevRow = currRow;
    currRow = temp;
  }

  return prevRow[n] ?? Math.max(m, n);
}

/**
 * Calculates string similarity from 0.0 to 1.0 (1.0 = identical).
 */
export function calculateSimilarity(strA: string, strB: string): number {
  const a = normalizeName(strA);
  const b = normalizeName(strB);

  if (a === b) return 1.0;
  if (a.length === 0 || b.length === 0) return 0.0;

  // Check cleaned versions without copy suffixes
  const cleanA = cleanCopySuffix(a);
  const cleanB = cleanCopySuffix(b);
  if (cleanA.length > 2 && cleanA === cleanB) {
    return 0.98; // virtually identical variant
  }

  const maxLen = Math.max(a.length, b.length);
  const dist = levenshteinDistance(a, b);
  const similarity = Math.max(0, 1 - dist / maxLen);

  return Math.round(similarity * 100) / 100;
}

export interface DuplicateMatchResult {
  isDuplicate: boolean;
  similarity: number;
  matchedUrl?: string | undefined;
  matchedBaseName?: string | undefined;
  inputBaseName: string;
}

/**
 * Tests a candidate filename against a list of existing image URLs.
 * Threshold defaults to 0.90 (90%).
 */
export function findDuplicateMatch(
  newFilename: string,
  existingUrls: string[],
  threshold = 0.90
): DuplicateMatchResult {
  const inputBase = normalizeName(newFilename);
  let bestMatchUrl: string | undefined;
  let bestMatchBase: string | undefined;
  let highestSimilarity = 0;

  for (const rawUrl of existingUrls) {
    const existingBase = extractBaseName(rawUrl);
    const sim = calculateSimilarity(inputBase, existingBase);

    if (sim > highestSimilarity) {
      highestSimilarity = sim;
      bestMatchUrl = rawUrl;
      bestMatchBase = existingBase;
    }

    if (highestSimilarity >= 1.0) {
      break;
    }
  }

  return {
    isDuplicate: highestSimilarity >= threshold,
    similarity: highestSimilarity,
    matchedUrl: highestSimilarity >= threshold ? bestMatchUrl : undefined,
    matchedBaseName: highestSimilarity >= threshold ? bestMatchBase : undefined,
    inputBaseName: inputBase,
  };
}
