import {
  Alert,
  Button,
  ButtonGroup,
  Collapse,
  Input,
  Label,
  Table,
} from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import Backend from '../services/backend';
import { useKeycloak } from '@react-keycloak/web';
import {
  CLINICAL_FEATURE_FIELDS,
  CLINICAL_FEATURE_TYPES,
  CLINICAL_FEATURE_ENCODING,
  CLINICAL_FEATURE_MISSING_VALUES,
} from '../config/constants';
import {
  validateClinicalFeaturesFile,
  parseClinicalFeatureNames,
  SelectColumnFilter,
} from '../utils/feature-utils.js';
import { FeatureTable } from '../components/FeatureTable';
import {
  makeClinicalFeatureId,
  clinicalFeatureIdPrefix,
} from '../utils/clinical-feature-id';

import _ from 'lodash';

import './ClinicalFeatureTable.css';
import '../Features.css';

const PATIENT_ID = 'PatientID';

// Strip a leading directory prefix and the .csv extension, fall back to a
// plain placeholder if the result is empty.
function defaultFileName(file) {
  if (!file?.name) return 'Clinical features';
  const base = file.name.replace(/\.csv$/i, '').trim();
  return base || 'Clinical features';
}

export default function ClinicalFeatureTable({
  dataPoints,
  albumID,
  clinicalFeatureFiles,
  setClinicalFeatureFiles,
  clinicalFeaturesDefinitions,
  setClinicalFeaturesDefinitions,
  formattedClinicalFeaturesDefinitions,
  clinicalFeaturesValues,
  setClinicalFeaturesValues,
  clinicalFeaturesUniqueValues,
}) {
  let { keycloak } = useKeycloak();

  const [isSavingClinicalFeatures, setIsSavingClinicalFeatures] =
    useState(false);

  const [isClinicalFeaturesConfigurationOpen, setIsConfigOpen] = useState(true);
  const [isImportOpen, setIsImportOpen] = useState(false);

  const [pendingFileName, setPendingFileName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadValid, setUploadValid] = useState(null);
  const [uploadMessage, setUploadMessage] = useState(null);
  const [filterMessages, setFilterMessages] = useState({});
  const fileInput = useRef(null);

  // Group definitions by file_id so each file gets its own config card.
  const definitionsByFileId = useMemo(() => {
    const grouped = {};
    if (!clinicalFeaturesDefinitions) return grouped;
    for (const d of clinicalFeaturesDefinitions) {
      const fid = d.clinical_feature_file_id;
      if (!grouped[fid]) grouped[fid] = [];
      grouped[fid].push(d);
    }
    return grouped;
  }, [clinicalFeaturesDefinitions]);

  // Format unique-values response for display.
  const formattedUniqueValues = useMemo(() => {
    if (!clinicalFeaturesUniqueValues) return {};
    return Object.entries(clinicalFeaturesUniqueValues).reduce(
      (acc, [featureID, values]) => {
        acc[featureID] = values.join(' | ');
        return acc;
      },
      {}
    );
  }, [clinicalFeaturesUniqueValues]);

  // Auto-toggle to import when the user has no files yet.
  useEffect(() => {
    if (clinicalFeatureFiles !== null && clinicalFeatureFiles.length === 0) {
      setIsConfigOpen(false);
      setIsImportOpen(true);
    }
  }, [clinicalFeatureFiles]);

  const toggleConfigTab = () => {
    setIsConfigOpen((open) => !open);
    setIsImportOpen(false);
  };

  const toggleImportTab = () => {
    setIsImportOpen((open) => !open);
    setIsConfigOpen(false);
  };

  const getPossibleEncodings = (featureType) => {
    if (featureType === CLINICAL_FEATURE_TYPES.CATEGORICAL) {
      return [
        CLINICAL_FEATURE_ENCODING.ONE_HOT_ENCODING,
        CLINICAL_FEATURE_ENCODING.ORDERED_CATEGORIES,
      ];
    }
    return [
      CLINICAL_FEATURE_ENCODING.NONE,
      CLINICAL_FEATURE_ENCODING.NORMALIZATION,
    ];
  };

  const getPossibleMissingValues = (featureType) => {
    if (featureType === CLINICAL_FEATURE_TYPES.CATEGORICAL) {
      return [
        CLINICAL_FEATURE_MISSING_VALUES.MODE,
        CLINICAL_FEATURE_MISSING_VALUES.DROP,
        CLINICAL_FEATURE_MISSING_VALUES.NONE,
      ];
    }
    return [
      CLINICAL_FEATURE_MISSING_VALUES.MEDIAN,
      CLINICAL_FEATURE_MISSING_VALUES.MEAN,
      CLINICAL_FEATURE_MISSING_VALUES.DROP,
      CLINICAL_FEATURE_MISSING_VALUES.NONE,
    ];
  };

  const handleDefinitionInputChange = (e, definitionId, field) => {
    const updated = clinicalFeaturesDefinitions.map((d) => {
      if (d.id !== definitionId) return d;
      const next = { ...d, [field]: e.target.value };
      if (field === CLINICAL_FEATURE_FIELDS.TYPE) {
        next[CLINICAL_FEATURE_FIELDS.ENCODING] = getPossibleEncodings(
          e.target.value
        )[0];
        next[CLINICAL_FEATURE_FIELDS.MISSING_VALUES] = getPossibleMissingValues(
          e.target.value
        )[0];
      }
      return next;
    });
    setClinicalFeaturesDefinitions(updated);
  };

  const handleSaveConfigurationClick = async () => {
    setIsSavingClinicalFeatures(true);
    await Backend.updateClinicalFeaturesDefinitions(
      keycloak.token,
      clinicalFeaturesDefinitions,
      albumID
    );
    setIsSavingClinicalFeatures(false);
  };

  const handleDeleteFile = async (fileId) => {
    const file = clinicalFeatureFiles.find((f) => f.id === fileId);
    const ok = window.confirm(
      `Delete clinical features file "${file?.name}"? This removes its features and values for every patient.`
    );
    if (!ok) return;
    await Backend.deleteClinicalFeatureFile(keycloak.token, fileId);
    // Drop the file's definitions from local state and refetch values.
    setClinicalFeatureFiles(
      clinicalFeatureFiles.filter((f) => f.id !== fileId)
    );
    setClinicalFeaturesDefinitions(
      clinicalFeaturesDefinitions.filter(
        (d) => d.clinical_feature_file_id !== fileId
      )
    );
    if (clinicalFeaturesValues) {
      const prefix = clinicalFeatureIdPrefix(fileId);
      const updatedValues = Object.entries(clinicalFeaturesValues).reduce(
        (acc, [pid, vals]) => {
          acc[pid] = _.omitBy(vals, (_v, k) => k.startsWith(prefix));
          return acc;
        },
        {}
      );
      setClinicalFeaturesValues(updatedValues);
    }
  };

  const handleRenameFile = async (fileId, currentName) => {
    const newName = window.prompt('Rename clinical features file', currentName);
    if (newName === null) return;
    const trimmed = newName.trim();
    if (!trimmed || trimmed === currentName) return;
    try {
      const updated = await Backend.renameClinicalFeatureFile(
        keycloak.token,
        fileId,
        trimmed
      );
      setClinicalFeatureFiles(
        clinicalFeatureFiles.map((f) => (f.id === fileId ? updated : f))
      );
    } catch (err) {
      window.alert(`Could not rename: ${err?.message || err}`);
    }
  };

  const handleFileInputChange = async () => {
    const file = fileInput.current?.files?.[0];
    if (!file) return;
    setUploadValid(null);
    setUploadMessage(null);
    setFilterMessages({});
    setPendingFileName(defaultFileName(file));
  };

  const handleUploadSubmit = async () => {
    const file = fileInput.current?.files?.[0];
    if (!file) {
      setUploadValid(false);
      setUploadMessage('Please choose a CSV file first.');
      return;
    }
    setIsUploading(true);
    try {
      // Both only read the file; parse it once in parallel.
      const [[isValid, message, clinicalFeatures], columnNames] =
        await Promise.all([
          validateClinicalFeaturesFile(file, dataPoints),
          parseClinicalFeatureNames(file),
        ]);

      if (!isValid) {
        setUploadValid(false);
        setUploadMessage(message);
        return;
      }

      if (!columnNames.includes(PATIENT_ID)) {
        setUploadValid(false);
        setUploadMessage(
          `CSV does not contain a ${PATIENT_ID} column (got: ${columnNames.join(
            ', '
          )}).`
        );
        return;
      }

      // Independent read-only backend calls over the same parsed features.
      const [columnsToFilter, guessed] = await Promise.all([
        Backend.filterClinicalFeatures(keycloak.token, clinicalFeatures),
        Backend.guessClinicalFeatureDefinitions(
          keycloak.token,
          clinicalFeatures
        ),
      ]);

      const allColumnsToFilter = _.uniq(Object.values(columnsToFilter).flat());
      const filteredValues = Object.entries(clinicalFeatures).reduce(
        (acc, [patientID, values]) => {
          acc[patientID] = _.omit(values, allColumnsToFilter);
          return acc;
        },
        {}
      );

      // Single pass: record why a column was dropped, otherwise keep its
      // (guessed) definition.
      const newFilterMessages = {};
      const definitionsToSave = {};
      for (const columnName of columnNames) {
        if (columnName === PATIENT_ID || columnName.length === 0) continue;
        if (columnsToFilter['date_columns'].includes(columnName)) {
          newFilterMessages[columnName] = 'as we do not support date columns';
          continue;
        }
        if (columnsToFilter['too_little_data'].includes(columnName)) {
          newFilterMessages[columnName] =
            'because less than 10% of patients have data for it';
          continue;
        }
        if (columnsToFilter['only_one_value'].includes(columnName)) {
          newFilterMessages[columnName] =
            'because only one value is present in the data';
          continue;
        }
        definitionsToSave[columnName] = guessed[columnName] || {
          [CLINICAL_FEATURE_FIELDS.TYPE]: CLINICAL_FEATURE_TYPES.CATEGORICAL,
          [CLINICAL_FEATURE_FIELDS.ENCODING]:
            CLINICAL_FEATURE_ENCODING.ONE_HOT_ENCODING,
          [CLINICAL_FEATURE_FIELDS.MISSING_VALUES]:
            CLINICAL_FEATURE_MISSING_VALUES.MODE,
        };
      }

      // Create the file row, then save its definitions and values.
      const fileRecord = await Backend.createClinicalFeatureFile(
        keycloak.token,
        albumID,
        pendingFileName.trim() || defaultFileName(file)
      );
      const savedDefinitions = await Backend.saveClinicalFeaturesDefinitions(
        keycloak.token,
        definitionsToSave,
        albumID,
        fileRecord.id
      );
      await Backend.saveClinicalFeaturesValues(
        keycloak.token,
        filteredValues,
        albumID,
        fileRecord.id
      );

      // Merge into local state.
      setClinicalFeatureFiles([...(clinicalFeatureFiles || []), fileRecord]);
      setClinicalFeaturesDefinitions([
        ...(clinicalFeaturesDefinitions || []),
        ...savedDefinitions,
      ]);
      // Append this file's namespaced values to the existing patient map.
      setClinicalFeaturesValues((prev) => {
        const next = { ...(prev || {}) };
        for (const [patientID, values] of Object.entries(filteredValues)) {
          const ns = { ...(next[patientID] || {}) };
          for (const [k, v] of Object.entries(values)) {
            ns[makeClinicalFeatureId(fileRecord.id, k)] = v;
          }
          next[patientID] = ns;
        }
        return next;
      });

      setUploadValid(true);
      setUploadMessage(message);
      setFilterMessages(newFilterMessages);
      // Reset upload widget for the next file
      if (fileInput.current) fileInput.current.value = '';
      setPendingFileName('');
      setIsConfigOpen(true);
      setIsImportOpen(false);
    } catch (err) {
      console.error(err);
      setUploadValid(false);
      setUploadMessage(err?.message || String(err));
    } finally {
      setIsUploading(false);
    }
  };

  if (clinicalFeaturesDefinitions === null || clinicalFeaturesValues === null) {
    return (
      <>
        <FontAwesomeIcon icon="sync" spin={true} /> Loading...
      </>
    );
  }

  return (
    <>
      <p>
        <Button color="primary" onClick={toggleConfigTab}>
          Clinical Feature Configuration
        </Button>{' '}
        <Button color="success" onClick={toggleImportTab}>
          Import Clinical Features
        </Button>
      </p>

      <Collapse isOpen={isClinicalFeaturesConfigurationOpen}>
        {(!clinicalFeatureFiles || clinicalFeatureFiles.length === 0) && (
          <Alert color="info">
            No clinical-feature files uploaded yet. Use the{' '}
            <em>Import Clinical Features</em> button to add one.
          </Alert>
        )}

        {clinicalFeatureFiles &&
          clinicalFeatureFiles.map((file) => {
            const defs = definitionsByFileId[file.id] || [];
            return (
              <div
                key={file.id}
                style={{
                  border: '1px solid #dee2e6',
                  borderRadius: 4,
                  padding: 12,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <h5 style={{ margin: 0 }}>
                    {file.name}{' '}
                    <small className="text-muted">
                      ({defs.length} feature{defs.length === 1 ? '' : 's'})
                    </small>
                  </h5>
                  <ButtonGroup size="sm">
                    <Button
                      color="secondary"
                      outline
                      onClick={() => handleRenameFile(file.id, file.name)}
                    >
                      <FontAwesomeIcon icon="pen" /> Rename
                    </Button>
                    <Button
                      color="danger"
                      outline
                      onClick={() => handleDeleteFile(file.id)}
                    >
                      <FontAwesomeIcon icon="trash" /> Delete
                    </Button>
                  </ButtonGroup>
                </div>

                <Table size="sm" className="table-fixed mt-2">
                  <thead>
                    <tr>
                      <th>Clinical Feature</th>
                      <th>Type</th>
                      <th>Encoding</th>
                      <th>Values</th>
                      <th>Missing Values</th>
                    </tr>
                  </thead>
                  <tbody>
                    {defs.map((d) => (
                      <tr key={d.id}>
                        <td>{d[CLINICAL_FEATURE_FIELDS.NAME]}</td>
                        <td>
                          <Input
                            type="select"
                            value={d[CLINICAL_FEATURE_FIELDS.TYPE]}
                            onChange={(event) =>
                              handleDefinitionInputChange(
                                event,
                                d.id,
                                CLINICAL_FEATURE_FIELDS.TYPE
                              )
                            }
                          >
                            {Object.values(CLINICAL_FEATURE_TYPES).map(
                              (featureType) => (
                                <option key={featureType} value={featureType}>
                                  {featureType}
                                </option>
                              )
                            )}
                          </Input>
                        </td>
                        <td>
                          <Input
                            type="select"
                            value={d[CLINICAL_FEATURE_FIELDS.ENCODING]}
                            onChange={(event) =>
                              handleDefinitionInputChange(
                                event,
                                d.id,
                                CLINICAL_FEATURE_FIELDS.ENCODING
                              )
                            }
                          >
                            {getPossibleEncodings(
                              d[CLINICAL_FEATURE_FIELDS.TYPE]
                            ).map((enc) => (
                              <option key={enc} value={enc}>
                                {enc}
                              </option>
                            ))}
                          </Input>
                        </td>
                        <td>
                          {
                            formattedUniqueValues[
                              makeClinicalFeatureId(
                                file.id,
                                d[CLINICAL_FEATURE_FIELDS.NAME]
                              )
                            ]
                          }
                        </td>
                        <td>
                          <Input
                            type="select"
                            value={d[CLINICAL_FEATURE_FIELDS.MISSING_VALUES]}
                            onChange={(event) =>
                              handleDefinitionInputChange(
                                event,
                                d.id,
                                CLINICAL_FEATURE_FIELDS.MISSING_VALUES
                              )
                            }
                          >
                            {getPossibleMissingValues(
                              d[CLINICAL_FEATURE_FIELDS.TYPE]
                            ).map((mv) => (
                              <option key={mv} value={mv}>
                                {mv}
                              </option>
                            ))}
                          </Input>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            );
          })}

        {clinicalFeatureFiles && clinicalFeatureFiles.length > 0 && (
          <Button
            color="success"
            onClick={handleSaveConfigurationClick}
            disabled={isSavingClinicalFeatures}
          >
            {isSavingClinicalFeatures ? (
              <>
                <FontAwesomeIcon icon="spinner" spin /> Saving Configuration
              </>
            ) : (
              'Save Clinical Feature Configuration'
            )}
          </Button>
        )}

        <h4 className="mt-4">Clinical Feature Values</h4>
        <ClinicalValuesTable
          files={clinicalFeatureFiles || []}
          definitionsByFileId={definitionsByFileId}
          clinicalFeaturesValues={clinicalFeaturesValues}
        />
      </Collapse>

      <Collapse isOpen={isImportOpen}>
        <p>
          Upload a CSV with one row per patient and one column per clinical
          feature. The system auto-detects column types; you can edit them in
          the configuration tab afterwards. <strong>Multiple files</strong> can
          coexist for an album — uploading a new one does <em>not</em> remove
          existing files.
        </p>
        <Label for="label-file" style={{ fontWeight: 'bold' }}>
          Choose CSV file
        </Label>
        <div style={{ textAlign: 'center' }}>
          <Input
            type="file"
            name="file"
            id="label-file"
            innerRef={fileInput}
            onChange={handleFileInputChange}
            style={{ width: 'inherit', display: 'inline' }}
          />
        </div>
        <div className="mt-2">
          <Label for="dataset-name">Dataset name</Label>
          <Input
            id="dataset-name"
            type="text"
            value={pendingFileName}
            onChange={(e) => setPendingFileName(e.target.value)}
            placeholder="Defaults to the filename"
          />
        </div>
        <div className="mt-2">
          <Button
            color="primary"
            onClick={handleUploadSubmit}
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <FontAwesomeIcon icon="spinner" spin /> Uploading
              </>
            ) : (
              'Upload'
            )}
          </Button>
        </div>

        {uploadValid === false && (
          <Alert color="danger" className="mt-2">
            Upload failed: {uploadMessage}
          </Alert>
        )}
      </Collapse>

      {/* Rendered outside the import Collapse: a successful upload switches to
          the configuration tab, so these confirmations must not be tied to the
          import tab's open state. */}
      {uploadValid === true && (
        <>
          <Alert color="success" className="mt-2">
            {uploadMessage} The new file is now visible in the configuration
            tab.
          </Alert>
          {Object.entries(filterMessages).map(([col, why]) => (
            <Alert color="warning" key={col}>
              Column <code>{col}</code> was dropped {why}.
            </Alert>
          ))}
        </>
      )}
    </>
  );
}

function ClinicalValuesTable({
  files,
  definitionsByFileId,
  clinicalFeaturesValues,
}) {
  const columns = useMemo(() => {
    const featureGroups = files.map((file) => {
      const defs = definitionsByFileId[file.id] || [];
      return {
        Header: file.name,
        columns: defs.map((d) => ({
          Header: d.name,
          accessor: makeClinicalFeatureId(file.id, d.name),
          disableFilters: true,
        })),
      };
    });

    return [
      {
        Header: 'Metadata',
        columns: [
          {
            Header: PATIENT_ID,
            accessor: PATIENT_ID,
            Filter: SelectColumnFilter,
            filter: 'equals',
          },
        ],
      },
      ...featureGroups,
    ];
  }, [files, definitionsByFileId]);

  const data = useMemo(() => {
    if (!clinicalFeaturesValues) return [];
    return Object.entries(clinicalFeaturesValues).map(
      ([patientID, values]) => ({
        [PATIENT_ID]: patientID,
        ...values,
      })
    );
  }, [clinicalFeaturesValues]);

  return (
    <div className="features-table">
      <FeatureTable data={data} columns={columns} />
    </div>
  );
}
