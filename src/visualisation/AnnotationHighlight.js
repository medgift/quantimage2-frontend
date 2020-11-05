import React, { useState } from 'react';
import { Tooltip } from 'reactstrap';
import './AnnotationHighlight.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const AnnotationHighlight = (props) => {
  const [tooltipOpen, setTooltipOpen] = useState(false);

  const toggle = () => setTooltipOpen(!tooltipOpen);

  return (
    <>
      <FontAwesomeIcon
        icon="highlighter"
        className="text-success"
        id="highlight"
      />
      <Tooltip
        innerClassName="annotation-highlight"
        target="highlight"
        placement="right"
        isOpen={tooltipOpen}
        toggle={toggle}
      >
        Annotation manuelle
      </Tooltip>
    </>
  );
};

export default AnnotationHighlight;
