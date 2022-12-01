import React from 'react';

import { Alert } from 'reactstrap';

export function UnlabelledPatientsTitle({ unlabelledPatients, dataPoints }) {
  if (unlabelledPatients === null || unlabelledPatients.length === 0)
    return null;

  return (
    <Alert color={dataPoints.length === 0 ? 'danger' : 'warning'}>
      <span>
        {unlabelledPatients.length > 1 ? 'There are ' : 'There is '}
        <strong>
          {unlabelledPatients.length} unlabelled{' '}
          {unlabelledPatients.length > 1 ? 'patients' : 'patient'}
        </strong>{' '}
        ! These patients will be excluded from all steps (Training/Test Split,
        Visualization & Model Training)
      </span>
    </Alert>
  );
}
