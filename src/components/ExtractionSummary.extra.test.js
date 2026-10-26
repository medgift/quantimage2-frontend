import React from 'react';
import { render, wait } from '@testing-library/react';

import Backend from '../services/backend';
import ExtractionSummary from './ExtractionSummary';

jest.mock('../services/backend');
// Jest 27 cannot resolve csv-parse's package "exports" ("csv-parse/sync")
jest.mock('csv-parse/sync', () => ({ parse: jest.fn() }), { virtual: true });
jest.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({ keycloak: { token: 'tok' }, initialized: true }),
}));

const SUMMARY = {
  extraction_id: 42,
  created_at: '2026-10-01T10:00:00',
  config: { status: 'missing', general: null, modalities: [] },
  features: { total: 0, by_family: {}, filters: {}, modalities: [], rois: [] },
  dataset: {
    studies: 0,
    data_splitting_type: 'traintest',
    train_test_split_type: 'automatic',
    training_patients: null,
    test_patients: null,
  },
};

async function renderDataset(props) {
  Backend.extractionSummary.mockResolvedValue(SUMMARY);
  const utils = render(
    <ExtractionSummary extractionID={42} allPatients={[]} {...props} />
  );
  await wait(() => utils.getByTestId('summary-dataset'));
  return utils.getByTestId('summary-dataset').textContent;
}

describe('creation date', () => {
  it('shows the extraction date from the API by default', async () => {
    const text = await renderDataset({});

    expect(text).toContain('Extracted on');
    expect(text).toContain('2026-10-01 10:00');
  });

  it('shows the collection creation date when viewing a collection', async () => {
    const text = await renderDataset({
      createdAt: '2026-10-20T08:30:15',
      isCollection: true,
    });

    expect(text).toContain('Collection created on');
    expect(text).toContain('2026-10-20 08:30');
    expect(text).not.toContain('2026-10-01');
  });
});

describe('overview polish', () => {
  const OK_SUMMARY = {
    ...SUMMARY,
    config: {
      status: 'ok',
      general: { padding: 5, submodalities: false, combine_segmentation: true },
      modalities: [
        {
          modality: 'CT',
          resampling: null,
          normalization: null,
          extractors: [],
        },
      ],
    },
    features: {
      total: 3,
      by_family: { shape: 2, glcm: 1 },
      filters: { original: 3 },
      modalities: ['CT'],
      rois: ['GTV'],
    },
    dataset: { ...SUMMARY.dataset, studies: 3 },
  };

  const CATEGORY = {
    name: 'classification',
    label_type: 'Classification',
    labels: [
      { patient_id: 'A', label_content: { Outcome: '0' } },
      { patient_id: 'B', label_content: { Outcome: '1' } },
      { patient_id: 'C', label_content: { Outcome: '1' } },
    ],
  };

  async function renderOk(props) {
    Backend.extractionSummary.mockResolvedValue(OK_SUMMARY);
    const utils = render(<ExtractionSummary extractionID={42} {...props} />);
    await wait(() => utils.getByTestId('summary-dataset'));
    return utils;
  }

  it('hides studies when there is one study per patient', async () => {
    const { getByTestId } = await renderOk({ allPatients: ['A', 'B', 'C'] });

    expect(getByTestId('summary-dataset').textContent).not.toMatch(/Studies/);
  });

  it('shows studies when they differ from the number of patients', async () => {
    const { getByTestId } = await renderOk({ allPatients: ['A', 'B'] });

    expect(getByTestId('summary-dataset').textContent).toMatch(/Studies\s*3/);
  });

  it('shows class percentages and does not repeat the outcome type', async () => {
    const { getByTestId } = await renderOk({
      allPatients: ['A', 'B', 'C'],
      unlabelledPatients: [],
      selectedLabelCategory: CATEGORY,
    });

    const text = getByTestId('summary-dataset').textContent;
    expect(text).toContain('0: 1 (33%)');
    expect(text).toContain('1: 2 (67%)');
    expect(text).not.toContain('(Classification)');
  });

  it('shows "none" for missing resampling and normalization', async () => {
    const { getByTestId } = await renderOk({ allPatients: [] });

    const row = getByTestId('summary-config').querySelector('tbody tr');
    expect(row.textContent).toBe('CTnone–none–');
  });

  it('hides the image filters row when only one filter was used', async () => {
    const { getByTestId } = await renderOk({ allPatients: [] });

    expect(getByTestId('summary-features').textContent).not.toMatch(
      /Image filters/
    );
  });

  it('orders families, modalities and ROIs consistently', async () => {
    Backend.extractionSummary.mockResolvedValue(OK_SUMMARY);
    const { getByTestId } = render(
      <ExtractionSummary
        extractionID={42}
        allPatients={[]}
        featureNames={[
          'original_glcm_Contrast',
          'tex_sig1_energy',
          'original_firstorder_Mean',
          'original_shape_Elongation',
        ]}
        modalities={['PT', 'CT']}
        rois={['GTVp', 'GTVn']}
      />
    );
    await wait(() => getByTestId('summary-features'));

    const text = getByTestId('summary-features').textContent;
    expect(text).toMatch(/shape.*firstorder.*glcm.*riesz/);
    expect(text).toMatch(/CT.*PT/);
    expect(text).toMatch(/GTVn.*GTVp/);
  });

  it('counts every labelled patient as training for a full dataset', async () => {
    const { getByTestId } = await renderOk({
      allPatients: ['A', 'B', 'C', 'D'],
      unlabelledPatients: ['D'],
      selectedLabelCategory: CATEGORY,
      patients: { training: null, test: null },
      dataSplittingType: 'fulldataset',
    });

    const text = getByTestId('summary-dataset').textContent;
    expect(text).toMatch(/Training patients\s*3/);
    expect(text).toContain('None (full dataset)');
    expect(text).not.toContain('Not set yet');
  });

  it('counts survival events given as floats', async () => {
    const { getByTestId } = await renderOk({
      allPatients: ['A', 'B', 'C', 'D'],
      unlabelledPatients: [],
      selectedLabelCategory: {
        name: 'OS',
        label_type: 'Survival',
        labels: [
          { patient_id: 'A', label_content: { Time: '10', Event: '1.0' } },
          { patient_id: 'B', label_content: { Time: '20', Event: '0.0' } },
          { patient_id: 'C', label_content: { Time: '30', Event: 1 } },
          { patient_id: 'D', label_content: { Time: '40', Event: '' } },
        ],
      },
    });

    const text = getByTestId('summary-dataset').textContent;
    expect(text).toContain('Events: 2');
    expect(text).toContain('Censored: 1');
  });

  it('shows "–" for unlabelled patients while they are still computed', async () => {
    const { getByTestId } = await renderOk({
      allPatients: ['A', 'B', 'C'],
      unlabelledPatients: null,
      selectedLabelCategory: CATEGORY,
    });

    expect(getByTestId('summary-dataset').textContent).toMatch(
      /Unlabelled patients\s*–/
    );
  });

  it('labels the count as feature types', async () => {
    const { getByTestId } = await renderOk({ allPatients: [] });

    expect(getByTestId('summary-features').textContent).toMatch(
      /Feature types\s*3/
    );
  });
});
