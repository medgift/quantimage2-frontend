import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Badge, Spinner, Table } from 'reactstrap';
import { useKeycloak } from '@react-keycloak/web';

import Backend from '../services/backend';
import {
  DATA_SPLITTING_TYPES,
  MODEL_TYPES,
  OUTCOME_CLASSIFICATION,
  OUTCOME_SURVIVAL_EVENT,
  PYRADIOMICS_FEATURE_PREFIXES,
  RIESZ_FEATURE_PREFIXES,
  ZRAD_FEATURE_PREFIXES,
} from '../config/constants';

import './ExtractionSummary.css';

const CONFIG_STATUS_OK = 'ok';

const NOT_AVAILABLE = '–';
const NONE = 'none';

// Usual PyRadiomics order; other families follow alphabetically
const FAMILY_ORDER = [
  'shape',
  'firstorder',
  'glcm',
  'gldm',
  'glrlm',
  'glszm',
  'ngtdm',
];

function familyRank(family) {
  const index = FAMILY_ORDER.indexOf(family);
  return index === -1 ? FAMILY_ORDER.length : index;
}

function sortFamilies(byFamily) {
  return Object.entries(byFamily).sort(
    ([a], [b]) => familyRank(a) - familyRank(b) || a.localeCompare(b)
  );
}

export function summarizeFeatureNames(featureNames) {
  const uniqueNames = [...new Set(featureNames)];
  const byFamily = {};
  const filters = {};

  for (const name of uniqueNames) {
    let family = 'other';
    let filter = null;

    // Same grouping rules as the backend (service/extraction_summary.py)
    if (RIESZ_FEATURE_PREFIXES.some((prefix) => name.startsWith(prefix))) {
      family = 'riesz';
    } else if (
      ZRAD_FEATURE_PREFIXES.some((prefix) => name.startsWith(prefix))
    ) {
      family = 'zrad';
    } else {
      // PyRadiomics: <filter>[-<filter params>]_<family>_<feature>
      const tokens = name.split('_');
      const imageFilter = tokens[0].split('-')[0];
      if (
        PYRADIOMICS_FEATURE_PREFIXES.includes(imageFilter) &&
        tokens.length >= 3
      ) {
        family = tokens[1];
        filter = imageFilter;
      }
    }

    byFamily[family] = (byFamily[family] || 0) + 1;
    if (filter) filters[filter] = (filters[filter] || 0) + 1;
  }

  return { total: uniqueNames.length, by_family: byFamily, filters };
}

function formatSpacing(resampling) {
  if (!resampling) return NONE;
  if (!Array.isArray(resampling.spacing)) return NOT_AVAILABLE;

  return `${resampling.spacing.join(' × ')} mm`;
}

function formatDiscretization(extractors) {
  const values = extractors
    .map(({ settings = {} }) => {
      if (settings.binWidth !== undefined)
        return `bin width ${settings.binWidth}`;
      if (settings.binCount !== undefined)
        return `bin count ${settings.binCount}`;
      return null;
    })
    .filter((value) => value !== null);

  return values.length > 0 ? [...new Set(values)].join(', ') : NOT_AVAILABLE;
}

// "2026-10-01T10:00:00" -> "2026-10-01 10:00" (shown as stored, no timezone shift)
function formatDate(isoDate) {
  if (!isoDate) return NOT_AVAILABLE;

  return String(isoDate).replace('T', ' ').slice(0, 16);
}

function formatFlag(value) {
  if (value === null || value === undefined) return NOT_AVAILABLE;
  if (typeof value === 'boolean') return value ? 'yes' : 'no';

  return String(value);
}

function SummaryItem({ label, children }) {
  return (
    <div className="d-flex justify-content-between extraction-summary-item">
      <span className="text-muted">{label}</span>
      <span className="extraction-summary-value">{children}</span>
    </div>
  );
}

function SummaryCard({ title, testID, children }) {
  return (
    <div className="col-lg-4 mb-3">
      <div className="card h-100 extraction-summary-card" data-testid={testID}>
        <div className="card-header">
          <strong>{title}</strong>
        </div>
        <div className="card-body">{children}</div>
      </div>
    </div>
  );
}

