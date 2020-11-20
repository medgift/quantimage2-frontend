import React, { useState, useEffect } from 'react';
import {
  Button,
  ButtonGroup,
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Input,
  Label,
  Form,
  FormGroup,
  FormFeedback,
} from 'reactstrap';
import { Formik, withFormik } from 'formik';
import * as Yup from 'yup';
import './AddAnnotationModal.scss';
import ChartAnnotationCanvas from './ChartAnnotationCanvas';
import useDynamicRefs from 'use-dynamic-refs';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const AddAnnotationModal = ({ annotation, ...props }) => {
  const [getRef, setRef] = useDynamicRefs();
  const [images, setImages] = useState([]);

  /*useEffect(() => {
    if (props.annotation) {
      props.setFieldValue('title', props.annotation.title);
      props.setFieldValue('text', props.annotation.text);
      if (props.annotation.lines) {
        props.setFieldValue('lines', props.annotation.lines);
        setTimeout(() => {
          JSON.parse(props.annotation.lines).map((l) => {
            redraw(l);
          });
        }, 200);
      }
    }
  }, [props.annotation]);*/

  /*useEffect(() => {
    const tImages = [];
    props.chartsImg.map((i) => {
      convertURIToImageData(i.img).then((img) => {
        img.id = i.id;
        img.raw = i.img;
        tImages.push(img);
        setTimeout(() => {
          setImages(tImages);
        }, 100);
      });
    });
    console.log(images);
  }, [props.show]);*/

  const toggle = () => {
    props.toggle();
  };

  const getLines = (setFieldValue) => {
    const lines = [];
    images.map((i) => {
      let line = getRef(i.id).current.getSaveData();
      if (JSON.parse(line).lines.length === 0) line = null;
      lines.push({
        id: i.id,
        lines: line,
      });
    });
    setFieldValue('lines', JSON.stringify(lines));
  };

  const redraw = (line) => {
    getRef(line.id).current.loadSaveData(line.lines, true);
  };

  const clearAll = () => {
    images.map((i) => {
      getRef(i.id).current.clear();
    });
  };

  const convertURIToImageData = (URI) => {
    return new Promise((resolve, reject) => {
      if (URI == null) return reject();
      const canvas = document.createElement('canvas'),
        context = canvas.getContext('2d'),
        image = new Image();
      image.addEventListener(
        'load',
        () => {
          canvas.width = image.width;
          canvas.height = image.height;
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(context.getImageData(0, 0, canvas.width, canvas.height));
        },
        false
      );
      image.src = URI;
    });
  };

  return (
    <>
      <Modal
        id="annotModal"
        size="lg"
        centered
        isOpen={props.show}
        toggle={toggle}
      >
        <Formik
          initialValues={
            annotation
              ? {
                  title: annotation.title,
                  text: annotation.text,
                  lines: annotation.lines,
                }
              : { title: '', text: '', lines: null }
          }
          validationSchema={() =>
            Yup.object().shape({
              title: Yup.string()
                .min(5, 'The title should have at least 5 characters.')
                .max(30, 'The title should have at most 30 characters.')
                .required('A title is required.'),
              text: Yup.string().required(
                'Please input more details about your annotation.'
              ),
            })
          }
          onSubmit={async (values, actions) => {
            console.log('submitting!');

            getLines(actions.setFieldValue);
            //await handleSubmit(props.values, props);
            await props.save(
              values.title,
              values.text,
              values.lines,
              props.parentId
            );
            actions.validateForm().then(async (errors) => {
              if (Object.keys(errors).length === 0) {
                actions.resetForm();
                toggle();
              }
            });
          }}
        >
          {(props) => (
            <>
              <ModalHeader toggle={toggle}>
                {annotation ? 'Edit Annotation' : 'Take part in the discussion'}
              </ModalHeader>
              <ModalBody>
                <Form>
                  <FormGroup>
                    <Label for="title">Title</Label>
                    <Input
                      type="text"
                      name="title"
                      id="title"
                      placeholder="Title of your annotation..."
                      value={props.values.title}
                      onChange={props.handleChange}
                      onBlur={props.handleBlur}
                      invalid={
                        props.touched.title && props.errors.title ? true : false
                      }
                    />
                    <FormFeedback
                      invalid={
                        props.touched.title && props.errors.title
                          ? props.errors.title
                          : null
                      }
                    >
                      {props.errors.title}
                    </FormFeedback>
                  </FormGroup>
                  <FormGroup>
                    <Label for="text">Annotation</Label>
                    <Input
                      type="textarea"
                      rows="8"
                      name="text"
                      id="text"
                      placeholder="Observations, remarks, comments, ..."
                      value={props.values.text}
                      onChange={props.handleChange}
                      onBlur={props.handleBlur}
                      invalid={
                        props.touched.text && props.errors.text ? true : false
                      }
                    />
                    <FormFeedback
                      invalid={
                        props.touched.text && props.errors.text
                          ? props.errors.text
                          : null
                      }
                    >
                      {props.errors.text}
                    </FormFeedback>
                  </FormGroup>
                </Form>
                <ButtonGroup className="w-100 text-center">
                  <Button color="danger" onClick={() => clearAll()}>
                    <FontAwesomeIcon icon="times" className="mr-2" /> Delete
                    lines
                  </Button>
                </ButtonGroup>
                <div className="all-canvas">
                  {images.length > 0 &&
                    images.map((i, index) => {
                      return (
                        <div className="canvas-drawing mb-3 pt-3">
                          <ChartAnnotationCanvas
                            key={index + '-canvas'}
                            ref={setRef(i.id)}
                            image={i}
                          />
                        </div>
                      );
                    })}
                </div>
              </ModalBody>
              <ModalFooter>
                {annotation ? (
                  <Button color="dark" onClick={props.handleSubmit}>
                    <FontAwesomeIcon icon="save" className="mr-2" /> Edit
                  </Button>
                ) : (
                  <Button color="success" onClick={props.handleSubmit}>
                    <FontAwesomeIcon icon="save" className="mr-2" /> Save
                  </Button>
                )}
                <Button color="secondary" onClick={toggle}>
                  Cancel
                </Button>
              </ModalFooter>
            </>
          )}
        </Formik>
      </Modal>
    </>
  );
};

export default AddAnnotationModal;
