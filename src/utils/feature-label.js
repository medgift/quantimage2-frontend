// Human-readable feature names, following the Feature Selection tree:
// image (modality) › ROI › Shape / Intensity (SUV for PET) / Texture › family › name
//
// Radiomics feature IDs are `<modality>‑<roi>‑<feature name>` (non-breaking
// hyphen), where PyRadiomics names are `<image type>_<class>_<feature>`. The
// image type is "original" unless a filter (LoG, wavelet...) was applied; only
// original images are computed nowadays, so "original" is not shown.
import {
  FEATURE_CATEGORY_ALIASES,
  FEATURE_DEFINITIONS,
} from './feature-mapping';
import { CLINICAL_FEATURE_ID_SEPARATOR } from './clinical-feature-id';
import {
  PYRADIOMICS_FEATURE_PREFIXES,
  RIESZ_FEATURE_PREFIXES,
  ZRAD_FEATURE_PREFIXES,
} from '../config/constants';

export const FEATURE_ID_SEPARATOR = '‑'; // Non-breaking hyphen, ROI names can contain normal hyphens
export const FEATURE_LABEL_SEPARATOR = ' › ';

export const CLINICAL_GROUP = 'Clinical';

const ORIGINAL_IMAGE = 'original';

const SHAPE = 'Shape';
const INTENSITY = 'Intensity';
const SUV = 'SUV';
const TEXTURE = 'Texture';

// Display order of the categories; others follow alphabetically
const CATEGORY_ORDER = [SHAPE, INTENSITY, SUV, TEXTURE];

// PyRadiomics class -> category, for names without a feature definition
const CLASS_CATEGORIES = {
  shape: SHAPE,
  shape2D: SHAPE,
  firstorder: INTENSITY,
  glcm: TEXTURE,
  gldm: TEXTURE,
  glrlm: TEXTURE,
  glszm: TEXTURE,
  ngtdm: TEXTURE,
};

function startsWithAny(name, prefixes) {
  return prefixes.some((prefix) => name.startsWith(prefix));
}

function stripPrefix(name, prefixes) {
  const prefix = prefixes.find((p) => name.startsWith(p));
  return name.slice(prefix.length).replace(/^_/, '');
}

// "log-sigma-1-0-mm-3D" -> "LoG σ=1.0 mm", "wavelet-LLH" -> "Wavelet LLH"
function formatImageFilter(imageType) {
  const log = imageType.match(/^log-sigma-(\d+)-(\d+)-mm/);
  if (log) return `LoG σ=${log[1]}.${log[2]} mm`;

  const [filter, ...parameters] = imageType.split('-');
  return [filter.charAt(0).toUpperCase() + filter.slice(1), ...parameters].join(
    ' '
  );
}

function parseFeatureName(featureName) {
  if (startsWithAny(featureName, RIESZ_FEATURE_PREFIXES)) {
    return {
      filter: null,
      category: TEXTURE,
      subcategory: 'Riesz',
      name: stripPrefix(featureName, RIESZ_FEATURE_PREFIXES),
    };
  }

  if (startsWithAny(featureName, ZRAD_FEATURE_PREFIXES)) {
    return {
      filter: null,
      category: 'ZRad',
      subcategory: '',
      name: stripPrefix(featureName, ZRAD_FEATURE_PREFIXES),
    };
  }

  const [imageType, featureClass, ...rest] = featureName.split('_');
  if (
    rest.length > 0 &&
    PYRADIOMICS_FEATURE_PREFIXES.includes(imageType.split('-')[0])
  ) {
    const name = rest.join('_');
    const definition = FEATURE_DEFINITIONS.find(
      (d) => d.id === `${featureClass}_${name}`
    );

    return {
      filter:
        imageType === ORIGINAL_IMAGE ? null : formatImageFilter(imageType),
      category:
        definition?.category || CLASS_CATEGORIES[featureClass] || featureClass,
      subcategory:
        definition?.subcategory ||
        (CLASS_CATEGORIES[featureClass] === TEXTURE
          ? featureClass.toUpperCase()
          : ''),
      name,
      description: definition?.description,
    };
  }

  return { filter: null, category: '', subcategory: '', name: featureName };
}

/**
 * Split a feature ID into its display parts.
 * Clinical IDs (`<file_id>::<name>`, or legacy bare names) have `clinical: true`.
 */
export function parseFeatureID(featureID) {
  const id = String(featureID);

  if (id.includes(CLINICAL_FEATURE_ID_SEPARATOR)) {
    const separatorIndex = id.indexOf(CLINICAL_FEATURE_ID_SEPARATOR);
    return {
      id,
      clinical: true,
      fileID: id.slice(0, separatorIndex),
      name: id.slice(separatorIndex + CLINICAL_FEATURE_ID_SEPARATOR.length),
    };
  }

  const parts = id.split(FEATURE_ID_SEPARATOR);
  if (parts.length < 3) return { id, clinical: true, fileID: null, name: id };

  const modality = parts[0].trim();
  const roi = parts.slice(1, -1).join(FEATURE_ID_SEPARATOR).trim();
  const parsed = parseFeatureName(parts[parts.length - 1]);
  const alias = FEATURE_CATEGORY_ALIASES?.[modality]?.[parsed.category];

  return {
    id,
    clinical: false,
    modality,
    roi,
    ...parsed,
    category: alias || parsed.category,
  };
}

