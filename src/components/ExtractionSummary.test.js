import React from 'react';
import { render, wait } from '@testing-library/react';

import Backend from '../services/backend';
import ExtractionSummary from './ExtractionSummary';

jest.mock('../services/backend');
// Jest 27 cannot resolve csv-parse's package "exports" ("csv-parse/sync"),
// which src/utils/feature-utils.js imports transitively through
// config/constants. It is not used by the code under test here.
jest.mock('csv-parse/sync', () => ({ parse: jest.fn() }), { virtual: true });
jest.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({ keycloak: { token: 'tok' }, initialized: true }),
}));

const EXTRACTION_ID = 42;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FEATURE_NAMES = [
  'original_shape_Elongation',
  'original_shape_Sphericity',
  'original_firstorder_Mean',
  'original_firstorder_Entropy',
  'original_firstorder_Skewness',
  'original_firstorder_Kurtosis',
  'original_firstorder_Median',
  'original_glcm_Contrast',
  'original_glcm_Idm',
  'original_glcm_Correlation',
  'original_glcm_JointEnergy',
  'original_glcm_ClusterShade',
  'original_glcm_Autocorrelation',
];

const OK_CONFIG = {
  status: 'ok',
  general: { padding: 5, submodalities: false, combine_segmentation: true },
  modalities: [
    {
      modality: 'CT',
      resampling: {
        spacing: [1.0, 1.0, 1.0],
        order: 1,
        interpolation: 'linear',
      },
      normalization: null,
      extractors: [
        {
          backend: 'pyradiomics',
          name: 'original',
          image_types: ['Original'],
          feature_classes: ['shape', 'firstorder', 'glcm'],
          settings: { binWidth: 20, voxelArrayShift: 1000 },
        },
      ],
    },
    {
      modality: 'PT',
      resampling: {
        spacing: [2.0, 2.0, 2.0],
        order: 3,
        interpolation: 'cubic',
      },
      normalization: null,
      extractors: [
        {
          backend: 'pyradiomics',
          name: 'original',
          image_types: ['Original'],
          feature_classes: ['shape', 'firstorder', 'glcm'],
          settings: { binWidth: 0.2, voxelArrayShift: 0 },
        },
      ],
    },
  ],
};

const MRI_CONFIG = {
  status: 'ok',
  general: { padding: 5, submodalities: true, combine_segmentation: false },
  modalities: [
    {
      modality: 'MR_T1',
      resampling: {
        spacing: [1.0, 1.0, 1.0],
        order: 1,
        interpolation: 'linear',
      },
      normalization: { type: 'standardizer', params: { threshold: 0.001 } },
      extractors: [
        {
          backend: 'pyradiomics',
          name: 'original',
          image_types: ['Original'],
          feature_classes: ['firstorder'],
          settings: { binCount: 64 },
        },
      ],
    },
  ],
};

function makeSummary({ config = OK_CONFIG, dataset = {} } = {}) {
  return {
    extraction_id: EXTRACTION_ID,
    created_at: '2026-10-01T10:00:00',
    config,
    features: {
      total: 13,
      by_family: { shape: 2, firstorder: 5, glcm: 6 },
      filters: { original: 13 },
      modalities: ['CT', 'PT'],
      rois: ['GTV_L', 'GTV_T'],
    },
    dataset: {
      studies: 15,
      data_splitting_type: 'traintest',
      train_test_split_type: 'automatic',
      training_patients: 8,
      test_patients: 3,
      ...dataset,
    },
  };
}

const patientIDs = (n, prefix = 'P') =>
  Array.from(
    { length: n },
    (_, i) => `${prefix}${String(i + 1).padStart(2, '0')}`
  );

