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
export const PET_SPECIFIC_PREFIXES = ['PET'];

export const MODEL_TYPES = {
  CLASSIFICATION: 'Classification',
  SURVIVAL: 'Survival',
};

export const VALIDATION_TYPES = {
  CROSSVALIDATION: 'crossvalidation',
  TRAINTEST: 'traintest',
};

export const OUTCOME_CLASSIFICATION = 'Outcome';
export const OUTCOME_SURVIVAL_EVENT = 'Event';
export const OUTCOME_SURVIVAL_TIME = 'Time';

export const CLASSIFICATION_OUTCOMES = [OUTCOME_CLASSIFICATION];
export const SURVIVAL_OUTCOMES = [
  OUTCOME_SURVIVAL_TIME,
  OUTCOME_SURVIVAL_EVENT,
];

export const KEYCLOAK_RESOURCE_ACCESS = 'resource_access';
export const KEYCLOAK_FRONTEND_CLIENT_ID = 'imagine-frontend';
export const KEYCLOAK_ADMIN_ROLE = 'admin';
