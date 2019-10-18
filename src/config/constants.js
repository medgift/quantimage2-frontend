export const DICOM_DATE_FORMAT = 'DD.MM.YYYY';
export const DB_DATE_FORMAT = 'DD.MM.YYYY HH:mm';

export const FEATURE_STATUS = {
  NOT_COMPUTED: 'PENDING',
  STARTED: 'STARTED',
  IN_PROGRESS: 'PROGRESS',
  COMPLETE: 'SUCCESS',
  FAILURE: 'FAILURE',
  properties: {
    PENDING: { name: 'Not Computed' },
    STARTED: { name: 'Starting' },
    PROGRESS: { name: 'In Progress' },
    SUCCESS: { name: 'Complete' }
  }
};

export const KEYCLOAK_RESOURCE_ACCESS = 'resource_access';
export const KEYCLOAK_FRONTEND_CLIENT_ID = 'imagine-frontend';
export const KEYCLOAK_ADMIN_ROLE = 'admin';
