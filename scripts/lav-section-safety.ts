export type AutoSectionDecision =
  | "LOCKED"
  | "AUTO_WHOLE_FEATURE"
  | "REVIEW_BOUNDARY"
  | "UNMATCHED";

const EXPLICIT_BOUNDARY =
  /\b(von|vom|bis|km|brücke|bruecke|wehr|mündung|muendung|einmündung|einmuendung|landesgrenze|kreisgrenze|linksseitig|rechtsseitig|beidseitig|oberhalb|unterhalb|ab)\b/i;

export function classifyLavFlowSection(
  lavNumber: string,
  officialLabel: string,
  featureId: string | null | undefined,
  lockedLavNumbers: ReadonlySet<string>
): AutoSectionDecision {
  if (lockedLavNumbers.has(lavNumber)) return "LOCKED";
  if (!featureId) return "UNMATCHED";
  if (EXPLICIT_BOUNDARY.test(officialLabel)) return "REVIEW_BOUNDARY";
  return "AUTO_WHOLE_FEATURE";
}

/**
 * Generator rule:
 * AUTO_WHOLE_FEATURE may use the complete matched OSM feature (LineString,
 * MultiLineString, Polygon or MultiPolygon).
 *
 * REVIEW_BOUNDARY must NEVER receive a guessed +/- coordinate route.
 * It is promoted only after start/end or km boundaries were resolved.
 */
