import React from 'react';
import { render, wait } from '@testing-library/react';

import Backend from '../services/backend';
import ExtractionSummary, { summarizeFeatureNames } from './ExtractionSummary';

jest.mock('../services/backend');
// Jest 27 cannot resolve csv-parse's package "exports" ("csv-parse/sync"),
// which src/utils/feature-utils.js imports transitively through
// config/constants. It is not used by the code under test here.
jest.mock('csv-parse/sync', () => ({ parse: jest.fn() }), { virtual: true });

// Mutable token so a Keycloak token refresh can be simulated
let mockToken = 'tok';
jest.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({ keycloak: { token: mockToken }, initialized: true }),
}));

const EXTRACTION_ID = 42;

const OK_CONFIG = {
  status: 'ok',
  general: { padding: 5, submodalities: false, combine_segmentation: true },
  modalities: [
    {
      modality: 'CT',
      resampling: { spacing: [1, 1, 1], order: 1, interpolation: 'linear' },
      normalization: null,
      extractors: [
        {
          backend: 'pyradiomics',
          name: 'original',
          image_types: ['Original'],
          feature_classes: ['firstorder'],
          settings: { binWidth: 25 },
        },
      ],
    },
  ],
};

function makeSummary({ config = OK_CONFIG, dataset = {}, features = {} } = {}) {
  return {
    extraction_id: EXTRACTION_ID,
    created_at: '2026-10-01T10:00:00',
    config,
    features: {
      total: 2,
      by_family: { firstorder: 2 },
      filters: { original: 2 },
      modalities: ['CT'],
      rois: ['GTV_T'],
      ...features,
    },
    dataset: {
      studies: 4,
      data_splitting_type: 'traintest',
      train_test_split_type: 'automatic',
      training_patients: 3,
      test_patients: 1,
      ...dataset,
    },
  };
}

const PATIENTS = ['P1', 'P2', 'P3', 'P4'];

function baseProps(overrides = {}) {
  return {
    extractionID: EXTRACTION_ID,
    patients: { training: ['P1', 'P2', 'P3'], test: ['P4'] },
    allPatients: PATIENTS,
    unlabelledPatients: [],
    selectedLabelCategory: null,
    featureNames: null,
    modalities: ['CT'],
    rois: ['GTV_T'],
    ...overrides,
  };
}

const textOf = (el) => el.textContent.replace(/\s+/g, ' ');

async function renderLoaded(props = baseProps(), summary = makeSummary()) {
  Backend.extractionSummary.mockResolvedValue(summary);
  const utils = render(<ExtractionSummary {...props} />);
  await wait(() => {
    if (!utils.queryByTestId('summary-dataset')) {
      throw new Error('not loaded yet');
    }
  });
  return utils;
}

// Render and wait until either the cards or an error/crash is visible
async function renderSettled(props, summary) {
  Backend.extractionSummary.mockResolvedValue(summary);
  const utils = render(<ExtractionSummary {...props} />);
  await wait(() => {
    if (!utils.queryByTestId('summary-dataset')) throw new Error('not yet');
  });
  return utils;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockToken = 'tok';
});

// ---------------------------------------------------------------------------
// Unexpected API shapes
// ---------------------------------------------------------------------------

