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

export const KEYCLOAK_RESOURCE_ACCESS = 'resource_access';
export const KEYCLOAK_FRONTEND_CLIENT_ID = 'imagine-frontend';
export const KEYCLOAK_ADMIN_ROLE = 'admin';
