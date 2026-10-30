import {
  buildFeatureTree,
  formatFeatureColumn,
  formatFeatureLabel,
  formatFeatureLabels,
  formatFeatureShortLabel,
  parseFeatureID,
} from './feature-label';

// Jest 27 cannot resolve csv-parse's package "exports" ("csv-parse/sync"),
// imported transitively through config/constants
jest.mock('csv-parse/sync', () => ({ parse: jest.fn() }), { virtual: true });

const S = '‑'; // FEATURE_ID_SEPARATOR (non-breaking hyphen)
const id = (modality, roi, name) => `${modality}${S}${roi}${S}${name}`;

describe('formatFeatureLabel', () => {
  it.each([
    [id('CT', ' GTVn', 'original_glcm_Id'), 'CT › GTVn › Texture › GLCM › Id'],
    [
      id('CT', 'GTVp', 'original_shape_Sphericity'),
      'CT › GTVp › Shape › Sphericity',
    ],
    [
      id('CT', 'GTVp', 'original_firstorder_Mean'),
      'CT › GTVp › Intensity › Mean',
    ],
    // PET intensity is called SUV, like in the Feature Selection tree
    [id('PT', 'GTVp', 'original_firstorder_Mean'), 'PT › GTVp › SUV › Mean'],
    [
      id('PT', 'GTVp', 'original_glrlm_GrayLevelNonUniformity'),
      'PT › GTVp › Texture › GLRLM › GrayLevelNonUniformity',
    ],
    // ROI names may contain regular hyphens
    [
      id('CT', 'GTV-T', 'original_glszm_ZoneEntropy'),
      'CT › GTV-T › Texture › GLSZM › ZoneEntropy',
    ],
  ])('%s -> %s', (featureID, label) => {
    expect(formatFeatureLabel(featureID)).toBe(label);
  });

  it('never shows the "original" image type', () => {
    expect(
      formatFeatureLabel(id('CT', 'GTVp', 'original_glcm_Id'))
    ).not.toMatch(/original/);
  });

  it('keeps the filter of legacy filtered features so labels stay unique', () => {
    expect(
      formatFeatureLabel(
        id('CT', 'GTVp', 'log-sigma-1-0-mm-3D_firstorder_Mean')
      )
    ).toBe('CT › GTVp › LoG σ=1.0 mm › Intensity › Mean');
    expect(
      formatFeatureLabel(id('CT', 'GTVp', 'wavelet-LLH_glcm_Contrast'))
    ).toBe('CT › GTVp › Wavelet LLH › Texture › GLCM › Contrast');
  });

  it('labels legacy Riesz and ZRad features', () => {
    expect(formatFeatureLabel(id('CT', 'GTVp', 'tex_sig1_energy'))).toBe(
      'CT › GTVp › Texture › Riesz › sig1_energy'
    );
    expect(formatFeatureLabel(id('CT', 'GTVp', 'zrad_GLCM_Contrast'))).toBe(
      'CT › GTVp › ZRad › GLCM_Contrast'
    );
  });

  it('labels clinical features', () => {
    expect(formatFeatureLabel('2::Weight')).toBe('Clinical › Weight');
    expect(formatFeatureLabel('2::Tobacco_1')).toBe('Clinical › Tobacco_1');
    // Legacy clinical IDs are bare column names
    expect(formatFeatureLabel('Age')).toBe('Clinical › Age');
  });

  it('falls back to the raw name for unknown feature names', () => {
    expect(formatFeatureLabel(id('CT', 'GTVp', 'PatientAge'))).toBe(
      'CT › GTVp › PatientAge'
    );
  });
});

describe('formatFeatureLabels', () => {
  it('tells apart clinical columns with the same name in two files', () => {
    expect(formatFeatureLabels(['2::Weight', '3::Weight', '2::Age'])).toEqual([
      'Clinical › Weight (file 2)',
      'Clinical › Weight (file 3)',
      'Clinical › Age',
    ]);
  });
});

