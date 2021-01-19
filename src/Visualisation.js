import React, { useEffect, useState, useContext, useRef, useMemo } from 'react';
import UserContext from './context/UserContext';
import SidePanel from './visualisation/SidePanel';
import Main from './visualisation/Main';
import AnnotationPanel from './visualisation/AnnotationPanel';
import './Visualisation.css';
import Backend from './services/backend';
// Chart Specs
import PCA from './assets/charts/PCA.json';
import Lasagna from './assets/charts/Lasagna.json';
import { useParams } from 'react-router-dom';
import { useKeycloak } from 'react-keycloak';

export default function Visualisation(props) {
  // Route
  const { albumID } = useParams();

  // Keycloak
  const [keycloak] = useKeycloak();

  // Init
  const user = useContext(UserContext);
  const main = useRef(null);
  const [loading, setLoading] = useState(true);

  // Features
  const [featureNames, setFeatureNames] = useState([]);
  const [regions, setRegions] = useState([]);
  const [modalities, setModalities] = useState([]);
  const [patients, setPatients] = useState([]);

  // Annotations
  const annotationPanel = useRef(null);
  const [annotations, setAnnotations] = useState([]);

  // Charts
  const [pcaChart, setPcaChart] = useState(null);
  const [lasagnaData, setLasagnaData] = useState(null);
  const [lasagnaChart, setLasagnaChart] = useState(null);
  const [pcaImg, setPcaImg] = useState(null);
  const [lasagnaImg, setLasagnaImg] = useState(null);

  // Collection information
  const { collectionInfos } = props;

  // Get features & annotations
  useEffect(() => {
    async function loadLasagnaChartData() {
      const data = await Backend.lasagna(
        keycloak.token,
        albumID,
        collectionInfos ? collectionInfos.collection.id : null
      );

      setFeatureNames(
        [...new Set(data.features.map((f) => f.feature_name))].map((f) => ({
          name: f,
          selected: true,
        }))
      );
      setModalities(
        [...new Set(data.features.map((f) => f.Modality))].map((m) => ({
          name: m,
          selected: true,
        }))
      );
      setRegions(
        [...new Set(data.features.map((f) => f.ROI))].map((r) => ({
          name: r,
          selected: true,
        }))
      );
      setPatients(
        [...new Set(data.features.map((f) => f.PatientID))].map((p) => ({
          name: p,
          selected: true,
        }))
      );
      setLasagnaData(data);
    }

    /*async function loadAnnotations() {
      let annotations = await Backend.annotations(keycloak.token, albumID);
      setAnnotations(annotations);
    }

    loadAnnotations();
    */

    loadLasagnaChartData();
  }, []);

  // Calculate features to keep based on selections
  const selectedFeatures = useMemo(() => {
    if (!lasagnaData) return null;

    let filteredFeatures = lasagnaData.features.filter((f) => {
      return (
        featureNames
          .filter((f) => f.selected)
          .map((f) => f.name)
          .includes(f.feature_name) &&
        modalities
          .filter((m) => m.selected)
          .map((m) => m.name)
          .includes(f.Modality) &&
        regions
          .filter((r) => r.selected)
          .map((r) => r.name)
          .includes(f.ROI) &&
        patients
          .filter((p) => p.selected)
          .map((p) => p.name)
          .includes(f.PatientID)
      );
    });
    console.log('filtered features', filteredFeatures);

    return filteredFeatures;
  }, [lasagnaData, featureNames, modalities, regions, patients]);

  // Refresh charts on feature changes
  useEffect(() => {
    if (selectedFeatures) {
      console.log(
        'going to load charts with the selected features',
        selectedFeatures.length
      );
      loadCharts(selectedFeatures);
    }
  }, [selectedFeatures]);

  // Update Vega
  useEffect(() => {
    if (pcaChart && lasagnaChart) {
      setLoading(false);
      console.log('charts loaded');
    }
  }, [lasagnaChart, pcaChart]);

  // React to image setting
  useEffect(() => {
    console.log('loaded image it seems', pcaImg, lasagnaImg);
  }, [pcaImg, lasagnaImg]);

  const displayAnnotation = (annotation) => {
    main.current.displayAnnotation(annotation);
  };

  const askDelete = (annotation) => {
    annotationPanel.current.askDelete(annotation);
  };

  const askEdit = (annotation) => {
    annotationPanel.current.askEdit(annotation);
  };

  const askAnswer = (annotation) => {
    annotationPanel.current.askAnswer(annotation);
  };

  const saveAnnotation = async (title, text, lines, parentId, currentAnnot) => {
    let newAnnotations = [...annotations];
    const newAnnot = {
      title,
      text,
      lines,
      //user: 5, // User is defined on the backend based on token
    };
    if (currentAnnot) {
      newAnnot.id = currentAnnot.id;
      // Remove old annotation
      newAnnotations = newAnnotations.filter((a) => a.id !== currentAnnot.id);
    }
    if (parentId) newAnnot.parent_id = parentId;

    // Save annotation in DB (create or update)
    // TODO: Save in Database -> STRINGIFY LINES !
    let savedAnnotation;

    // Existing annotation -> update
    if (currentAnnot) {
      savedAnnotation = await Backend.updateAnnotation(
        keycloak.token,
        newAnnot
      );
    } else {
      savedAnnotation = await Backend.createAnnotation(
        keycloak.token,
        albumID,
        newAnnot
      );
    }

    // Refresh the list
    newAnnotations.push(savedAnnotation);
    setAnnotations(newAnnotations);
  };

  const deleteAnnotation = async (id, willBeDeleted = true) => {
    let deletedAnnot = annotations.find((a) => a.id === id);
    deletedAnnot.deleted = willBeDeleted;
    setAnnotations([...annotations]);
    // TODO: Delete in Database

    let deletedAnnotation = await Backend.updateAnnotation(
      keycloak.token,
      deletedAnnot
    );
  };

  const loadCharts = (features) => {
    setupLasagna(features);
    setupPCA(features);
    // Other charts ?
  };

  const setupLasagna = async (features) => {
    let enrichedData = features.map((f) => ({
      ...f,
      Outcome: lasagnaData.outcomes.find((s) => s.PatientID === f.PatientID)
        .Outcome,
    }));

    // Filter status data by selected patients also!
    let filteredStatus = lasagnaData.outcomes.filter((o) =>
      patients
        .filter((p) => p.selected)
        .map((p) => p.name)
        .includes(o.PatientID)
    );

    const properData = {
      features: enrichedData,
      status: filteredStatus,
    };

    const lasagnaSpec = { ...Lasagna };
    lasagnaSpec.data = { name: ['features', 'status'] };

    // Custom sort of patients
    let statusSorted = filteredStatus.sort((p1, p2) => {
      if (p1.Outcome > p2.Outcome) {
        return 1;
      } else if (p1.Outcome < p2.Outcome) {
        return -1;
      } else {
        return p1.PatientID > p2.PatientID;
      }
    });

    let patientIDsSorted = statusSorted.map((p) => p.PatientID);

    for (let chart of lasagnaSpec.vconcat) {
      chart.encoding.x.sort = patientIDsSorted;
    }

    setLasagnaChart({
      data: properData,
      spec: lasagnaSpec,
    });
  };

  const setupPCA = (features) => {
    const pcaData = {
      source: PCA.data[0].values,
    };
    const pcaSpec = { ...PCA };
    pcaSpec.data = [
      { name: 'source' },
      {
        name: 'density',
        source: PCA.data[1].source,
        transform: PCA.data[1].transform,
      },
      {
        name: 'contours',
        source: PCA.data[2].source,
        transform: PCA.data[2].transform,
      },
    ];
    pcaSpec.height = 400;
    pcaSpec.width = 400;
    setPcaChart({
      data: pcaData,
      spec: pcaSpec,
    });
  };

  /*
   ** Only consider the features selected by the user
   */
  /*const filterFeatures = async (features, data) => {
    const selectedFeatures = await features.filter((f) => f.selected);
    const filteredData = [];
    await data.map((d) => {
      selectedFeatures.map((f) => {
        if (d.feature_id === f.key) {
          filteredData.push(d);
        }
      });
    });
    return filteredData;
  };*/

  return (
    <div className="Visualisation">
      <Main
        ref={main}
        charts={[
          {
            id: 'lasagna',
            title: 'Radiomics Heatmap',
            chart: lasagnaChart,
            type: 'vega-lite',
          },
          {
            id: 'pca',
            title: 'Principal Component Analysis (coming soon)',
            chart: pcaChart,
            type: 'vega',
          },
        ]}
        images={[
          {
            id: 'pca',
            img: pcaImg,
          },
          {
            id: 'lasagna',
            img: lasagnaImg,
          },
        ]}
        loading={loading}
        askDelete={askDelete}
        askEdit={askEdit}
        askAnswer={askAnswer}
        setLasagnaImg={setLasagnaImg}
        setPcaImg={setPcaImg}
        featureNames={featureNames}
        setFeatureNames={setFeatureNames}
        modalities={modalities}
        setModalities={setModalities}
        regions={regions}
        setRegions={setRegions}
        patients={patients}
        setPatients={setPatients}
      />
      {/*<SidePanel
        features={features}
        selectedCpt={features.filter((f) => f.selected).length}
        regions={regions}
        modalities={modalities}
        change={change}
        forceChange={change}
        all={selectAll}
      />*/}
      {/*lasagnaImg && pcaImg && (
        <AnnotationPanel
          ref={annotationPanel}
          annotations={annotations}
          displayAnnotation={displayAnnotation}
          saveAnnotation={saveAnnotation}
          deleteAnnotation={deleteAnnotation}
          user={user}
          chartsImg={[
            {
              id: 'pca',
              img: pcaImg,
            },
            {
              id: 'lasagna',
              img: lasagnaImg,
            },
          ]}
        />
      )*/}
    </div>
  );
}
