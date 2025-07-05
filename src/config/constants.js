import { DateTime } from 'luxon';
import { formatMetric } from '../utils/feature-utils';

export const DICOM_DATE_FORMAT = 'DD.MM.YYYY';
export const DB_DATE_FORMAT = 'DD.MM.YYYY HH:mm';

export const FEATURE_STATUS = {
  NOT_COMPUTED: 'PENDING',
  IN_PROGRESS: 'PROGRESS',
  COMPLETE: 'SUCCESS',
  FAILURE: 'FAILURE',
  properties: {
    PENDING: { name: 'Not Computed' },
    PROGRESS: { name: 'In Progress' },
    SUCCESS: { name: 'Complete' },
  },
};

export const ZRAD_FEATURE_PREFIXES = ['zrad'];
export const RIESZ_FEATURE_PREFIXES = ['tex'];
export const PYRADIOMICS_FEATURE_PREFIXES = [
  'original',
  'log',
  'wavelet',
  'gradient',
  'square',
  'squareroot',
  'exponential',
  'logarithm',
];
export const ZRAD_GROUP_PREFIXES = ['ZRad'];

export const MODEL_TYPES = {
  CLASSIFICATION: 'Classification',
  SURVIVAL: 'Survival',
};

export const DATA_SPLITTING_TYPES = {
  FULL_DATASET: 'fulldataset',
  TRAIN_TEST_SPLIT: 'traintest',
};

export const TRAIN_TEST_SPLIT_TYPES = {
  AUTO: 'automatic',
  MANUAL: 'manual',
};

export const PATIENT_FIELDS = {
  TRAINING: 'training_patients',
  TEST: 'test_patients',
};

export const DATA_SPLITTING_DEFAULT_TRAINING_SPLIT = 0.8;

export const OUTCOME_CLASSIFICATION = 'Outcome';
export const OUTCOME_SURVIVAL_EVENT = 'Event';
export const OUTCOME_SURVIVAL_TIME = 'Time';

export const CLASSIFICATION_OUTCOMES = [OUTCOME_CLASSIFICATION];
export const SURVIVAL_OUTCOMES = [
  OUTCOME_SURVIVAL_TIME,
  OUTCOME_SURVIVAL_EVENT,
];

export const SOCKETIO_MESSAGES = {
  CONNECT: 'connect',
  EXTRACTION_STATUS: 'extraction-status',
  FEATURE_STATUS: 'feature-status',
  TRAINING_STATUS: 'training-status',
};

export const TRAINING_PHASES = {
  TRAINING: 'training',
  TESTING: 'testing',
};

export const CLINICAL_FEATURE_FIELDS = {
  NAME: 'name',
  TYPE: 'feat_type',
  ENCODING: 'encoding',
  MISSING_VALUES: 'missing_values',
};
export const CLINICAL_FEATURE_TYPES = {
  NUMBER: 'Number',
  CATEGORICAL: 'Categorical',
};
export const CLINICAL_FEATURE_ENCODING = {
  NONE: 'None',
  ONE_HOT_ENCODING: 'One-Hot Encoding',
  NORMALIZATION: 'Normalization',
  ORDERED_CATEGORIES: 'Ordered Categories',
};

export const CLINICAL_FEATURE_MISSING_VALUES = {
  DROP: 'Drop',
  MODE: 'Mode',
  MEDIAN: 'Median',
  MEAN: 'Mean',
  NONE: 'None',
};

export const CV_SPLITS = 5;

export const MODEL_COLUMNS = [
  {
    Header: 'Date created',
    accessor: (r) =>
      DateTime.fromJSDate(new Date(r.created_at)).toFormat(
        'yyyy-MM-dd HH:mm:ss'
      ),
    sortDescFirst: true,
    id: 'created_at',
  },
  { Header: 'Outcome', accessor: 'label_category' },
  { Header: 'Best Algorithm', accessor: 'best_algorithm' },
  {
    Header: 'Model Validation',
    accessor: (r) => {
      let isTrainTest =
        r.data_splitting_type === DATA_SPLITTING_TYPES.TRAIN_TEST_SPLIT;

      if (isTrainTest) {
        let trainingProportion =
          (r.training_patient_ids.length /
            (r.training_patient_ids.length + r.test_patient_ids.length)) *
          100;
        let testProportion = 100 - trainingProportion;

        return `Training/Test split (${Math.round(
          trainingProportion
        )}%/${Math.round(testProportion)}%)`;
      } else {
        return 'Cross-validation (Full Dataset)';
      }
    },
  },
];

export const CLASSIFICATION_COLUMNS = [
  ...MODEL_COLUMNS,
  {
    Header: 'Test AUC (bootstrap)',
    accessor: (r) =>
      r.test_metrics ? formatMetric(r.test_metrics.auc) : 'N/A',
    sortDescFirst: true,
    sortType: (r1, r2) => {
      if (!r1.original.test_metrics) return -1;
      if (!r2.original.test_metrics) return 1;

      return (
        +r1.original.test_metrics.auc.mean - +r2.original.test_metrics.auc.mean
      );
    },
  },
];

export const SURVIVAL_COLUMNS = [
  ...MODEL_COLUMNS,
  {
    Header: 'Training c-index (cross-validation)',
    accessor: (r) => formatMetric(r.training_metrics['c-index']),
    sortDescFirst: true,
    sortType: (r1, r2) =>
      +r1.original.training_metrics['c-index'].mean -
      +r2.original.training_metrics['c-index'].mean,
  },
  {
    Header: 'Test c-index (bootstrap)',
    accessor: (r) =>
      r.test_metrics ? formatMetric(r.test_metrics['c-index']) : 'N/A',
    sortDescFirst: true,
    sortType: (r1, r2) => {
      if (!r1.original.test_metrics || !r2.original.test_metrics) return 1;

      return (
        +r1.original.test_metrics['c-index'].mean -
        +r2.original.test_metrics['c-index'].mean
      );
    },
  },
];

export const KEYCLOAK_RESOURCE_ACCESS = 'resource_access';
export const KEYCLOAK_ADMIN_ROLE = 'admin';
