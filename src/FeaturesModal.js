import React from 'react';
import { ListGroupItem, Modal, ModalBody, ModalHeader } from 'reactstrap';
import ListGroup from 'reactstrap/es/ListGroup';
import { assembleFeatures, assembleFeatureTitles } from './utils/feature-utils';

export default function FeaturesModal({ isOpen, toggle, extraction }) {
  let getFeaturesTitle = () => {
    return assembleFeatureTitles(extraction.families);
  };

  let getFeatures = () => {
    return assembleFeatures(extraction.tasks);
  };

  return (
    <Modal isOpen={isOpen} toggle={toggle} size="lg" className="feature-modal">
      <ModalHeader toggle={toggle}>
        Extracted Features : {getFeaturesTitle()}
      </ModalHeader>
      <ModalBody>
        {
          <ListGroup className="m-1">
            {Object.keys(getFeatures()).map((key, index) => (
              <ListGroupItem key={key}>
                <div>{key}</div>
                <div className="text-muted">
                  {JSON.stringify(getFeatures()[key], null, 1)}
                </div>
              </ListGroupItem>
            ))}
          </ListGroup>
        }
      </ModalBody>
    </Modal>
  );
}