/**
 * Column of the Feature Table, where a column holds one feature name for all
 * modalities: { group: "Texture › GLCM", name: "Id" }. Intensity is called
 * after every modality present ("Intensity/SUV" for CT & PET).
 */
export function formatFeatureColumn(featureName, modalities = []) {
  const parsed = parseFeatureName(featureName);

  let category = parsed.category;
  if (category && modalities.length > 0) {
    category = _uniqueValues(
      modalities.map(
        (modality) =>
          FEATURE_CATEGORY_ALIASES?.[modality]?.[category] || category
      )
    ).join('/');
  }

  return {
    group:
      [parsed.filter, category, parsed.subcategory]
        .filter(Boolean)
        .join(FEATURE_LABEL_SEPARATOR) || 'Other',
    name: parsed.name,
  };
}

function _uniqueValues(values) {
  return [...new Set(values)];
}

function labelParts(parsed) {
  if (parsed.clinical) return [CLINICAL_GROUP, parsed.name];

  return [
    parsed.modality,
    parsed.roi,
    parsed.filter,
    parsed.category,
    parsed.subcategory,
    parsed.name,
  ].filter(Boolean);
}

/** "CT‑ GTVn‑original_glcm_Id" -> "CT › GTVn › Texture › GLCM › Id" */
export function formatFeatureLabel(featureID) {
  return labelParts(parseFeatureID(featureID)).join(FEATURE_LABEL_SEPARATOR);
}

/** Label without modality and ROI: "Texture › GLCM › Id" */
export function formatFeatureShortLabel(featureID) {
  const parsed = parseFeatureID(featureID);
  if (parsed.clinical) return labelParts(parsed).join(FEATURE_LABEL_SEPARATOR);

  return [parsed.filter, parsed.category, parsed.subcategory, parsed.name]
    .filter(Boolean)
    .join(FEATURE_LABEL_SEPARATOR);
}

/**
 * Labels for a list of feature IDs (same order). Labels that would collide
 * (e.g. the same clinical column in two files) are told apart.
 */
export function formatFeatureLabels(featureIDs) {
  const parsedFeatures = featureIDs.map(parseFeatureID);
  const labels = parsedFeatures.map((parsed) =>
    labelParts(parsed).join(FEATURE_LABEL_SEPARATOR)
  );

  const counts = labels.reduce((acc, label) => {
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});

  return labels.map((label, i) => {
    if (counts[label] === 1) return label;

    const parsed = parsedFeatures[i];
    return parsed.clinical && parsed.fileID
      ? `${label} (file ${parsed.fileID})`
      : `${label} [${parsed.id}]`;
  });
}

function categoryRank(category) {
  const index = CATEGORY_ORDER.indexOf(category);
  return index === -1 ? CATEGORY_ORDER.length : index;
}

function compareCategories(a, b) {
  return categoryRank(a) - categoryRank(b) || a.localeCompare(b);
}

function sortedEntries(object, compare = (a, b) => a.localeCompare(b)) {
  return Object.keys(object)
    .sort(compare)
    .map((key) => [key, object[key]]);
}

/**
 * Group feature IDs like the Feature Selection tree:
 * [{ name: modality › ROI (or "Clinical"), total, categories: [{ name, total,
 *   features: [{ name, id, description }], subcategories: [{ name, features }] }] }]
 * Features without a subcategory are listed directly under their category.
 */
export function buildFeatureTree(featureIDs) {
  const groups = {};

  for (const featureID of new Set(featureIDs)) {
    const parsed = parseFeatureID(featureID);
    const groupName = parsed.clinical
      ? CLINICAL_GROUP
      : [parsed.modality, parsed.roi].join(FEATURE_LABEL_SEPARATOR);
    const category = parsed.clinical
      ? CLINICAL_GROUP
      : [parsed.filter, parsed.category].filter(Boolean).join(' ') || 'Other';

    groups[groupName] = groups[groupName] || {};
    groups[groupName][category] = groups[groupName][category] || {};
    const subcategory = parsed.subcategory || '';
    groups[groupName][category][subcategory] =
      groups[groupName][category][subcategory] || [];
    groups[groupName][category][subcategory].push({
      name: parsed.name,
      id: parsed.id,
      description: parsed.description,
    });
  }

  const byName = (a, b) => a.name.localeCompare(b.name);

  return sortedEntries(groups, (a, b) =>
    // Clinical features go last
    a === CLINICAL_GROUP ? 1 : b === CLINICAL_GROUP ? -1 : a.localeCompare(b)
  ).map(([name, categories]) => {
    const categoryNodes = sortedEntries(categories, compareCategories).map(
      ([categoryName, subcategories]) => {
        const features = (subcategories[''] || []).sort(byName);
        const subcategoryNodes = sortedEntries(subcategories)
          .filter(([subcategoryName]) => subcategoryName !== '')
          .map(([subcategoryName, subFeatures]) => ({
            name: subcategoryName,
            total: subFeatures.length,
            features: subFeatures.sort(byName),
          }));

        return {
          name: categoryName,
          total:
            features.length +
            subcategoryNodes.reduce((sum, s) => sum + s.total, 0),
          features,
          subcategories: subcategoryNodes,
        };
      }
    );

    return {
      name,
      total: categoryNodes.reduce((sum, c) => sum + c.total, 0),
      categories: categoryNodes,
    };
  });
}
