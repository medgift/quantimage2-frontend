import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button } from 'reactstrap';
import React from 'react';

export default function UndoButton({ handleClick }) {
  return (
    <Button color="secondary" size="sm" onClick={handleClick}>
      <FontAwesomeIcon icon="arrow-left" /> Undo selection step
    </Button>
  );
}
