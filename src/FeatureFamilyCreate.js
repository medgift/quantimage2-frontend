import React from 'react';
import { useKeycloak } from 'react-keycloak';
import { ErrorMessage, Field, Form, Formik } from 'formik';
import {
  Button,
  Form as ReactForm,
  FormGroup,
  FormText,
  Input,
  Label
} from 'reactstrap';
import Backend from './services/backend';
import { Debug } from './utils/Debug';
import * as Yup from 'yup';

function FeatureFamilyCreate({ history, match, kheopsError }) {
  const [keycloak] = useKeycloak();
  const initialValues = { name: 'Intensity' };

  return (
    <div>
      <h1>Feature Family</h1>
      <Formik
        initialValues={initialValues}
        validationSchema={Yup.object().shape({
          name: Yup.string().required('Name is required')
        })}
        onSubmit={async (values, { setSubmitting }) => {
          console.log('submit!');

          const data = new FormData();

          // Build the form data to send to the server
          for (let field in values) {
            data.append(field, values[field]);
          }

          try {
            await Backend.createFeatureFamily(keycloak.token, data);
          } catch (err) {
            console.log(err);
          }

          setSubmitting(false);
        }}
      >
        {({ isSubmitting, touched, errors, setFieldValue }) => (
          <Form>
            <FormGroup>
              <Label htmlFor="feature-family-name">Feature Family Name</Label>
              <Field
                id="feature-family-name"
                type="text"
                name="name"
                placeholder="Type the name of the feature family (e.g. Intensity, Texture)"
                className={`form-control ${
                  touched.name && errors.name ? 'is-invalid' : ''
                }`}
              />
              <ErrorMessage
                className="text-danger"
                name="name"
                component="div"
              />
            </FormGroup>
            <FormGroup>
              <Field>
                {() => (
                  <>
                    <Label htmlFor="feature-family-config-file">
                      Feature Family Configuration File
                    </Label>
                    <Input
                      id="feature-family-config-file"
                      name="file"
                      type="file"
                      onChange={event => {
                        setFieldValue('file', event.currentTarget.files[0]);
                      }}
                      className="text-center"
                    />
                    <FormText color="muted">
                      Select a YAML file that specifies the feature family's
                      available fields and parameters
                    </FormText>
                  </>
                )}
              </Field>
            </FormGroup>
            <Button type="submit" color="primary" disabled={isSubmitting}>
              Create
            </Button>
            <Debug />
          </Form>
        )}
      </Formik>
    </div>
  );
}

export default FeatureFamilyCreate;
