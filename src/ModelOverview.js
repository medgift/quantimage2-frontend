import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Button, Alert } from 'reactstrap';
import { saveAs } from 'file-saver';
import Backend from './services/backend';
import { useKeycloak } from '@react-keycloak/web';
import ModelsTable from './components/ModelsTable';
import {
  CLASSIFICATION_COLUMNS,
  MODEL_TYPES,
  SURVIVAL_COLUMNS,
} from './config/constants';

export default function ModelOverview({ albums }) {
  const navigate = useNavigate();

  const { keycloak } = useKeycloak();

  const [featureExtractionID, setFeatureExtractionID] = useState(null);
  const [models, setModels] = useState([]);
  const [collections, setCollections] = useState([]);
  const [plotTestModelsValue, setPlotTestModelsValue] = useState('');
  const [plotTrainModelsValue, setPlotTrainModelsValue] = useState('');
  const [isPlotModelCorrect, setIsPlotModelCorrect] = useState(true);
  const [isPlotModelCorrectMessage, setIsPlotModelCorrectMessage] = useState("");

  const { albumID } = useParams();

  const collectionColumn = useMemo(
    () => ({
      Header: 'Collection',
      accessor: (r) => {
        const collection = collections.find(
          (c) => c.id === r.feature_collection_id
        );

        return collection ? collection.name : '<original>';
      },
    }),
    [collections]
  );

  // const CheckboxCell = ({ value, onChange, row }) => {
  //   const [isChecked, setIsChecked] = useState(false); // Initial checkbox state
  
  //   const handleChange = (event) => {
  //     setIsChecked(event.target.checked);
  //     // Pass the updated state (row data and checkbox value) to the onChange callback
  //     onChange?.(row.original, event.target.checked);
  //   };
  
  //   return (
  //     <div>
  //       <input
  //         type="checkbox"
  //         checked={isChecked}
  //         onChange={handleChange}
  //       />
  //       {/* Optionally display the value next to the checkbox */}
  //       {value}
  //     </div>
  //   );
  // };

  
  const modelIDColumn = useMemo(() => ({
    Header: 'Model ID',
    accessor: (r) => r.id,
  }), []);

  // Model table header
  const columnsClassification = React.useMemo(
    () => [modelIDColumn, collectionColumn, ...CLASSIFICATION_COLUMNS],
    [collectionColumn, modelIDColumn]
  );
  const columnsSurvival = React.useMemo(
    () => [modelIDColumn, collectionColumn, ...SURVIVAL_COLUMNS],
    [collectionColumn, modelIDColumn]
  );

  // Get feature extraction
  useEffect(() => {
    async function getExtraction() {
      const latestExtraction = await Backend.extractions(
        keycloak.token,
        albumID
      );

      setFeatureExtractionID(latestExtraction.id);
    }

    getExtraction();
  }, [albumID, keycloak.token]);

  useEffect(() => {
    async function fetchModels() {
      let models = await Backend.models(keycloak.token, albumID);

      // Filter out models that are not for this collection / original feature set
      let filteredModels = models.filter(
        (m) => m.feature_extraction_id === featureExtractionID
      );

      let sortedModels = filteredModels.sort(
        (m1, m2) => new Date(m2.created_at) - new Date(m1.created_at)
      );

      setModels(sortedModels);
    }

    if (featureExtractionID) fetchModels();
  }, [keycloak.token, albumID, featureExtractionID]);

  // Get collections
  useEffect(() => {
    async function getCollections() {
      const latestExtraction = await Backend.extractions(
        keycloak.token,
        albumID
      );

      const collections = await Backend.collectionsByExtraction(
        keycloak.token,
        latestExtraction.id
      );

      setCollections(collections.map((c) => c.collection));
    }

    getCollections();
  }, [albumID, keycloak.token]);

  const album = albums.find((a) => a.album_id === albumID);

  const handleDeleteModelClick = async (id) => {
    await Backend.deleteModel(keycloak.token, id);
    setModels(models.filter((model) => model.id !== id));
  };

  const handlePlotTestModelsChange = (event) => {
    setPlotTestModelsValue(event.target.value);
  };

  const handlePlotTestModels = async () => {
    const modelIds = models.map((item) => item.id);
    
    if (plotTestModelsValue != null) {
      let plotModelsArray = plotTestModelsValue.split(",").filter(Number).map(Number);
      
      if (plotModelsArray.length !== plotTestModelsValue.split(",").length) {
        setIsPlotModelCorrect(false);
        setIsPlotModelCorrectMessage("Was not able to convert comma separated string to a list of numbers - please provide numbers such as 1,2,3");
      } else if (plotModelsArray.length === 0) {
        setIsPlotModelCorrect(false);
        setIsPlotModelCorrectMessage("Please provide at least one model ID");
      } else {
        // Check if all provided model IDs exist
        const invalidModels = plotModelsArray.filter(id => !modelIds.includes(id));
        if (invalidModels.length > 0) {
          setIsPlotModelCorrect(false);
          setIsPlotModelCorrectMessage(`Please select models that exist - got invalid IDs: ${invalidModels.join(', ')}`);
        } else {
          setIsPlotModelCorrect(true);
          let { filename, content } = await Backend.plotTestPredictions(
            keycloak.token,
            plotModelsArray
          );
          saveAs(content, filename);
        }
      }
    }
  };

  const handlePlotTrainModelsChange = (event) => {
    setPlotTrainModelsValue(event.target.value);
  };

  const handlePlotTrainModels = async () => {
    const modelIds = models.map((item) => item.id);
    
    if (plotTrainModelsValue != null) {
      let plotModelsArray = plotTrainModelsValue.split(",").filter(Number).map(Number);
      
      if (plotModelsArray.length !== plotTrainModelsValue.split(",").length) {
        setIsPlotModelCorrect(false);
        setIsPlotModelCorrectMessage("Was not able to convert comma separated string to a list of numbers - please provide numbers such as 1,2,3");
      } else if (plotModelsArray.length === 0) {
        setIsPlotModelCorrect(false);
        setIsPlotModelCorrectMessage("Please provide at least one model ID");
      } else {
        // Check if all provided model IDs exist
        const invalidModels = plotModelsArray.filter(id => !modelIds.includes(id));
        if (invalidModels.length > 0) {
          setIsPlotModelCorrect(false);
          setIsPlotModelCorrectMessage(`Please select models that exist - got invalid IDs: ${invalidModels.join(', ')}`);
        } else {
          setIsPlotModelCorrect(true);
          let { filename, content } = await Backend.plotTrainPredictions(
            keycloak.token,
            plotModelsArray
          );
          saveAs(content, filename);
        }
      }
    }
  };

  return (
    albums.length > 0 && (
      <div>
        <h1>
          Model Overview for <strong>{album.name}</strong> album
        </h1>
        <div
          className="d-flex flex-column justify-content-start align-items-start tab-content"
          style={{ borderTop: '1px solid #dee2e6' }}
        >
          <Button
            color="link"
            onClick={() => navigate(`/features/${albumID}/overview`)}
            >
            <FontAwesomeIcon icon="arrow-left" /> Go Back
          </Button>

          {models.length > 0 ? (
            <div style={{ width: '98%' }}>
              <ModelsTable
                title="Classification Models"
                columns={columnsClassification}
                data={models.filter(
                  (m) => m.type === MODEL_TYPES.CLASSIFICATION
                )}
                handleDeleteModelClick={handleDeleteModelClick}
                showComparisonButtons={true}
              />
              <ModelsTable
                title="Survival Models"
                columns={columnsSurvival}
                data={models.filter((m) => m.type === MODEL_TYPES.SURVIVAL)}
                handleDeleteModelClick={handleDeleteModelClick}
                showComparisonButtons={true}
              />
              <div style={{ marginTop: '20px' }}>
                <input
                  type="text"
                  value={plotTestModelsValue}
                  placeholder="Enter 1 or 2 Model IDs (e.g. 1,2)"
                  onChange={handlePlotTestModelsChange}
                  style={{ 
                    marginRight: '10px',
                    width: '300px',
                    padding: '5px'
                  }}
                />
                <Button
                  color="primary"
                  onClick={handlePlotTestModels}
                >
                  <FontAwesomeIcon icon="chart-line" /> Plot Model Test Predictions
                </Button>
                {!isPlotModelCorrect && (
                  <Alert color="danger" style={{ marginTop: '10px' }}>
                    {isPlotModelCorrectMessage}
                  </Alert>
                )}
              </div>
              <div style={{ marginTop: '20px' }}>
                <input
                  type="text"
                  value={plotTrainModelsValue}
                  placeholder="Enter 1 or 2 Model IDs (e.g. 1,2)"
                  onChange={handlePlotTrainModelsChange}
                  style={{ 
                    marginRight: '10px',
                    width: '300px',
                    padding: '5px'
                  }}
                />
                <Button
                  color="primary"
                  onClick={handlePlotTrainModels}
                >
                  <FontAwesomeIcon icon="chart-line" /> Plot Model Train Predictions
                </Button>
                {!isPlotModelCorrect && (
                  <Alert color="danger" style={{ marginTop: '10px' }}>
                    {isPlotModelCorrectMessage}
                  </Alert>
                )}
              </div>
            </div>
          ) : (
            <h2 className="align-self-stretch">No Models Created Yet</h2>
          )}
        </div>
      </div>
    )
  );
}
