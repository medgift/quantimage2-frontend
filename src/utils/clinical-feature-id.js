// Canonical clinical-feature ID convention: `<file_id>::<name>`.
//
// Two CSVs uploaded to the same album can share a column name, so clinical
// feature IDs are namespaced by their file id. This separator is `::` (never
// the U+2011 FEATURE_ID_SEPARATOR used for radiomics IDs) so the backend's
// "no U+2011 ⇒ clinical feature" classification still holds.
export const CLINICAL_FEATURE_ID_SEPARATOR = '::';

// Build the canonical id for a clinical feature column in a given file.
export function makeClinicalFeatureId(fileId, name) {
  return `${fileId}${CLINICAL_FEATURE_ID_SEPARATOR}${name}`;
}

// Prefix that all of a file's clinical feature ids start with.
export function clinicalFeatureIdPrefix(fileId) {
  return `${fileId}${CLINICAL_FEATURE_ID_SEPARATOR}`;
}