// 13 patients: 4 CR, 7 PD, 2 unlabelled (P12 empty outcome, P13 no label)
const CLASSIF_PATIENTS = patientIDs(13);
const CLASSIF_CATEGORY = {
  id: 1,
  name: 'Recurrence',
  label_type: 'Classification',
  labels: [
    ...CLASSIF_PATIENTS.slice(0, 4).map((p) => ({
      patient_id: p,
      label_content: { Outcome: 'CR' },
    })),
    ...CLASSIF_PATIENTS.slice(4, 11).map((p) => ({
      patient_id: p,
      label_content: { Outcome: 'PD' },
    })),
    { patient_id: CLASSIF_PATIENTS[11], label_content: { Outcome: '' } },
  ],
};
const CLASSIF_UNLABELLED = [CLASSIF_PATIENTS[11], CLASSIF_PATIENTS[12]];

// 9 patients: 5 events, 3 censored, 1 unlabelled (no label)
const SURV_PATIENTS = patientIDs(9, 'S');
const SURV_CATEGORY = {
  id: 2,
  name: 'Overall survival',
  label_type: 'Survival',
  labels: [
    ...SURV_PATIENTS.slice(0, 5).map((p, i) => ({
      patient_id: p,
      label_content: { Time: String(100 + i), Event: '1' },
    })),
    ...SURV_PATIENTS.slice(5, 8).map((p, i) => ({
      patient_id: p,
      label_content: { Time: String(400 + i), Event: '0' },
    })),
  ],
};
const SURV_UNLABELLED = [SURV_PATIENTS[8]];

