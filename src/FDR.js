import React, { useCallback, useContext, useEffect, useState } from 'react';
import { Alert, Button, ListGroup, ListGroupItem } from 'reactstrap';

import { useKeycloak } from '@react-keycloak/web';

import { FDR_PHASES } from './config/constants';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export default function Fdr() {
  let { keycloak } = useKeycloak();

  let [isCorrectingFDR, setIsCorrectingFDR] = useState(false);
  let [currentPhase, setCurrentPhase] = useState(FDR_PHASES.CORRECTING);

  let handleFdrCorrectionClick = async () => {
    setIsCorrectingFDR(true);
  };

  let fdrCorrectionButton = () => {
    let buttonText = !isCorrectingFDR
      ? 'Apply FDR correction'
      : currentPhase === FDR_PHASES.PENDING
      ? 'FDR Pending'
      : 'FDR Correcting';

    if (isCorrectingFDR) buttonText += '...';

    return (
      <Button
        color="info"
        onClick={handleFdrCorrectionClick}
        disabled={isCorrectingFDR}
      >
        <>
          {isCorrectingFDR && (
            <>
              <FontAwesomeIcon icon="spinner" spin />{' '}
            </>
          )}
          <span>{buttonText}</span>
        </>
      </Button>
    );
  };

  let newFdrForm = () => (
    <div>
      <h3>FDR</h3>
      {fdrCorrectionButton()}
    </div>
  );
  return newFdrForm();
}