describe('parseFeatureID', () => {
  it('trims modality and ROI and exposes the feature description', () => {
    const parsed = parseFeatureID(
      id('CT', ' GTVn', 'original_firstorder_Mean')
    );

    expect(parsed).toMatchObject({
      clinical: false,
      modality: 'CT',
      roi: 'GTVn',
      filter: null,
      category: 'Intensity',
      name: 'Mean',
    });
    expect(parsed.description).toBe('The mean gray level');
  });
});

describe('buildFeatureTree', () => {
  it('groups by modality › ROI, then Shape / Intensity / Texture › family', () => {
    const tree = buildFeatureTree([
      id('PT', 'GTVp', 'original_glcm_Id'),
      id('CT', 'GTVp', 'original_glcm_Idm'),
      id('CT', 'GTVp', 'original_glcm_Id'),
      id('CT', 'GTVp', 'original_glrlm_RunEntropy'),
      id('CT', 'GTVp', 'original_firstorder_Mean'),
      id('CT', 'GTVp', 'original_shape_Sphericity'),
      id('CT', 'GTVp', 'original_shape_Sphericity'), // duplicate ID
      '2::Weight',
    ]);

    expect(tree.map((g) => [g.name, g.total])).toEqual([
      ['CT › GTVp', 5],
      ['PT › GTVp', 1],
      ['Clinical', 1],
    ]);

    const ct = tree[0];
    expect(ct.categories.map((c) => [c.name, c.total])).toEqual([
      ['Shape', 1],
      ['Intensity', 1],
      ['Texture', 3],
    ]);
    expect(ct.categories[0].features.map((f) => f.name)).toEqual([
      'Sphericity',
    ]);

    const texture = ct.categories[2];
    expect(texture.features).toEqual([]);
    expect(
      texture.subcategories.map((s) => [s.name, s.features.map((f) => f.name)])
    ).toEqual([
      ['GLCM', ['Id', 'Idm']],
      ['GLRLM', ['RunEntropy']],
    ]);
  });

  it('uses SUV for PET intensity', () => {
    const [pt] = buildFeatureTree([
      id('PT', 'GTVp', 'original_firstorder_Mean'),
    ]);

    expect(pt.categories.map((c) => c.name)).toEqual(['SUV']);
  });
});

describe('formatFeatureShortLabel', () => {
  it('drops modality and ROI', () => {
    expect(
      formatFeatureShortLabel(id('PT', 'GTVp', 'original_firstorder_Mean'))
    ).toBe('SUV › Mean');
    expect(formatFeatureShortLabel(id('CT', 'GTVn', 'original_glcm_Id'))).toBe(
      'Texture › GLCM › Id'
    );
    expect(formatFeatureShortLabel('2::Weight')).toBe('Clinical › Weight');
  });
});

describe('formatFeatureColumn', () => {
  it('groups by category and family without the "original" image type', () => {
    expect(formatFeatureColumn('original_glcm_Id', ['CT'])).toEqual({
      group: 'Texture › GLCM',
      name: 'Id',
    });
    expect(formatFeatureColumn('original_shape_Sphericity', ['CT'])).toEqual({
      group: 'Shape',
      name: 'Sphericity',
    });
  });

  it('names intensity after the modalities present', () => {
    expect(formatFeatureColumn('original_firstorder_Mean', ['CT']).group).toBe(
      'Intensity'
    );
    expect(formatFeatureColumn('original_firstorder_Mean', ['PT']).group).toBe(
      'SUV'
    );
    expect(
      formatFeatureColumn('original_firstorder_Mean', ['CT', 'PT']).group
    ).toBe('Intensity/SUV');
  });

  it('keeps legacy filters and unknown names', () => {
    expect(formatFeatureColumn('wavelet-LLH_glcm_Contrast', ['CT']).group).toBe(
      'Wavelet LLH › Texture › GLCM'
    );
    expect(formatFeatureColumn('PatientAge', ['CT'])).toEqual({
      group: 'Other',
      name: 'PatientAge',
    });
  });
});
