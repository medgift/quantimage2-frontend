import React from 'react';
import { render, wait } from '@testing-library/react';

import Backend from '../services/backend';
import BootstrapHistogram from './BootstrapHistogram';

jest.mock('../services/backend');
jest.mock('plotly.js-dist', () => ({ newPlot: jest.fn() }));
jest.mock('@fortawesome/react-fontawesome', () => ({
  FontAwesomeIcon: () => null,
}));
// Same Jest 27 workaround as ExtractionSummary.test.js
jest.mock('csv-parse/sync', () => ({ parse: jest.fn() }), { virtual: true });
jest.mock('@react-keycloak/web', () => ({
  useKeycloak: () => ({ keycloak: { token: 'tok' }, initialized: true }),
}));

const MODELS = [
  { id: 1, name: 'A' },
  { id: 2, name: 'B' },
  { id: 3, name: 'C' },
];
const LABELS = { 1: 'Model A', 2: 'Model B', 3: 'Model C' };

const scores = (base) => ({
  algorithm: 'logistic',
  normalization: 'standardization',
  test_scores: Array.from({ length: 20 }, (_, i) => ({
    auc: base + i * 0.001,
  })),
});

const P_VALUES = {
  p_values: {
    model_1: { model_2: 0.0001, model_3: 0.2 },
    model_2: { model_3: 0.03 },
  },
};

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  Backend.getTestScoresValues.mockImplementation(async (token, id) =>
    scores(0.6 + id * 0.05)
  );
});

afterEach(() => {
  jest.restoreAllMocks();
});

const renderHistogram = () =>
  render(
    <BootstrapHistogram
      modelsData={MODELS}
      modelLabels={LABELS}
      hideContainer={true}
    />
  );

describe('BootstrapHistogram p-values', () => {
  it('shows a loading message while p-values are being computed', async () => {
    let resolve;
    Backend.compareModelsData.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      })
    );

    const { getByTestId } = renderHistogram();

    await wait(() =>
      expect(getByTestId('bootstrap-pvalues').textContent).toMatch(
        /Computing p-values for 3 model pairs/
      )
    );

    resolve(P_VALUES);
    await wait(() =>
      expect(getByTestId('bootstrap-pvalues').textContent).not.toMatch(
        /Computing/
      )
    );
  });

  it('lists every pair in a table with significance markers', async () => {
    Backend.compareModelsData.mockResolvedValue(P_VALUES);

    const { getByTestId } = renderHistogram();

    await wait(() =>
      expect(
        getByTestId('bootstrap-pvalues').querySelectorAll('tbody tr')
      ).toHaveLength(3)
    );

    const rows = [
      ...getByTestId('bootstrap-pvalues').querySelectorAll('tbody tr'),
    ].map((tr) => [...tr.children].map((td) => td.textContent));

    expect(rows).toEqual([
      ['Model A', 'Model B', '< 0.001 *'],
      ['Model A', 'Model C', '0.200'],
      ['Model B', 'Model C', '0.030 *'],
    ]);
  });

  it('keeps the plot and shows an inline warning if p-values fail', async () => {
    Backend.compareModelsData.mockRejectedValue(new Error('boom'));

    const { getByTestId, container } = renderHistogram();

    await wait(() =>
      expect(getByTestId('bootstrap-pvalues').textContent).toMatch(
        /Failed to fetch p-values/
      )
    );
    expect(container.querySelector('.alert-danger')).toBeNull();
  });
});