function ConfigurationCard({ config }) {
  if (config.status !== CONFIG_STATUS_OK) {
    return (
      <SummaryCard title="Configuration" testID="summary-config">
        <p className="text-muted mb-0">
          Configuration not available. Use "Download Configuration" to get the
          original file.
        </p>
      </SummaryCard>
    );
  }

  const imageTypes = [
    ...new Set(
      config.modalities.flatMap((m) =>
        (m.extractors || []).flatMap((e) => e.image_types || [])
      )
    ),
  ];

  return (
    <SummaryCard title="Configuration" testID="summary-config">
      <Table size="sm" className="extraction-summary-table">
        <thead>
          <tr>
            <th>Modality</th>
            <th>Resampling</th>
            <th>Interpolation</th>
            <th>Normalization</th>
            <th>Discretization</th>
          </tr>
        </thead>
        <tbody>
          {config.modalities.map((modality) => (
            <tr key={modality.modality}>
              <td>{modality.modality}</td>
              <td>{formatSpacing(modality.resampling)}</td>
              <td>
                {(modality.resampling && modality.resampling.interpolation) ||
                  NOT_AVAILABLE}
              </td>
              <td>
                {modality.normalization ? modality.normalization.type : NONE}
              </td>
              <td>{formatDiscretization(modality.extractors || [])}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      {config.general && (
        <>
          <SummaryItem label="Padding">
            {formatFlag(config.general.padding)}
          </SummaryItem>
          <SummaryItem label="Submodalities">
            {formatFlag(config.general.submodalities)}
          </SummaryItem>
          <SummaryItem label="Combined segmentation">
            {formatFlag(config.general.combine_segmentation)}
          </SummaryItem>
        </>
      )}
      {imageTypes.length > 0 && (
        <SummaryItem label="Image types">{imageTypes.join(', ')}</SummaryItem>
      )}
    </SummaryCard>
  );
}

function FeaturesCard({ features, modalities, rois }) {
  return (
    <SummaryCard title="Features" testID="summary-features">
      <SummaryItem label="Feature types">{features.total}</SummaryItem>
      <div className="extraction-summary-subtitle text-muted">By family</div>
      <div>
        {sortFamilies(features.by_family).map(([family, count]) => (
          <Badge
            color="light"
            className="mr-1 extraction-summary-family"
            key={family}
          >
            {family} <strong>{count}</strong>
          </Badge>
        ))}
      </div>
      {/* Only informative when more than one image filter was used */}
      {Object.keys(features.filters).length > 1 && (
        <SummaryItem label="Image filters">
          {Object.entries(features.filters)
            .map(([filter, count]) => `${filter}: ${count}`)
            .join(', ')}
        </SummaryItem>
      )}
      <div className="extraction-summary-subtitle text-muted">Modalities</div>
      <div>
        {[...modalities].sort().map((modality) => (
          <Badge color="primary" className="mr-1" key={modality}>
            {modality}
          </Badge>
        ))}
      </div>
      <div className="extraction-summary-subtitle text-muted">ROIs</div>
      <div>
        {[...rois].sort().map((roi) => (
          <Badge color="primary" className="mr-1" key={roi}>
            {roi}
          </Badge>
        ))}
      </div>
    </SummaryCard>
  );
}

function outcomeCounts(labelCategory, patientIDs) {
  const included = new Set(patientIDs);
  const labels = labelCategory.labels.filter((l) => included.has(l.patient_id));

  if (labelCategory.label_type === MODEL_TYPES.SURVIVAL) {
    let events = 0;
    let censored = 0;
    for (const { label_content } of labels) {
      const event = String(label_content[OUTCOME_SURVIVAL_EVENT])
        .trim()
        .toLowerCase();
      // Numeric values may come as "1", "1.0", 1...
      const value = event === '' ? NaN : Number(event);
      if (event === 'true' || value === 1) events++;
      else if (event === 'false' || value === 0) censored++;
    }
    return { Events: events, Censored: censored };
  }

  const counts = {};
  for (const { label_content } of labels) {
    const outcome = label_content[OUTCOME_CLASSIFICATION];
    if (outcome === undefined || outcome === null || outcome === '') continue;
    counts[outcome] = (counts[outcome] || 0) + 1;
  }
  return counts;
}

// A full dataset trains on every labelled patient, no split is saved
function trainingPatientsLabel(patients, isFullDataset, nbLabelledPatients) {
  if (patients && patients.training) return patients.training.length;

  return isFullDataset ? nbLabelledPatients : 'Not set yet';
}

function testPatientsLabel(patients, isFullDataset) {
  if (patients && patients.test) return patients.test.length;

  return isFullDataset ? 'None (full dataset)' : 'Not set yet';
}

function DatasetCard({
  dataset,
  allPatients,
  unlabelledPatients,
  selectedLabelCategory,
  patients,
  dataSplittingType,
  trainTestSplitType,
  createdAt,
  isCollection,
}) {
  const unlabelled = unlabelledPatients || [];
  const labelledPatients = (allPatients || []).filter(
    (p) => !unlabelled.includes(p)
  );

  const isFullDataset = dataSplittingType === DATA_SPLITTING_TYPES.FULL_DATASET;

  const outcomes = selectedLabelCategory
    ? outcomeCounts(selectedLabelCategory, labelledPatients)
    : {};
  const outcomesTotal = Object.values(outcomes).reduce((a, b) => a + b, 0);

  return (
    <SummaryCard title="Dataset" testID="summary-dataset">
      <SummaryItem
        label={isCollection ? 'Collection created on' : 'Extracted on'}
      >
        {formatDate(createdAt)}
      </SummaryItem>
      <SummaryItem label="Patients">
        {allPatients ? allPatients.length : NOT_AVAILABLE}
      </SummaryItem>
      {/* One study per patient is the usual case: only show studies when the
          counts differ (several studies per patient, or failed studies) */}
      {(!allPatients || allPatients.length !== dataset.studies) && (
        <SummaryItem label="Studies">{dataset.studies}</SummaryItem>
      )}
      {selectedLabelCategory ? (
        <>
          <SummaryItem label="Outcome">
            {selectedLabelCategory.name}
            {selectedLabelCategory.name.toLowerCase() !==
              selectedLabelCategory.label_type.toLowerCase() &&
              ` (${selectedLabelCategory.label_type})`}
          </SummaryItem>
          <ul className="extraction-summary-list">
            {Object.entries(outcomes).map(([name, count]) => (
              <li key={name}>
                {name}: {count}
                {outcomesTotal > 0 &&
                  ` (${Math.round((100 * count) / outcomesTotal)}%)`}
              </li>
            ))}
          </ul>
          <SummaryItem label="Unlabelled patients">
            {unlabelledPatients ? unlabelled.length : NOT_AVAILABLE}
          </SummaryItem>
        </>
      ) : (
        <SummaryItem label="Outcome">None selected</SummaryItem>
      )}
      <SummaryItem label="Data splitting">
        {isFullDataset
          ? 'Full dataset'
          : `Train/test${trainTestSplitType ? ` (${trainTestSplitType})` : ''}`}
      </SummaryItem>
      <SummaryItem label="Training patients">
        {trainingPatientsLabel(
          patients,
          isFullDataset,
          allPatients ? labelledPatients.length : NOT_AVAILABLE
        )}
      </SummaryItem>
      <SummaryItem label="Test patients">
        {testPatientsLabel(patients, isFullDataset)}
      </SummaryItem>
    </SummaryCard>
  );
}

export default function ExtractionSummary({
  extractionID,
  patients,
  allPatients,
  unlabelledPatients,
  selectedLabelCategory,
  featureNames,
  modalities,
  rois,
  dataSplittingType,
  trainTestSplitType,
  createdAt,
  isCollection,
}) {
  const { keycloak } = useKeycloak();

  // Read the token through a ref so that a token refresh doesn't refetch
  const tokenRef = useRef(keycloak.token);
  tokenRef.current = keycloak.token;

  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchSummary() {
      setSummary(null);
      setError(null);
      try {
        const result = await Backend.extractionSummary(
          tokenRef.current,
          extractionID
        );
        if (!cancelled) setSummary(result);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    }

    if (extractionID) fetchSummary();

    return () => {
      cancelled = true;
    };
  }, [extractionID]);

  // In a collection, the features come from the collection, not the extraction
  const features = useMemo(() => {
    if (!summary) return null;

    return featureNames
      ? summarizeFeatureNames(featureNames)
      : summary.features;
  }, [summary, featureNames]);

  if (error) {
    return (
      <Alert color="danger" className="mt-3">
        Could not load the extraction summary: {error}
      </Alert>
    );
  }

  if (!summary) {
    return (
      <div className="text-center mt-3">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="row mt-3 extraction-summary">
      <ConfigurationCard config={summary.config} />
      <FeaturesCard
        features={features}
        modalities={modalities || summary.features.modalities}
        rois={rois || summary.features.rois}
      />
      <DatasetCard
        dataset={summary.dataset}
        allPatients={allPatients}
        unlabelledPatients={unlabelledPatients}
        selectedLabelCategory={selectedLabelCategory}
        patients={patients}
        createdAt={createdAt || summary.created_at}
        isCollection={isCollection}
        // The page's split types follow edits made in this session
        dataSplittingType={
          dataSplittingType || summary.dataset.data_splitting_type
        }
        trainTestSplitType={
          trainTestSplitType || summary.dataset.train_test_split_type
        }
      />
    </div>
  );
}
