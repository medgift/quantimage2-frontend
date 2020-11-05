import React from 'react';
import {
  Button,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Card,
  CardHeader,
  CardBody,
} from 'reactstrap';
import './DeleteAnnotationModal.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const DeleteAnnotationModal = (props) => {
  return (
    <>
      <Modal size="lg" centered isOpen={props.show} toggle={props.toggle}>
        <ModalHeader toggle={props.toggle}>Supprimer l'annotation</ModalHeader>
        <ModalBody>
          Voulez-vous vraiment supprimer l'annotation suivante ?
          <div>
            <strong>
              <FontAwesomeIcon
                icon="exclamation-circle"
                className="text-danger mr-1"
              />
              L'opération est irréversible.
            </strong>
          </div>
          {props.annotation && (
            <Card className="my-3">
              <CardHeader>{props.annotation.title}</CardHeader>
              <CardBody>{props.annotation.text}</CardBody>
            </Card>
          )}
        </ModalBody>
        <ModalFooter>
          <Button color="danger" onClick={props.delete}>
            <FontAwesomeIcon icon="trash-alt" className="mr-2" />
            Supprimer
          </Button>{' '}
          <Button color="secondary" onClick={props.toggle}>
            Annuler
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
};

export default DeleteAnnotationModal;
