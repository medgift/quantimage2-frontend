// Shared phrasing for the clinical-feature duplicate advisory returned by
// GET /clinical-features/duplicates. Training uses each feature name only
// once when it appears in several files: the newest file wins. These helpers
// keep the management page and the visualisation warning consistent.

import { makeClinicalFeatureId } from './clinical-feature-id';

// Signature of (file, name) pairs. Use as the effect dependency for
// refetching advisories: it only changes when columns appear/disappear
// (upload/delete), not on every encoding or missing-value edit.
export function clinicalDefinitionsSignature(definitions) {
  return (definitions || [])
    .map((d) => makeClinicalFeatureId(d.clinical_feature_file_id, d.name))
    .sort()
    .join('|');
}

export function isHarmlessDuplicate(advisory) {
  return (
    advisory.statuses.length === 1 && advisory.statuses[0] === 'identical'
  );
}

// One sentence per advisory, e.g.:
// "CenterID" appears in "Old cohort" and "New cohort" — only the copy from
// "New cohort" is used for training. 3 patient(s) have values only in an
// older file; those values are ignored.
export function formatDuplicateAdvisory(advisory) {
  const allFiles = [...advisory.dropped_file_names, advisory.kept_file_name];
  let text =
    `"${advisory.name}" appears in ${allFiles
      .map((n) => `"${n}"`)
      .join(' and ')} — only the copy from "${advisory.kept_file_name}" ` +
    `(newest file) is used for training.`;

  if (isHarmlessDuplicate(advisory)) {
    return `${text} The values are identical, so no data is lost.`;
  }
  if (advisory.statuses.includes('coverage_loss')) {
    text += ` ${advisory.coverage_loss_patient_count} patient(s) have values only in an older file; those values are ignored.`;
  }
  if (advisory.statuses.includes('conflict')) {
    text += ` ${advisory.conflict_patient_count} patient(s) have conflicting values between files; the value from "${advisory.kept_file_name}" is used.`;
  }
  return text;
}