function baseProps(overrides = {}) {
  return {
    extractionID: EXTRACTION_ID,
    patients: {
      training: CLASSIF_PATIENTS.slice(0, 8),
      test: CLASSIF_PATIENTS.slice(8, 11),
    },
    allPatients: CLASSIF_PATIENTS,
    unlabelledPatients: CLASSIF_UNLABELLED,
    selectedLabelCategory: CLASSIF_CATEGORY,
    featureNames: FEATURE_NAMES,
    modalities: ['CT', 'PT'],
    rois: ['GTV_T', 'GTV_L'],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const textOf = (el) => el.textContent.replace(/\s+/g, ' ');

const escape = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The number `n` appears as a standalone number (not part of a longer number)
function hasNumber(text, n) {
  return new RegExp(`(?<![\\d.])${escape(n)}(?![\\d.]*\\d)`).test(text);
}

// "<label>: n" / "<label> n" / "<label>n" (label-first) or "n <label>"
// (number immediately followed by the label).
function hasLabelledCount(text, label, n) {
  const num = escape(n);
  return new RegExp(
    `${label}\\w*[^\\d]{0,25}?(?<![\\d.])${num}(?![\\d.]*\\d)|(?<![\\d.])${num}\\s*${label}`,
    'i'
  ).test(text);
}

async function renderLoaded(props = baseProps(), summary = makeSummary()) {
  Backend.extractionSummary.mockResolvedValue(summary);
  const utils = render(<ExtractionSummary {...props} />);
  await wait(() => {
    const config = utils.queryByTestId('summary-config');
    if (!config) throw new Error('config card not rendered yet');
    if (summary.config.status === 'ok') {
      if (!textOf(config).includes(summary.config.modalities[0].modality)) {
        throw new Error('config not loaded yet');
      }
    } else if (!/Configuration not available/.test(textOf(config))) {
      throw new Error('config status not rendered yet');
    }
  });
  return utils;
}

function spinnerIn(container) {
  return (
    container.querySelector(
      '.spinner-border, .spinner-grow, .fa-spin, .fa-spinner, [role="status"]'
    ) !== null || /loading/i.test(container.textContent)
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Fetching, loading and error states (AC9)
// ---------------------------------------------------------------------------

describe('ExtractionSummary data loading', () => {
  it('fetches the summary of the given extraction with the keycloak token', async () => {
    await renderLoaded();

    expect(Backend.extractionSummary).toHaveBeenCalledWith(
      'tok',
      EXTRACTION_ID
    );
  });

  it('shows a spinner while the summary is loading', () => {
    Backend.extractionSummary.mockReturnValue(new Promise(() => {}));

    const { container } = render(<ExtractionSummary {...baseProps()} />);

    expect(spinnerIn(container)).toBe(true);
    expect(container.textContent).not.toContain('1 × 1 × 1 mm');
  });

  it('renders the three cards once loaded and drops the spinner', async () => {
    const { getByTestId, container } = await renderLoaded();

    expect(getByTestId('summary-config')).toBeTruthy();
    expect(getByTestId('summary-features')).toBeTruthy();
    expect(getByTestId('summary-dataset')).toBeTruthy();
    expect(
      container.querySelector('.spinner-border, .spinner-grow, .fa-spin')
    ).toBeNull();
  });

  it('shows an alert instead of the summary when the request fails', async () => {
    Backend.extractionSummary.mockRejectedValue(
      new Error('Feature extraction not found')
    );

    const { container } = render(<ExtractionSummary {...baseProps()} />);

    await wait(() => {
      if (!container.querySelector('[role="alert"], .alert')) {
        throw new Error('no alert yet');
      }
    });
    expect(container.textContent).not.toContain('1 × 1 × 1 mm');
    expect(
      container.querySelector('.spinner-border, .spinner-grow, .fa-spin')
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Configuration card (AC9)
// ---------------------------------------------------------------------------

describe('Configuration card', () => {
  it('shows one row per modality with spacing, interpolation and bin width', async () => {
    const { getByTestId } = await renderLoaded();

    const text = textOf(getByTestId('summary-config'));
    expect(text).toContain('1 × 1 × 1 mm');
    expect(text).toContain('2 × 2 × 2 mm');
    expect(text).toContain('linear');
    expect(text).toContain('cubic');
    expect(hasNumber(text, 20)).toBe(true);
    expect(hasNumber(text, 0.2)).toBe(true);

    // Row order: CT row (1 mm, linear) comes before PT row (2 mm, cubic)
    const ct = text.indexOf('CT');
    const pt = text.indexOf('PT');
    expect(ct).toBeGreaterThanOrEqual(0);
    expect(pt).toBeGreaterThan(ct);
    expect(text.indexOf('1 × 1 × 1 mm')).toBeGreaterThan(ct);
    expect(text.indexOf('1 × 1 × 1 mm')).toBeLessThan(pt);
    expect(text.indexOf('linear')).toBeGreaterThan(ct);
    expect(text.indexOf('linear')).toBeLessThan(pt);
    expect(text.indexOf('2 × 2 × 2 mm')).toBeGreaterThan(pt);
    expect(text.indexOf('cubic')).toBeGreaterThan(pt);
  });

  it('shows the normalization type and the bin count', async () => {
    const { getByTestId } = await renderLoaded(
      baseProps({ modalities: ['MR_T1'] }),
      makeSummary({ config: MRI_CONFIG })
    );

    const text = textOf(getByTestId('summary-config'));
    expect(text).toContain('MR_T1');
    expect(text).toContain('1 × 1 × 1 mm');
    expect(text).toContain('linear');
    expect(text).toMatch(/standardizer/i);
    expect(hasNumber(text, 64)).toBe(true);
  });

  it('shows an unusual interpolation label verbatim', async () => {
    const config = {
      ...OK_CONFIG,
      modalities: [
        {
          ...OK_CONFIG.modalities[0],
          resampling: {
            spacing: [1, 1, 1],
            order: 2,
            interpolation: 'bspline order 2',
          },
        },
      ],
    };

    const { getByTestId } = await renderLoaded(
      baseProps(),
      makeSummary({ config })
    );

    expect(textOf(getByTestId('summary-config'))).toContain('bspline order 2');
  });

  it('does not crash on a modality without resampling or extractors', async () => {
    const config = {
      status: 'ok',
      general: {
        padding: 'whole_image',
        submodalities: null,
        combine_segmentation: null,
      },
      modalities: [
        {
          modality: 'CT',
          resampling: null,
          normalization: null,
          extractors: [],
        },
      ],
    };

    const { getByTestId } = await renderLoaded(
      baseProps(),
      makeSummary({ config })
    );

    const text = textOf(getByTestId('summary-config'));
    expect(text).toContain('CT');
    expect(text).not.toContain('Configuration not available');
    expect(text).not.toMatch(/undefined|NaN|\[object Object\]/);
  });

  it.each(['missing', 'invalid', 'unrecognized'])(
    'shows "Configuration not available" when status is %s',
    async (status) => {
      const { getByTestId } = await renderLoaded(
        baseProps(),
        makeSummary({ config: { status, general: null, modalities: [] } })
      );

      const text = textOf(getByTestId('summary-config'));
      expect(text).toContain('Configuration not available');
      expect(text).not.toContain('× ');
      // The other cards still render
      expect(getByTestId('summary-features')).toBeTruthy();
      expect(getByTestId('summary-dataset')).toBeTruthy();
    }
  );
});

// ---------------------------------------------------------------------------
// Features card
// ---------------------------------------------------------------------------

describe('Features card', () => {
  it('shows the total, counts per family, modalities and ROIs', async () => {
    const { getByTestId } = await renderLoaded();

    const text = textOf(getByTestId('summary-features'));
    expect(hasNumber(text, 13)).toBe(true);
    expect(hasLabelledCount(text, 'shape', 2)).toBe(true);
    expect(hasLabelledCount(text, 'firstorder', 5)).toBe(true);
    expect(hasLabelledCount(text, 'glcm', 6)).toBe(true);
    ['CT', 'PT', 'GTV_T', 'GTV_L'].forEach((name) =>
      expect(text).toContain(name)
    );
  });

  it('uses the API features when featureNames is not given', async () => {
    const props = baseProps();
    delete props.featureNames;
    const summary = makeSummary();
    summary.features = {
      ...summary.features,
      total: 214,
      by_family: { shape: 14, firstorder: 18, glcm: 24, riesz: 158 },
      filters: { original: 56 },
    };

    const { getByTestId } = await renderLoaded(props, summary);

    const text = textOf(getByTestId('summary-features'));
    expect(hasNumber(text, 214)).toBe(true);
    expect(hasLabelledCount(text, 'shape', 14)).toBe(true);
    expect(hasLabelledCount(text, 'firstorder', 18)).toBe(true);
    expect(hasLabelledCount(text, 'glcm', 24)).toBe(true);
    expect(hasLabelledCount(text, 'riesz', 158)).toBe(true);
    expect(text).not.toMatch(/undefined|NaN|\[object Object\]/);
  });

  it('uses the API features when featureNames is null', async () => {
    const summary = makeSummary();
    summary.features = {
      ...summary.features,
      total: 9,
      by_family: { shape: 4, glszm: 5 },
      filters: { original: 9 },
    };

    const { getByTestId } = await renderLoaded(
      baseProps({ featureNames: null }),
      summary
    );

    const text = textOf(getByTestId('summary-features'));
    expect(hasNumber(text, 9)).toBe(true);
    expect(hasLabelledCount(text, 'shape', 4)).toBe(true);
    expect(hasLabelledCount(text, 'glszm', 5)).toBe(true);
    expect(text).not.toMatch(/firstorder/i);
  });

  it('uses the collection props for features when viewing a collection', async () => {
    const collectionFeatures = [
      'original_shape_Elongation',
      'original_shape_Sphericity',
      'original_shape_Maximum3DDiameter',
      'original_glcm_Contrast',
    ];

    const { getByTestId } = await renderLoaded(
      baseProps({
        featureNames: collectionFeatures,
        modalities: ['CT'],
        rois: ['GTV_T'],
      })
    );

    // Configuration still comes from the parent extraction
    expect(Backend.extractionSummary).toHaveBeenCalledWith(
      'tok',
      EXTRACTION_ID
    );
    expect(textOf(getByTestId('summary-config'))).toContain('1 × 1 × 1 mm');

    const text = textOf(getByTestId('summary-features'));
    expect(hasNumber(text, 4)).toBe(true);
    expect(hasNumber(text, 13)).toBe(false);
    expect(hasLabelledCount(text, 'shape', 3)).toBe(true);
    expect(hasLabelledCount(text, 'glcm', 1)).toBe(true);
    expect(text).not.toMatch(/firstorder/i);
    expect(text).toContain('CT');
    expect(text).toContain('GTV_T');
    expect(text).not.toContain('PT');
    expect(text).not.toContain('GTV_L');
  });
});

// ---------------------------------------------------------------------------
// Dataset card (AC10)
// ---------------------------------------------------------------------------

describe('Dataset card', () => {
  it('shows patients, studies, outcome and class counts for Classification', async () => {
    const { getByTestId } = await renderLoaded();

    const text = textOf(getByTestId('summary-dataset'));
    expect(hasNumber(text, 13)).toBe(true); // allPatients.length
    expect(hasNumber(text, 15)).toBe(true); // studies from the API
    expect(hasLabelledCount(text, 'stud(?:y|ies)', 15)).toBe(true);
    expect(text).toContain('Recurrence');
    expect(text).toContain('Classification');
    expect(hasLabelledCount(text, 'CR', 4)).toBe(true);
    expect(hasLabelledCount(text, 'PD', 7)).toBe(true);
    expect(hasLabelledCount(text, 'unlabell?ed', 2)).toBe(true);
  });

  it('shows events vs censored for Survival', async () => {
    const { getByTestId } = await renderLoaded(
      baseProps({
        allPatients: SURV_PATIENTS,
        unlabelledPatients: SURV_UNLABELLED,
        selectedLabelCategory: SURV_CATEGORY,
        patients: null,
      })
    );

    const text = textOf(getByTestId('summary-dataset'));
    expect(hasNumber(text, 9)).toBe(true);
    expect(text).toContain('Overall survival');
    expect(text).toContain('Survival');
    expect(hasLabelledCount(text, 'event', 5)).toBe(true);
    expect(hasLabelledCount(text, 'censored', 3)).toBe(true);
    expect(hasLabelledCount(text, 'unlabell?ed', 1)).toBe(true);
  });

  it('shows the train/test sizes of a saved split', async () => {
    const { getByTestId } = await renderLoaded();

    const text = textOf(getByTestId('summary-dataset'));
    expect(text).toMatch(/train/i);
    expect(text).toMatch(/test/i);
    expect(hasNumber(text, 8)).toBe(true);
    expect(hasNumber(text, 3)).toBe(true);
    expect(text).not.toContain('Not set yet');
  });

  it('shows "Not set yet" when there is no saved split (patients null)', async () => {
    const { getByTestId } = await renderLoaded(
      baseProps({ patients: null }),
      makeSummary({ dataset: { training_patients: null, test_patients: null } })
    );

    const text = textOf(getByTestId('summary-dataset'));
    expect(text).toContain('Not set yet');
    expect(hasNumber(text, 8)).toBe(false);
  });

  it('shows "Not set yet" when the split has null training/test lists', async () => {
    const { getByTestId } = await renderLoaded(
      baseProps({ patients: { training: null, test: null } }),
      makeSummary({ dataset: { training_patients: null, test_patients: null } })
    );

    expect(textOf(getByTestId('summary-dataset'))).toContain('Not set yet');
  });

  it('uses the collection patients when viewing a collection', async () => {
    const collectionPatients = patientIDs(5, 'C');

    const { getByTestId } = await renderLoaded(
      baseProps({
        allPatients: collectionPatients,
        unlabelledPatients: [],
        selectedLabelCategory: null,
        patients: {
          training: collectionPatients.slice(0, 4),
          test: collectionPatients.slice(4),
        },
      })
    );

    const text = textOf(getByTestId('summary-dataset'));
    expect(hasNumber(text, 5)).toBe(true);
    expect(hasNumber(text, 13)).toBe(false);
    expect(hasNumber(text, 4)).toBe(true);
    expect(hasNumber(text, 1)).toBe(true);
  });

  it('renders without an outcome selected', async () => {
    const { getByTestId } = await renderLoaded(
      baseProps({ selectedLabelCategory: null, unlabelledPatients: null })
    );

    const text = textOf(getByTestId('summary-dataset'));
    expect(hasNumber(text, 13)).toBe(true);
    expect(text).not.toContain('Recurrence');
    expect(text).not.toMatch(/undefined|NaN|\[object Object\]/);
  });

  it('never shows patient IDs', async () => {
    const { container } = await renderLoaded();

    CLASSIF_PATIENTS.forEach((p) =>
      expect(container.textContent).not.toContain(p)
    );
  });
});
