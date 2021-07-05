import React, { useEffect, useState } from 'react';
import { ListGroupItem, Modal, ModalBody, ModalHeader } from 'reactstrap';
import ListGroup from 'reactstrap/es/ListGroup';
import Kheops from './services/kheops';
import Backend from './services/backend';
import { assembleFeatures } from './utils/feature-utils';
import { useKeycloak } from 'react-keycloak';
import _ from 'lodash';

export default function FeaturesModal({
  isOpen,
  toggle,
  extractionID,
  studyUID,
}) {
  let [keycloak] = useKeycloak();

  let [features, setFeatures] = useState(null);

  useEffect(() => {
    async function getFeatures() {
      let extraction = await Backend.extraction(keycloak.token, extractionID);
      let study = await Kheops.study(keycloak.token, studyUID);
      setFeatures(assembleFeatures(extraction, study));
    }

    if (isOpen) getFeatures();
  }, [keycloak, studyUID, extractionID, isOpen]);

  return (
    <Modal isOpen={isOpen} toggle={toggle} size="lg" className="feature-modal">
      <ModalHeader toggle={toggle}>Extracted Features</ModalHeader>
      <ModalBody>
        {features && (
          <ListGroup className="m-1">
            {Object.keys(features).map((key, index) => (
              <ListGroupItem key={key}>
                <div>
                  <strong>{key}</strong>
                </div>
                {!_.isPlainObject(features[key]) ? (
                  <div className="text-muted">
                    {JSON.stringify(features[key], null, 1)}
                  </div>
                ) : (
                  Object.keys(features[key]).map((label, idx) => (
                    <React.Fragment key={`${key}-${label}`}>
                      <div>{label}</div>
                      <ListGroup className="m-1">
                        {Object.keys(features[key][label]).map(
                          (featureName, index) => (
                            <ListGroupItem
                              key={`${key}-${label}-${featureName}`}
                            >
                              <div>
                                <strong>{featureName}</strong>
                              </div>
                              <div className="text-muted">
                                {JSON.stringify(
                                  features[key][label][featureName],
                                  null,
                                  1
                                )}
                              </div>
                            </ListGroupItem>
                          )
                        )}
                      </ListGroup>
                    </React.Fragment>
                  ))
                )}
              </ListGroupItem>
            ))}
          </ListGroup>
        )}
      </ModalBody>
    </Modal>
  );
}
