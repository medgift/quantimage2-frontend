import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Spinner, Table } from 'reactstrap';
import moment from 'moment';
import DicomFields from './dicom/fields';
import { DICOM_DATE_FORMAT } from './config/constants';
import Kheops from './services/kheops';

import './Study.css';
import { useKeycloak } from 'react-keycloak';
import FeaturesList from './components/FeaturesList';

function Study({ match, kheopsError }) {
  let {
    params: { studyUID }
  } = match;

  let [keycloak] = useKeycloak();
  let [studyMetadata, setStudyMetadata] = useState(null);

  let series = useMemo(() => parseMetadata(studyMetadata), [studyMetadata]);

  useEffect(() => {
    async function getStudyMetadata() {
      const studyMetadata = await Kheops.studyMetadata(
        keycloak.token,
        studyUID
      );
      setStudyMetadata(studyMetadata);
    }
    getStudyMetadata();
  }, [keycloak, studyUID]);

  return (
    <section id="study">
      <h2>Study Details</h2>
      {kheopsError ? (
        <Alert color="danger">Error fetching data from Kheops</Alert>
      ) : !studyMetadata ? (
        <Spinner />
      ) : (
        <>
          <Table borderless size="sm" className="w-auto table-light">
            <tbody>
              <tr>
                <th scope="row">Patient</th>
                <td>
                  {
                    studyMetadata[0][DicomFields.PATIENT_NAME][
                      DicomFields.VALUE
                    ][0][DicomFields.ALPHABETIC]
                  }
                </td>
              </tr>
              <tr>
                <th scope="row">Date</th>
                <td>
                  {moment(
                    studyMetadata[0][DicomFields.DATE][DicomFields.VALUE][0],
                    DicomFields.DATE_FORMAT
                  ).format(DICOM_DATE_FORMAT)}
                </td>
              </tr>
              {Object.keys(series)
                .sort()
                .map((dataset, index) => (
                  <tr key={index}>
                    <th scope="row">{dataset}</th>
                    <td>
                      {series[dataset].length}{' '}
                      {dataset === 'RTSTRUCT' || dataset === 'RWV'
                        ? series[dataset].length > 1
                          ? 'files'
                          : 'file'
                        : series[dataset].length > 1
                        ? 'images'
                        : 'image'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </Table>
        </>
      )}
      <h2>Features</h2>
      <FeaturesList studyUID={studyUID} setMinWidth={true} />
      <Link style={{ marginTop: '1em' }} to="/">
        Back to Home
      </Link>
    </section>
  );
}

export default Study;

function parseMetadata(metadata) {
  if (metadata) {
    let series = {};
    for (let entry of metadata) {
      let modality = entry[DicomFields.MODALITY][DicomFields.VALUE][0];
      if (!series[modality]) series[modality] = [];

      series[modality].push(entry);
    }
    return series;
  } else {
    return null;
  }
}
