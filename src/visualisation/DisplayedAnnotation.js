import React, { useEffect, useState } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  ButtonGroup,
  Badge,
} from 'reactstrap';
import './DisplayedAnnotation.scss';
import useDynamicRefs from 'use-dynamic-refs';
import moment from 'moment';
import CanvasDraw from 'react-canvas-draw';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const DisplayedAnnotation = (props) => {
  const [getRef, setRef] = useDynamicRefs();

  const [imageDimensions, setImageDimensions] = useState(null);

  useEffect(() => {
    async function getImagesDimensions() {
      let imageDimensions = [];
      for (let image of props.images) {
        let imageSize = await getImageDimensions(image.img);
        console.log('image size', imageSize);
        imageDimensions.push(imageSize);
      }

      setImageDimensions(imageDimensions);
    }

    getImagesDimensions();
  }, [props.images]);

  useEffect(() => {
    if (props.annotation && props.annotation.lines) {
      setTimeout(() => {
        JSON.parse(props.annotation.lines).map((l) => {
          redraw(l);
        });
      }, 200);
    }
  }, [props.annotation]);

  const redraw = (line) => {
    getRef(line.id + '-canvas').current.loadSaveData(line.lines, true);
  };

  const deleteAnnotation = () => {
    props.delete();
  };

  const editAnnotation = () => {
    props.edit();
  };

  const answerAnnotation = () => {
    props.answer();
  };

  const date = moment(props.annotation.date).format('D.MM.YYYY à hh:mm:ss');

  return (
    <>
      <div className="text-left displayed-annotation">
        <Card className="mb-4">
          <CardHeader>
            <div className="d-flex justify-content-between">
              <h3>{props.annotation.title}</h3>
              <div>
                {props.annotation.answers && (
                  <Badge
                    color={
                      props.annotation.answers.length > 0
                        ? 'warning'
                        : 'secondary'
                    }
                    className="mr-2"
                  >
                    {props.annotation.answers.length}{' '}
                    {props.annotation.answers.length > 1
                      ? 'réponses'
                      : 'réponse'}
                  </Badge>
                )}
                <ButtonGroup className="mr-2">
                  {
                    /* Check if user owns the annotation or if is admin */
                    <>
                      <Button color="danger" onClick={() => deleteAnnotation()}>
                        <FontAwesomeIcon icon="trash-alt" />
                      </Button>
                      <Button color="dark" onClick={() => editAnnotation()}>
                        <FontAwesomeIcon icon="edit" />
                      </Button>
                    </>
                  }
                  {props.annotation.answers && (
                    <Button color="primary" onClick={() => answerAnnotation()}>
                      <FontAwesomeIcon icon="reply" /> Répondre
                    </Button>
                  )}
                </ButtonGroup>
                <Button color="info" onClick={props.close}>
                  <FontAwesomeIcon icon="times" className="mr-1 mb-1" />
                  Fermer
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardBody>
            <div className="text-right mb-4">
              <span className="text-muted">
                Posté par
                <span className="text-danger">
                  <FontAwesomeIcon icon="user" className="ml-2 mr-1" />
                  {props.annotation.user}
                </span>
                , le {date}
              </span>
            </div>
            <p>{props.annotation.text}</p>
          </CardBody>
        </Card>
        {props.images.length > 0 &&
          imageDimensions &&
          props.images.map((image, index) => {
            return (
              <CanvasDraw
                key={index}
                ref={setRef(image.id + '-canvas')}
                imgSrc={image.img}
                disabled
                className="mx-auto"
                style={{
                  width: imageDimensions[index].w,
                  height: imageDimensions[index].h,
                }}
              />
            );
          })}
      </div>
    </>
  );
};

async function getImageDimensions(imageData) {
  return new Promise(function (resolved, rejected) {
    var i = new Image();
    i.onload = function () {
      resolved({ w: i.width, h: i.height });
    };
    i.src = imageData;
  });
}

export default DisplayedAnnotation;
