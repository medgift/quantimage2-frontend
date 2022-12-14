import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Spinner, Table } from 'reactstrap';
import moment from 'moment';
import DicomFields from './dicom/fields';
import { DICOM_DATE_FORMAT } from './config/constants';
import Kheops from './services/kheops';

import './Study.css';
import { useKeycloak } from '@react-keycloak/web';

function Study({ match, kheopsError }) {
  let {
    params: { studyUID },
  } = match;

  let {keycloak} = useKeycloak();
  let [studyDetails, setStudyDetails] = useState(null);
  let [seriesDetails, setSeriesDetails] = useState(null);

  let series = useMemo(() => parseSeriesDetails(seriesDetails), [
    seriesDetails,
  ]);

  useEffect(() => {
    async function getStudyDetails() {
      const studyDetails = await Kheops.study(keycloak.token, studyUID);
      setStudyDetails(studyDetails);

      const seriesDetails = await Kheops.series(
        keycloak.token,
        studyUID
        //albumID
      );
      setSeriesDetails(seriesDetails);
    }

    getStudyDetails();
  }, [keycloak, studyUID]);

  return (
    <section id="study">
      <h2>Study Details</h2>
      {kheopsError ? (
        <Alert color="danger">Error fetching data from Kheops</Alert>
      ) : !seriesDetails ? (
        <Spinner />
      ) : (
        <>
          <Table borderless size="sm" className="w-auto table-light">
            <tbody>
              <tr>
                <th scope="row">Patient</th>
                <td>
                  {studyDetails[DicomFields.PATIENT_NAME][DicomFields.VALUE]
                    ? studyDetails[DicomFields.PATIENT_NAME][
                        DicomFields.VALUE
                      ][0][DicomFields.ALPHABETIC]
                    : 'UNNAMED'}
                </td>
              </tr>
              <tr>
                <th scope="row">Date</th>
                <td>
                  {studyDetails[DicomFields.DATE] &&
                  studyDetails[DicomFields.DATE][DicomFields.VALUE]
                    ? moment(
                        studyDetails[DicomFields.DATE][DicomFields.VALUE][0],
                        DicomFields.DATE_FORMAT
                      ).format(DICOM_DATE_FORMAT)
                    : 'UNKNOWN'}
                </td>
              </tr>
              {Object.keys(series)
                .sort()
                .map((dataset, index) => (
                  <tr key={index}>
                    <th scope="row">{dataset}</th>
                    <td>
                      {series[dataset]}{' '}
                      {dataset === 'RTSTRUCT' ||
                      dataset === 'RWV' ||
                      dataset === 'SEG'
                        ? series[dataset] > 1
                          ? 'files'
                          : 'file'
                        : series[dataset] > 1
                        ? 'images'
                        : 'image'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </Table>
        </>
      )}
      {/*<h2>Features</h2>
      {studyDetails && (
        <FeaturesList
          studyUID={studyUID}
          patientID={studyDetails[DicomFields.PATIENT_ID][DicomFields.VALUE][0]}
          studyDate={studyDetails[DicomFields.DATE][DicomFields.VALUE][0]}
          setMinWidth={true}
        />
      )}*/}
      <Link style={{ marginTop: '1em' }} to="/">
        Back to Home
      </Link>
    </section>
  );
}

export default Study;

function parseSeriesDetails(seriesDetails) {
  if (seriesDetails) {
    let series = {};
    for (let entry of seriesDetails) {
      let modality = entry[DicomFields.MODALITY][DicomFields.VALUE][0];
      let instances =
        entry[DicomFields.SERIES_INSTANCES_NB][DicomFields.VALUE][0];

      series[modality] = instances;
    }
    return series;
  } else {
    return null;
  }
}
