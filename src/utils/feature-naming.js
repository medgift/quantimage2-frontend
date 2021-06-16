import { FEATURE_DEFINITIONS } from './feature-mapping';

export const MODALITIES = ['CT', 'PET', 'MR'];
const FILTERS = ['log'];
const RIESZ_PREFIX = 'tex';

export const MODALITIES_MAP = { CT: 'CT', PET: 'PT', MR: 'MR' };

export function getFeatureDescription(featureName) {
  let match = featureName.match(PYRADIOMICS_PATTERN);

  if (match) {
    let definition = FEATURE_DEFINITIONS.find(
      (f) => f.id === `${match.groups.category}_${match.groups.name}`
    );

    if (definition && definition.description) return definition.description;
  } else {
    return '';
  }
}

export function groupFeatures(featureNames) {
  let featureGroups = {};
  let currentFeatureGroup = '';

  for (let featureName of featureNames) {
    // TODO - Make this more elegant, maybe a convention for feature names is needed
    // Group PyRadiomics features by the second level,
    // first level for other backends so far
    let { name, selected } = featureName;

    // Modality-specifc features (e.g. for PET)
    let featureModality = MODALITIES.find((m) => name.startsWith(m));
    let featureFilter = FILTERS.find((f) => name.startsWith(f));
    let isRiesz = name.startsWith(RIESZ_PREFIX);

    //let [featureGroupName, subGroupName, subsubGroupName] = getGroupName(
    let groups = getGroupName(name, featureModality, featureFilter, isRiesz);

    let targetObject = initGroups(featureGroups, groups);
    let shortFeatureName = getShortFeatureName(
      name,
      featureModality,
      featureFilter,
      isRiesz
    );
    targetObject[shortFeatureName] = {
      shortName: shortFeatureName,
      id: name,
      description: getFeatureDescription(name),
    };
  }

  return featureGroups;
}

function initGroups(featureGroups, groups) {
  let target = featureGroups;
  let previousGroup = null;

  groups = groups.filter((g) => g !== '');

  for (let i = 0; i < groups.length; i++) {
    let group = groups[i];

    if (i > 0) {
      target = target[previousGroup];
    }

    if (i < groups.length - 1) {
      if (!target[group]) target[group] = {};
    } else {
      if (!target[group]) target[group] = {};
      return target[group];
    }

    previousGroup = group;
  }
}

const FILTER_PATTERN = /(?<filter>.*?)-(?<parameters>.*?)_(?<category>.*)_(?<name>.*)/;
const MODALITY_PATTERN = /(?<modality>.*?)_(?<name>.*)/;
const PYRADIOMICS_PATTERN = /(?<image>)_(?<category>.*?)_(?<name>.*)/;
const RIESZ_PATTERN = /(?<category>.*?)_(?<name>.*)/;

function getGroupName(fullName, modality, filter, isRiesz) {
  if (modality) return [modality];

  if (filter) {
    let { filter, parameters } = fullName.match(FILTER_PATTERN).groups;
    return ['Texture', filter, `${parameters.replaceAll('-', ' ')}`];
  }

  if (isRiesz) return ['Texture', 'Riesz'];

  // Group is category if a feature definition exists
  let { category, name } = fullName.match(PYRADIOMICS_PATTERN).groups;

  let definition = FEATURE_DEFINITIONS.find(
    (d) => d.id === `${category}_${name}`
  );
  if (definition && definition.category)
    return [definition.category, definition.subcategory];

  return [category];
}

function getShortFeatureName(fullName, modality, filter, isRiesz) {
  let pattern;
  if (filter) {
    pattern = FILTER_PATTERN;
  } else if (modality) {
    pattern = MODALITY_PATTERN;
  } else if (isRiesz) {
    pattern = RIESZ_PATTERN;
  } else {
    pattern = PYRADIOMICS_PATTERN;
  }

  let { name } = fullName.match(pattern).groups;

  return name;
}
