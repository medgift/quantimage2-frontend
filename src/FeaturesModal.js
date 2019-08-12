import React from 'react';
import { ListGroupItem, Modal, ModalBody, ModalHeader } from 'reactstrap';
import ListGroup from 'reactstrap/es/ListGroup';

export default function FeaturesModal({ isOpen, toggle, feature }) {
  return (
    <Modal isOpen={isOpen} toggle={toggle} size="lg" className="feature-modal">
      <ModalHeader toggle={toggle}>
        Computed "{feature.name}" Features
      </ModalHeader>
      <ModalBody>
        <ListGroup className="m-1">
          {Object.keys(feature.payload).map((key, index) => (
            <ListGroupItem key={index}>
              <div>{key}</div>
              <div className="text-muted">
                {JSON.stringify(feature.payload[key], null, 1)}
              </div>
            </ListGroupItem>
          ))}
        </ListGroup>
      </ModalBody>
    </Modal>
  );
}
