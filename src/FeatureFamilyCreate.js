import React, { useState, useEffect } from 'react';
import { useKeycloak } from 'react-keycloak';
import { ErrorMessage, Field, Form, Formik } from 'formik';
import { Button, FormGroup, FormText, Label, Spinner } from 'reactstrap';
import Backend from './services/backend';
import * as Yup from 'yup';
import './FeatureFamilyCreate.css';
import { useAlert } from 'react-alert';
//import { Debug } from './utils/Debug';

const modes = {
  CREATE: 'Create',
  UPDATE: 'Update'
};

function FeatureFamilyCreate({ history, match, kheopsError }) {
  const [keycloak] = useKeycloak();
  const alert = useAlert();

  const [dataFetched, setDataFetched] = useState(false);

  let {
    params: { featureFamilyID }
  } = match;

  const [featureFamily, setFeatureFamily] = useState({ name: '', file: '' });

  let handleFormSubmit = async (values, { setSubmitting }) => {
    let mode = !featureFamilyID ? modes.CREATE : modes.UPDATE;
    console.log(mode);

    const data = new FormData();

    // Build the form data to send to the server
    for (let field in values) {
      data.append(field, values[field]);
    }

    try {
      if (mode === modes.CREATE) {
        let createdFeatureFamily = await Backend.createFamily(
          keycloak.token,
          data
        );
        history.push(`/feature-families/edit/${createdFeatureFamily.id}`);
        alert.success('Feature Family Created!');
      } else {
        await Backend.updateFamily(keycloak.token, featureFamilyID, data);
        alert.success('Feature Family Updated!');
      }
    } catch (err) {
      console.log(err);
    }

    setSubmitting(false);
  };

  useEffect(() => {
    async function getFeatureFamily() {
      if (featureFamilyID) {
        let featureFamilyResponse = await Backend.family(
          keycloak.token,
          featureFamilyID
        );

        setFeatureFamily(prevFamily => ({
          ...prevFamily,
          name: featureFamilyResponse.name,
          file: featureFamilyResponse.config_path.substr(
            featureFamilyResponse.config_path.lastIndexOf('/') + 1
          )
        }));
      }

      setDataFetched(true);
    }

    getFeatureFamily();
  }, [featureFamilyID, keycloak.token]);

  return (
    <div>
      <h1>Feature Family</h1>
      {dataFetched ? (
        <Formik
          initialValues={featureFamily}
          validationSchema={Yup.object().shape({
            name: Yup.string().required('Name is required'),
            file: Yup.mixed().required('File is required')
          })}
          onSubmit={handleFormSubmit}
        >
          {({
            isSubmitting,
            touched,
            errors,
            setFieldValue,
            setFieldTouched,
            validateField,
            values
          }) => (
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
                <Field name="file">
                  {() => (
                    <>
                      <Label htmlFor="feature-family-config-file">
                        Feature Family Configuration File
                      </Label>
                      <div className="custom-file">
                        <input
                          type="file"
                          id="file"
                          onChange={event => {
                            setFieldValue('file', event.currentTarget.files[0]);
                          }}
                          className={`custom-file-input ${
                            touched.file && errors.file ? 'is-invalid' : ''
                          }`}
                        />
                        <label
                          className="custom-file-label text-left"
                          htmlFor="customFile"
                        >
                          {values.file.name
                            ? values.file.name
                            : values.file
                            ? values.file
                            : 'Choose file...'}
                        </label>
                      </div>
                      <FormText color="muted">
                        Select a YAML file that specifies the feature family's
                        available fields and parameters
                      </FormText>
                    </>
                  )}
                </Field>
                <ErrorMessage
                  className="text-danger"
                  name="file"
                  component="div"
                />
              </FormGroup>
              <Button type="submit" color="primary" disabled={isSubmitting}>
                {featureFamilyID ? 'Save' : 'Create'}
              </Button>
              {/*<Debug />*/}
            </Form>
          )}
        </Formik>
      ) : (
        <Spinner />
      )}
    </div>
  );
}

export default FeatureFamilyCreate;
