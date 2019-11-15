import React from 'react';
import { UncontrolledAlert } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const AlertTemplate = ({ message, options, style, close }) => {
  let icon;
  let color = options.type;
  switch (options.type) {
    case 'success':
      icon = 'check-circle';
      break;
    case 'error':
      icon = 'exclamation-circle';
      color = 'danger';
      break;
    default:
      icon = 'info-circle';
  }

  return (
    <UncontrolledAlert color={color}>
      <FontAwesomeIcon icon={icon} /> <span>{message}</span>
    </UncontrolledAlert>
  );
};

export default AlertTemplate;