describe('unexpected API shapes do not crash the Overview', () => {
  // A render error inside the component unmounts the whole Features page
  // (there is no error boundary), so these must degrade gracefully.
  let consoleError;
  beforeEach(() => {
    consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => consoleError.mockRestore());

  it('handles an extractor without settings', async () => {
    const config = {
      ...OK_CONFIG,
      modalities: [
        {
          ...OK_CONFIG.modalities[0],
          extractors: [
            {
              backend: 'pyradiomics',
              name: 'original',
              image_types: ['Original'],
              feature_classes: [],
            },
          ],
        },
      ],
    };

    const { getByTestId } = await renderSettled(
      baseProps(),
      makeSummary({ config })
    );

    expect(textOf(getByTestId('summary-config'))).toContain('CT');
  });

  it('handles a modality without an extractors list', async () => {
    const config = {
      ...OK_CONFIG,
      modalities: [
        {
          modality: 'CT',
          resampling: null,
          normalization: null,
        },
      ],
    };

    const { getByTestId } = await renderSettled(
      baseProps(),
      makeSummary({ config })
    );

    expect(textOf(getByTestId('summary-config'))).toContain('CT');
  });

  it('handles a non-list spacing', async () => {
    const config = {
      ...OK_CONFIG,
      modalities: [
        {
          ...OK_CONFIG.modalities[0],
          resampling: { spacing: 2, order: 1, interpolation: 'linear' },
        },
      ],
    };

    const { getByTestId } = await renderSettled(
      baseProps(),
      makeSummary({ config })
    );

    expect(textOf(getByTestId('summary-config'))).not.toMatch(
      /undefined|NaN|\[object Object\]/
    );
  });

  it('renders "–" for patients while allPatients is still null', async () => {
    const { getByTestId } = await renderLoaded(
      baseProps({ allPatients: null, unlabelledPatients: null })
    );

    const text = textOf(getByTestId('summary-dataset'));
    expect(text).toMatch(/Patients\s*–/);
    expect(text).not.toMatch(/undefined|NaN/);
  });

  it('does not print "null" when train_test_split_type is null', async () => {
    const { getByTestId } = await renderLoaded(
      baseProps(),
      makeSummary({ dataset: { train_test_split_type: null } })
    );

    expect(textOf(getByTestId('summary-dataset'))).not.toMatch(
      /null|undefined/
    );
  });
});

// ---------------------------------------------------------------------------
// Outcome edge cases
// ---------------------------------------------------------------------------

describe('outcome counts', () => {
  it('counts numeric classification labels', async () => {
    const category = {
      name: 'Recurrence',
      label_type: 'Classification',
      labels: [
        { patient_id: 'P1', label_content: { Outcome: 1 } },
        { patient_id: 'P2', label_content: { Outcome: 1 } },
        { patient_id: 'P3', label_content: { Outcome: 0 } },
        { patient_id: 'P4', label_content: { Outcome: 0 } },
      ],
    };

    const { getByTestId } = await renderLoaded(
      baseProps({ selectedLabelCategory: category })
    );

    const text = textOf(getByTestId('summary-dataset'));
    expect(text).toMatch(/1: 2/);
    expect(text).toMatch(/0: 2/);
  });

  it.each([
    ['numbers', 1, 0],
    ['booleans', true, false],
    ['strings with spaces', ' 1 ', ' 0 '],
    ['True/False strings', 'True', 'False'],
  ])('counts survival events given as %s', async (_label, ev, cens) => {
    const category = {
      name: 'OS',
      label_type: 'Survival',
      labels: [
        { patient_id: 'P1', label_content: { Time: 10, Event: ev } },
        { patient_id: 'P2', label_content: { Time: 20, Event: ev } },
        { patient_id: 'P3', label_content: { Time: 30, Event: ev } },
        { patient_id: 'P4', label_content: { Time: 40, Event: cens } },
      ],
    };

    const { getByTestId } = await renderLoaded(
      baseProps({ selectedLabelCategory: category })
    );

    const text = textOf(getByTestId('summary-dataset'));
    expect(text).toMatch(/Events: 3/);
    expect(text).toMatch(/Censored: 1/);
  });

  it('handles a selected outcome with no labels at all', async () => {
    const category = { name: 'Empty', label_type: 'Classification', labels: [] };

    const { getByTestId } = await renderLoaded(
      baseProps({
        selectedLabelCategory: category,
        unlabelledPatients: PATIENTS,
      })
    );

    const text = textOf(getByTestId('summary-dataset'));
    expect(text).toMatch(/Unlabelled patients\s*4/);
    expect(text).not.toMatch(/undefined|NaN/);
  });

  it('ignores labels of patients that are not in the extraction', async () => {
    const category = {
      name: 'Recurrence',
      label_type: 'Classification',
      labels: [
        { patient_id: 'P1', label_content: { Outcome: 'CR' } },
        { patient_id: 'GHOST', label_content: { Outcome: 'CR' } },
      ],
    };

    const { getByTestId } = await renderLoaded(
      baseProps({
        selectedLabelCategory: category,
        unlabelledPatients: ['P2', 'P3', 'P4'],
      })
    );

    expect(textOf(getByTestId('summary-dataset'))).toMatch(/CR: 1(?!\d)/);
  });
});

// ---------------------------------------------------------------------------
// Staleness: values the user changes in the same session
// ---------------------------------------------------------------------------

describe('staleness', () => {
  it('shows the saved split after the user switches from full dataset to train/test', async () => {
    // Loaded while the extraction was "full dataset" with no split...
    const { getByTestId, rerender } = await renderLoaded(
      baseProps({ patients: { training: null, test: null } }),
      makeSummary({
        dataset: {
          data_splitting_type: 'fulldataset',
          training_patients: null,
          test_patients: null,
        },
      })
    );

    // ...then Features.js saves a train/test split and passes the new patients
    rerender(
      <ExtractionSummary
        {...baseProps({ patients: { training: ['P1', 'P2', 'P3'], test: ['P4'] } })}
      />
    );

    const text = textOf(getByTestId('summary-dataset'));
    expect(text).toMatch(/Training patients\s*3/);
    expect(text).toMatch(/Test patients\s*1/);
  });

  it('keeps the cards (no spinner, no refetch) when the Keycloak token is refreshed', async () => {
    const { container, rerender } = await renderLoaded();
    expect(Backend.extractionSummary).toHaveBeenCalledTimes(1);

    mockToken = 'refreshed-token';
    Backend.extractionSummary.mockReturnValue(new Promise(() => {}));
    rerender(<ExtractionSummary {...baseProps()} />);

    expect(
      container.querySelector('[data-testid="summary-dataset"]')
    ).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// JS mirror of the backend grouping
// ---------------------------------------------------------------------------

describe('summarizeFeatureNames parity with the backend', () => {
  it.each([
    ['squareroot_firstorder_Mean', 'firstorder', 'squareroot'],
    ['logarithm_glrlm_RunEntropy', 'glrlm', 'logarithm'],
    ['log-sigma-3-0-mm-3D_glszm_ZoneEntropy', 'glszm', 'log'],
    ['wavelet-HHH_firstorder_Mean', 'firstorder', 'wavelet'],
    ['original_shape', 'other', null],
    ['lbp-3D-m1_glcm_Contrast', 'other', null],
    ['tex_mean_x', 'riesz', null],
    ['zrad_glcm_x', 'zrad', null],
    ['PatientAge', 'other', null],
  ])('%s -> %s / %s', (name, family, filter) => {
    const result = summarizeFeatureNames([name, name]);

    expect(result.total).toBe(1);
    expect(result.by_family).toEqual({ [family]: 1 });
    expect(result.filters).toEqual(filter ? { [filter]: 1 } : {});
  });

  it('handles an empty collection', () => {
    expect(summarizeFeatureNames([])).toEqual({
      total: 0,
      by_family: {},
      filters: {},
    });
  });
});

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

describe('fetching', () => {
  it('does not fetch without an extraction id', () => {
    render(<ExtractionSummary {...baseProps({ extractionID: null })} />);

    expect(Backend.extractionSummary).not.toHaveBeenCalled();
  });

  it('refetches when the extraction changes and ignores the stale response', async () => {
    let resolveFirst;
    Backend.extractionSummary
      .mockImplementationOnce(
        () => new Promise((resolve) => (resolveFirst = resolve))
      )
      .mockResolvedValueOnce(makeSummary({ dataset: { studies: 777 } }));

    const { rerender, getByTestId } = render(
      <ExtractionSummary {...baseProps()} />
    );
    rerender(<ExtractionSummary {...baseProps({ extractionID: 43 })} />);

    await wait(() => getByTestId('summary-dataset'));
    resolveFirst(makeSummary({ dataset: { studies: 111 } }));
    await new Promise((r) => setTimeout(r, 0));

    const text = textOf(getByTestId('summary-dataset'));
    expect(text).toContain('777');
    expect(text).not.toContain('111');
  });

  it('does not render any patient ID', async () => {
    const category = {
      name: 'Recurrence',
      label_type: 'Classification',
      labels: PATIENTS.map((p) => ({
        patient_id: p,
        label_content: { Outcome: 'CR' },
      })),
    };
    const { container } = await renderLoaded(
      baseProps({
        allPatients: ['SECRET-PAT-1', 'SECRET-PAT-2'],
        unlabelledPatients: ['SECRET-PAT-2'],
        patients: { training: ['SECRET-PAT-1'], test: ['SECRET-PAT-2'] },
        selectedLabelCategory: category,
      })
    );

    expect(container.textContent).not.toContain('SECRET-PAT');
  });
});
