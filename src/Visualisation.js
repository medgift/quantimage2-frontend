import React, { useEffect, useState, useContext, useRef } from 'react';
import UserContext from './context/UserContext';
import SidePanel from './visualisation/SidePanel';
import Main from './visualisation/Main';
import AnnotationPanel from './visualisation/AnnotationPanel';
import './Visualisation.css';
import backend from './services/backend';
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
  const [features, setFeatures] = useState([]);
  const [regions, setRegions] = useState([]);
  const [modalities, setModalities] = useState([]);

  // Annotations
  const annotationPanel = useRef(null);
  const [annotations, setAnnotations] = useState([]);

  // Charts
  const [pcaChart, setPcaChart] = useState(null);
  const [lasagnaData, setLasagnaData] = useState(null);
  const [lasagnaChart, setLasagnaChart] = useState(null);
  const [pcaImg, setPcaImg] = useState(null);
  const [lasagnaImg, setLasagnaImg] = useState(null);

  // Get features & annotations
  useEffect(() => {
    async function loadLasagnaChartData() {
      const newFeatures = [];
      const data = await backend.lasagna(keycloak.token, albumID);
      const featuresNames = [
        ...new Set(data.features.map((f) => f.feature_id)),
      ];
      featuresNames.map((f) => {
        const feature = {
          key: f,
          name: data.features.find((x) => x.feature_id === f).feature_name,
          selected: true,
        };
        newFeatures.push(feature);
      });

      setModalities([...new Set(data.features.map((m) => m.Modality))]);
      setRegions([...new Set(data.features.map((r) => r.ROI))]);
      setLasagnaData(data);
      setFeatures(newFeatures);
    }

    async function loadAnnotations() {
      let annotations = await backend.annotations(keycloak.token, albumID);
      setAnnotations(annotations);
    }

    loadLasagnaChartData();
    loadAnnotations();
  }, []);

  // Refresh charts on feature changes
  useEffect(() => {
    if (lasagnaData) loadCharts(features);
  }, [features]);

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
      savedAnnotation = await backend.updateAnnotation(
        keycloak.token,
        newAnnot
      );
    } else {
      savedAnnotation = await backend.createAnnotation(
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

    let deletedAnnotation = await backend.updateAnnotation(
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
    let enrichedData = lasagnaData.features.map((f) => ({
      ...f,
      Outcome: lasagnaData.outcomes.find((s) => s.PatientID === f.PatientID)
        .Outcome,
    }));

    const properData = {
      features: await filterFeatures(features, enrichedData),
      status: lasagnaData.outcomes,
    };
    console.log(properData.features);
    const lasagnaSpec = { ...Lasagna };
    lasagnaSpec.data = { name: ['features', 'status'] };
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
    pcaSpec.height = 500;
    pcaSpec.width = 500;
    setPcaChart({
      data: pcaData,
      spec: pcaSpec,
    });
  };

  /*
   ** Only consider the features selected by the user
   */
  const filterFeatures = async (features, data) => {
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
  };

  const change = (feature, force = null) => {
    if (force !== null) {
      features.find((f) => f.key === feature.key).selected = force;
    } else {
      features.find((f) => f.key === feature.key).selected = !feature.selected;
    }
    setFeatures([...features]);
  };

  // Bulk select / deselect
  const selectAll = (all) => {
    features.map((f) => {
      f.selected = all;
    });
    setFeatures([...features]);
  };

  return (
    <div className="Visualisation">
      <SidePanel
        features={features}
        selectedCpt={features.filter((f) => f.selected).length}
        regions={regions}
        modalities={modalities}
        change={change}
        forceChange={change}
        all={selectAll}
      />

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
            title: 'Principle Component Analysis',
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
      />
      {lasagnaImg && pcaImg && (
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
      )}
    </div>
  );
}
