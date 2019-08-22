export const DICOM_DATE_FORMAT = 'DD.MM.YYYY';
export const DB_DATE_FORMAT = 'DD.MM.YYYY HH:mm';

export const FEATURE_STATUS = {
  NOT_COMPUTED: 'PENDING',
  STARTED: 'STARTED',
  IN_PROGRESS: 'PROGRESS',
  COMPLETE: 'SUCCESS',
  properties: {
    PENDING: { name: 'Not Computed' },
    STARTED: { name: 'Starting' },
    PROGRESS: { name: 'In Progress' },
    SUCCESS: { name: 'Complete' }
  }
};
