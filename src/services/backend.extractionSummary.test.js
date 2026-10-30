import Backend from './backend';

// Jest 27 cannot resolve csv-parse's package "exports" ("csv-parse/sync"),
// which src/utils/feature-utils.js imports transitively through
// config/constants. It is not used by the code under test here.
jest.mock('csv-parse/sync', () => ({ parse: jest.fn() }), { virtual: true });

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

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 404 ? 'NOT FOUND' : 'OK',
    json: () => Promise.resolve(body),
  };
}

describe('Backend.extractionSummary', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('GETs /extractions/<id>/summary with the bearer token and returns the JSON', async () => {
    global.fetch = jest.fn(() => Promise.resolve(jsonResponse(200, SUMMARY)));

    const result = await Backend.extractionSummary('tok', 42);

    expect(result).toEqual(SUMMARY);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toMatch(/\/extractions\/42\/summary$/);
    expect((options.method || 'GET').toUpperCase()).toBe('GET');
    expect(options.headers.get('Authorization')).toBe('Bearer tok');
  });

  it('throws an Error with the backend message on a non-2xx response', async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve(
        jsonResponse(404, { error: 'Feature extraction not found' })
      )
    );

    await expect(Backend.extractionSummary('tok', 999)).rejects.toThrow(
      'Feature extraction not found'
    );
  });
});
