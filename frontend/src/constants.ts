/**
 * The health warning required by 27 CFR 16.21.
 *
 * Mirrors `backend/constants.py`. Held here only so the review screen can show
 * an agent what the label was compared against -- the comparison itself is the
 * backend's, and this is never used to decide anything.
 */
export const STATUTORY_WARNING =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not " +
  "drink alcoholic beverages during pregnancy because of the risk of birth " +
  "defects. (2) Consumption of alcoholic beverages impairs your ability to " +
  "drive a car or operate machinery, and may cause health problems.";
