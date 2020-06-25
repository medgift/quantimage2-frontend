import React, { useState, useEffect, useContext } from 'react';
import {
  Alert,
  Button,
  ButtonGroup,
  Collapse,
  ListGroup,
  ListGroupItem,
  ListGroupItemHeading,
  ListGroupItemText
} from 'reactstrap';
import { FEATURE_STATUS } from '../config/constants';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import Backend from '../services/backend';
import FeaturesModal from '../FeaturesModal';
import { useKeycloak } from 'react-keycloak';
import SocketContext from '../context/SocketContext';
import { cloneDeep } from 'lodash';
import Kheops from '../services/kheops';

export default function FeatureNames({ names }) {
  return (
    <ListGroup>
      {names.map(name => (
        <ListGroupItem key={name}>{name}</ListGroupItem>
      ))}
    </ListGroup>
  );
}
