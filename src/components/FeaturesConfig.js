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

export default function FeaturesConfig({ families }) {
  return (
    <>
      {families.map(family => (
        <div key={family.feature_family.id}>
          <h3>{family.feature_family.name}</h3>
          <ListGroup>
            {Object.keys(family.config.backends).map(
              backendName =>
                family.config.backends[backendName].features.length > 0 && (
                  <ListGroupItem
                    key={`${family.feature_family.name}-${backendName}`}
                  >
                    <>
                      <h5>{backendName}</h5>
                      <div>
                        <ListGroup>
                          {family.config.backends[backendName].features.map(
                            featureGroup => (
                              <ListGroupItem
                                key={`${family.feature_family.name}-${backendName}-${featureGroup}`}
                              >
                                {featureGroup}
                              </ListGroupItem>
                            )
                          )}
                        </ListGroup>
                      </div>
                    </>
                  </ListGroupItem>
                )
            )}
          </ListGroup>
        </div>
      ))}
    </>
  );
}
