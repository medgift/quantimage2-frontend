import React, { useEffect } from 'react';
import { FormGroup, Form, Label, Input, Row, Col, Button } from 'reactstrap';
import { withFormik } from 'formik';
import './CanvasOptions.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const CanvasOptions = (props) => {
  useEffect(() => {
    props.handleSubmit();
  }, [props]);

  const handleChange = (e) => {
    props.handleChange(e);
    props.handleSubmit();
  };

  const undo = () => {
    props.undo(props.id);
  };

  return (
    <>
      <Form className="my-2">
        <Row>
          <Col>
            <FormGroup>
              <Label for="size">Taille du trait</Label>
              <Input
                type="select"
                name="size"
                id={'size-' + props.id}
                value={props.values.size}
                onChange={handleChange}
              >
                {[1, 2, 3, 4, 5].map((o) => {
                  return <option key={o}>{o}</option>;
                })}
              </Input>
            </FormGroup>
          </Col>
          <Col>
            <FormGroup>
              <Label for="color">Couleur du trait</Label>
              <Input
                type="color"
                name="color"
                id={'color-' + props.id}
                value={props.values.color}
                onChange={handleChange}
              />
            </FormGroup>
          </Col>
          <Col className="my-auto">
            <Button color="info" onClick={undo}>
              <FontAwesomeIcon icon="undo" className="mt-1" /> Effacer la
              dernière ligne
            </Button>
          </Col>
        </Row>
      </Form>
    </>
  );
};

export default withFormik({
  mapPropsToValues: () => ({
    size: 2,
    color: '#000000',
  }),
  handleSubmit: (values, { props }) => {
    props.change({ color: values.color, size: values.size });
  },
})(CanvasOptions);
