import React, { useState, useEffect } from 'react';
import { useKeycloak } from 'react-keycloak';
import { ErrorMessage, Field, Form, Formik } from 'formik';
import { Button, FormGroup, FormText, Label, Spinner } from 'reactstrap';
import Backend from './services/backend';
import * as Yup from 'yup';
import './FeaturePresetCreate.css';
import { useAlert } from 'react-alert';
//import { Debug } from './utils/Debug';

const modes = {
  CREATE: 'Create',
  UPDATE: 'Update',
};

function FeaturePresetCreate({ history, match, kheopsError }) {
  const [keycloak] = useKeycloak();
  const alert = useAlert();

  const [dataFetched, setDataFetched] = useState(false);

  let {
    params: { featurePresetID },
  } = match;

  const [featurePreset, setFeaturePreset] = useState({ name: '', file: '' });

  let handleFormSubmit = async (values, { setSubmitting }) => {
    let mode = !featurePresetID ? modes.CREATE : modes.UPDATE;
    console.log(mode);

    const data = new FormData();

    // Build the form data to send to the server
    for (let field in values) {
      data.append(field, values[field]);
    }

    try {
      if (mode === modes.CREATE) {
        let createdFeaturePreset = await Backend.createPreset(
          keycloak.token,
          data
        );
        history.push(`/feature-presets/edit/${createdFeaturePreset.id}`);
        alert.success('Feature Preset Created!');
      } else {
        await Backend.updatePreset(keycloak.token, featurePresetID, data);
        alert.success('Feature Preset Updated!');
      }
    } catch (err) {
      console.log(err);
    }

    setSubmitting(false);
  };

  useEffect(() => {
    async function getFeaturePreset() {
      if (featurePresetID) {
        let featurePresetResponse = await Backend.preset(
          keycloak.token,
          featurePresetID
        );

        setFeaturePreset((prevPreset) => ({
          ...prevPreset,
          name: featurePresetResponse.name,
          file: featurePresetResponse.config_path.substr(
            featurePresetResponse.config_path.lastIndexOf('/') + 1
          ),
        }));
      }

      setDataFetched(true);
    }

    getFeaturePreset();
  }, [featurePresetID, keycloak.token]);

  return (
    <div>
      <h1>Feature Preset</h1>
      {dataFetched ? (
        <Formik
          initialValues={featurePreset}
          validationSchema={Yup.object().shape({
            name: Yup.string().required('Name is required'),
            file: Yup.mixed().required('File is required'),
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
            values,
          }) => (
            <Form>
              <FormGroup>
                <Label htmlFor="feature-preset-name">Feature Preset Name</Label>
                <Field
                  id="feature-preset-name"
                  type="text"
                  name="name"
                  placeholder="Type the name of the feature preset (e.g. Intensity, Texture)"
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
                      <Label htmlFor="file">
                        Feature Preset Configuration File
                      </Label>
                      <div className="custom-file">
                        <input
                          type="file"
                          id="file"
                          onChange={(event) => {
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
                        Select a YAML file that specifies the feature preset's
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
                {featurePresetID ? 'Save' : 'Create'}
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

export default FeaturePresetCreate;
