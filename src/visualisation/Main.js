import React, {
  forwardRef,
  useImperativeHandle,
  useState,
  useEffect,
  createRef,
  useMemo,
} from 'react';
import {
  Button,
  Modal,
  ModalBody,
  ModalHeader,
  Nav,
  NavItem,
  NavLink,
  TabContent,
  TabPane,
  UncontrolledTooltip,
} from 'reactstrap';
import VegaChart from './VegaChart';
import Loading from './Loading';
import DisplayedAnnotation from './DisplayedAnnotation';
import useDynamicRefs from 'use-dynamic-refs';
import classnames from 'classnames';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import * as ss from 'simple-statistics';

import './Main.scss';
import { NON_FEATURE_FIELDS } from '../Train';
import Checkbox from '../components/Checkbox';

const PYRADIOMICS_PREFIX = 'original';

const Main = (props, ref) => {
  const [getRef, setRef] = useDynamicRefs();

  const [activeTab, setActiveTab] = useState(props.charts[0].id);

  const [isFeatureGroupModalOpen, setIsFeatureGroupModalOpen] = useState(false);

  const [currentFeatureGroup, setCurrentFeatureGroup] = useState(null);

  // Feature selection
  const [corrThreshold, setCorrThreshold] = useState(0.5);
  const [dropCorrelatedFeatures, setDropCorrelatedFeatures] = useState(false);

  // Feature ranking
  const [nRankedFeatures, setNRankedFeatures] = useState(null);

  // React to "drop correlated features" change
  useEffect(() => {
    if (
      !props.loading &&
      props.featureNames.length > 0 &&
      props.charts.length > 0 &&
      props.charts[0].chart &&
      props.charts[0].chart.data.features.length > 0
    ) {
      const features = props.charts[0].chart.data.features.reduce(
        (acc, curr) => {
          if (!acc[curr.feature_name]) acc[curr.feature_name] = [];

          acc[curr.feature_name].push(curr.feature_value);

          return acc;
        },
        {}
      );

      if (
        dropCorrelatedFeatures &&
        Object.keys(features).length === props.featureNames.length
      ) {
        // We want to have all features before filtering
        if (Object.keys(features).length < props.featureNames.length) return [];

        // We need at least 2 samples!!!
        if (
          Object.keys(features).length > 0 &&
          features[Object.keys(features)[0]].length < 2
        ) {
          return [];
        }

        // Build correlation matrix
        let corrMatrix = [];
        for (let i = 0; i < Object.keys(features).length; i++) {
          let corrArray = [];
          for (let j = 0; j < Object.keys(features).length; j++) {
            let featuresI = [...features[Object.keys(features)[i]]];
            let featuresJ = [...features[Object.keys(features)[j]]];

            // Check if the array needs to be padded (e.g. PET features don't exist for CT)
            if (featuresI.length > featuresJ.length) {
              fillArray(NaN, featuresJ, featuresI.length);
            } else if (featuresJ.length > featuresI.length) {
              fillArray(NaN, featuresI, featuresJ.length);
            }

            corrArray.push(
              Math.abs(+ss.sampleCorrelation(featuresI, featuresJ).toFixed(4))
            );
          }

          corrMatrix.push(corrArray);
        }

        let featuresIndexDropList = [];

        // Select features to drop
        for (let i = 0; i < corrMatrix.length; i++) {
          for (let j = i + 1; j < corrMatrix[i].length; j++) {
            if (
              corrMatrix[i][j] >= corrThreshold &&
              !featuresIndexDropList.includes(i) &&
              !featuresIndexDropList.includes(j)
            ) {
              if (corrMatrix[i] >= corrMatrix[j]) {
                featuresIndexDropList.push(i);
              } else {
                featuresIndexDropList.push(j);
              }
            }
          }
        }

        let featuresToDrop = featuresIndexDropList.map(
          (i) => Object.keys(features)[i]
        );

        console.log('features to drop', featuresToDrop);

        disableFeatures(featuresToDrop);
      }
    }
  }, [
    dropCorrelatedFeatures,
    corrThreshold,
    props.charts,
    props.loading,
    props.featureNames,
  ]);

  // TODO - We can filter once the feature selection is more comprehensive (e.g. hierarchical)
  // React to "keep n ranked features" change
  /*useEffect(() => {
    if (props.featureNames.length > 0 && nRankedFeatures === null)
      setNRankedFeatures(Math.ceil(props.featureNames.length / 2));

    let selectedFeatures = props.featureNames.filter((f) => f.selected);

    if (nRankedFeatures > selectedFeatures.length)
      setNRankedFeatures(selectedFeatures.length);
  }, [props.featureNames, props.rankFeatures]);*/

  const toggle = (tab) => {
    if (activeTab !== tab) setActiveTab(tab);
  };

  const toggleModal = () => {
    setIsFeatureGroupModalOpen((o) => !o);
  };

  const [displayAnnotation, setDisplayedAnnotation] = useState(null);

  /*useEffect(() => {
    const temp = [];
    props.images.map((img, index) => {
      convertURIToImageData(props.images[index].img).then((image) => {
        image.id = img.id;
        image.raw = img.img;
        temp.push(image);
      });
    });
    setImages(temp);
  }, [props.images]);*/

  useImperativeHandle(ref, () => ({
    /*getChart(type) {
      return getRef(type + '-chart').current.getChart(type);
    },*/
    displayAnnotation(annotation) {
      setDisplayedAnnotation(annotation);
    },
    closeAnnotation() {
      closeAnnotation();
    },
  }));

  const closeAnnotation = () => {
    setDisplayedAnnotation(null);
  };

  const deleteAnnotation = () => {
    setDisplayedAnnotation(null);
    props.askDelete(displayAnnotation);
  };

  const editAnnotation = () => {
    setDisplayedAnnotation(null);
    props.askEdit(displayAnnotation);
  };

  const answerAnnotation = () => {
    setDisplayedAnnotation(null);
    props.askAnswer(displayAnnotation);
  };

  const [featureGroups, setFeatureGroups] = useState([]);

  const updateFeatureGroups = (newFeatureGroups) => {
    setFeatureGroups(newFeatureGroups);
    let featureNames = [...props.featureNames];

    /* TODO - Improve this, it's far from optimal! */
    for (let featureName of featureNames) {
      for (let featureGroup of newFeatureGroups) {
        if (
          featureName.name.startsWith(featureGroup.name) ||
          featureName.name.startsWith(
            `${PYRADIOMICS_PREFIX}_${featureGroup.name}`
          )
        )
          featureName.selected = featureGroup.selected;
      }
    }

    props.setFeatureNames(featureNames);
  };

  useEffect(() => {
    setFeatureGroups(getFeatureGroups(props.featureNames));
  }, [props.featureNames]);

  const handleCreateCollectionClick = () => {
    props.setSelectedModalities(
      props.modalities.filter((m) => m.selected).map((m) => m.name)
    );
    props.setSelectedROIs(
      props.regions.filter((r) => r.selected).map((r) => r.name)
    );
    props.setSelectedPatients(
      props.patients.filter((p) => p.selected).map((p) => p.name)
    );
    props.setSelectedFeatures(
      props.featureNames.filter((f) => f.selected).map((f) => f.name)
    );
    props.toggleTab('create');
  };

  const handleFeatureSubgroupClick = (e, featureGroup) => {
    setCurrentFeatureGroup(featureGroup);
    toggleModal();
  };

  const toggleFeature = (featureName) => {
    let updatedFeatures = [...props.featureNames];

    let featureToToggle = updatedFeatures.find((f) => f.name === featureName);
    featureToToggle.selected = !featureToToggle.selected;

    props.setFeatureNames(updatedFeatures);
  };

  const disableFeatures = (featuresToDrop) => {
    let updatedFeatures = [...props.featureNames];

    for (let feature of updatedFeatures) {
      feature.selected = featuresToDrop.includes(feature.name) ? false : true;
    }

    props.setFeatureNames(updatedFeatures);
  };

  return (
    <>
      <div className="Main-Visualization">
        {displayAnnotation ? (
          <>
            <DisplayedAnnotation
              annotation={displayAnnotation}
              close={closeAnnotation}
              delete={deleteAnnotation}
              edit={editAnnotation}
              answer={answerAnnotation}
              images={props.images}
            />
          </>
        ) : props.loading ? (
          <Loading color="dark">
            <h3>Loading Charts...</h3>
          </Loading>
        ) : (
          <>
            <Nav pills>
              {props.charts.map((c) => (
                <NavItem key={c.id}>
                  <NavLink
                    className={classnames({ active: activeTab === c.id })}
                    onClick={() => {
                      toggle(c.id);
                    }}
                  >
                    {c.title}
                  </NavLink>
                </NavItem>
              ))}
            </Nav>
            {activeTab === 'lasagna' && (
              <>
                <div className="filters-visualization">
                  <div className="filter-visualization">
                    <div>Modalities</div>
                    <FilterList
                      label="modality"
                      values={props.modalities}
                      setter={props.setModalities}
                    />
                  </div>
                  <div className="filter-visualization">
                    <div>ROIs</div>
                    <FilterList
                      label="roi"
                      values={props.regions}
                      setter={props.setRegions}
                    />
                  </div>
                  <div className="filter-visualization">
                    <div>Patients</div>
                    <FilterList
                      label="patient"
                      values={props.patients}
                      setter={props.setPatients}
                    />
                  </div>
                  <div className="filter-visualization">
                    <div>Feature Groups</div>
                    <FilterList
                      label="featureGroup"
                      values={featureGroups}
                      setter={updateFeatureGroups}
                      subgroups={true}
                      subgroupClick={handleFeatureSubgroupClick}
                      disabled={dropCorrelatedFeatures}
                    />
                  </div>
                </div>
                {
                  /*(props.modalities.filter((m) => !m.selected).length > 0 ||
                  props.regions.filter((r) => !r.selected).length > 0 ||
                  props.patients.filter((p) => !p.selected).length > 0 ||
                  featureGroups.filter((g) => !g.selected).length > 0) &&*/
                  <div>
                    <Button color="link" onClick={handleCreateCollectionClick}>
                      + Create collection with these settings
                    </Button>
                  </div>
                }
              </>
            )}
            {activeTab === 'pca' && <h2>Coming soon...</h2>}
            <div className="charts">
              <TabContent activeTab={activeTab}>
                {props.charts.map((c) => {
                  return (
                    <TabPane key={c.id} tabId={c.id}>
                      <div id={c.id} key={c.id} className="d-flex">
                        <div>
                          <VegaChart
                            ref={setRef(c.id + '-chart')}
                            title={c.title}
                            chart={c.chart}
                            type={c.type}
                            setImage={
                              c.id === 'lasagna'
                                ? props.setLasagnaImg
                                : props.setPcaImg
                            }
                          />
                          <div>
                            <small>
                              * Feature values are standardized and the scale is
                              clipped to [-2, 2]. Outliers will appear either in
                              white ({'<-2'}) or black (>2).
                            </small>
                          </div>
                        </div>
                        <div className="tools flex-grow-1">
                          <p className="mt-4">
                            <strong>Feature selection</strong>
                          </p>
                          <div>
                            <input
                              id="drop-corr"
                              type="checkbox"
                              value={dropCorrelatedFeatures}
                              onChange={(e) => {
                                if (e.target.checked) disableFeatures([]);
                                setDropCorrelatedFeatures(e.target.checked);
                              }}
                            />{' '}
                            <label htmlFor="drop-corr">
                              Drop correlated features{' '}
                              <FontAwesomeIcon
                                icon="info-circle"
                                id="corr-explanation"
                              />
                              <UncontrolledTooltip
                                placement="right"
                                target="corr-explanation"
                              >
                                Allows to deselect highly correlated features
                                (with redundant information).
                              </UncontrolledTooltip>
                            </label>
                          </div>
                          <div>
                            <label htmlFor="corr-threshold">
                              Correlation Threshold{' '}
                              <FontAwesomeIcon
                                icon="info-circle"
                                id="thresh-explanation"
                              />
                              <UncontrolledTooltip
                                placement="right"
                                target="thresh-explanation"
                              >
                                With a lower threshold, fewer features will be
                                kept.
                                <br />
                                With a higher threshold, more features will be
                                kept.
                              </UncontrolledTooltip>
                            </label>
                            <br />
                            <input
                              id="corr-threshold"
                              type="range"
                              min={0.1}
                              max={0.9}
                              step={0.1}
                              disabled={!dropCorrelatedFeatures}
                              onChange={(e) => {
                                setCorrThreshold(+e.target.value);
                              }}
                              onMouseUp={(e) => {
                                disableFeatures([]);
                              }}
                              value={corrThreshold}
                              className="slider"
                            />
                            <span>{corrThreshold}</span>
                          </div>
                          <hr />
                          <p className="mt-4">
                            <strong>Feature ranking</strong>
                          </p>
                          <div>
                            <input
                              id="rank-feats"
                              type="checkbox"
                              value={props.rankFeatures}
                              onChange={(e) => {
                                props.setRankFeatures(e.target.checked);
                              }}
                            />{' '}
                            <label htmlFor="rank-feats">
                              Rank by F-value{' '}
                              <FontAwesomeIcon
                                icon="info-circle"
                                id="ranking-explanation"
                              />
                              <UncontrolledTooltip
                                placement="right"
                                target="ranking-explanation"
                              >
                                Sort the features (lines of the chart) so that
                                more predictive features (when taken
                                individually) will appear at the top and less
                                predictive features will appear at the bottom.
                              </UncontrolledTooltip>
                            </label>
                          </div>
                          {/* TODO - Put this back once it's possible to select specific features for a given modality/ROI*/}
                          {/*
                          <div>
                            <label htmlFor="n-features">
                              Number of features to keep
                            </label>
                            <br />
                            <input
                              id="n-features"
                              type="range"
                              min={1}
                              max={
                                props.featureNames.filter((f) => f.selected)
                                  .length
                              }
                              step={1}
                              onChange={(e) => {
                                setNRankedFeatures(+e.target.value);
                              }}
                              onMouseUp={(e) => {
                                disableFeatures([]);
                              }}
                              value={nRankedFeatures}
                              className="slider"
                            />
                            <span>{nRankedFeatures}</span>
                          </div>
                          */}
                        </div>
                      </div>
                    </TabPane>
                  );
                })}
              </TabContent>
            </div>
            <Modal isOpen={isFeatureGroupModalOpen} toggle={toggleModal}>
              <ModalHeader toggle={toggleModal}>
                Select features in "{currentFeatureGroup}"
              </ModalHeader>
              <ModalBody>
                <div className="feature-selection">
                  <ul>
                    {props.featureNames
                      .filter(
                        (f) =>
                          f.name.startsWith(currentFeatureGroup) ||
                          f.name.startsWith(
                            `${PYRADIOMICS_PREFIX}_${currentFeatureGroup}`
                          )
                      )
                      .map((f) => (
                        <li>
                          <input
                            key={f.name}
                            id={`select-feature-${f.name}`}
                            type="checkbox"
                            checked={f.selected}
                            onChange={() => toggleFeature(f.name)}
                          />{' '}
                          <label for={`select-feature-${f.name}`}>
                            {f.name}
                          </label>
                        </li>
                      ))}
                  </ul>
                </div>
              </ModalBody>
            </Modal>
          </>
        )}
      </div>
    </>
  );
};

function getFeatureGroups(featureNames) {
  let featureGroups = {};
  let currentFeatureGroup = '';

  for (let featureName of featureNames) {
    // TODO - Make this more elegant, maybe a convention for feature names is needed
    // Group PyRadiomics features by the second level,
    // first level for other backends so far
    let featureGroupName;

    let { name, selected } = featureName;

    // PET - Special case
    if (name.startsWith('PET')) {
      featureGroupName = 'PET';
    } else if (name.startsWith(PYRADIOMICS_PREFIX)) {
      featureGroupName = name.split('_')[1];
    } else {
      featureGroupName = name.split('_')[0] + '_' + name.split('_')[1];
    }

    if (featureGroupName !== currentFeatureGroup) {
      featureGroups[featureGroupName] = [];
      currentFeatureGroup = featureGroupName;
    }

    featureGroups[featureGroupName].push(name);
  }

  return Object.keys(featureGroups).map((fg) => ({
    name: fg,
    selected: featureNames
      .filter((f) => featureGroups[fg].includes(f.name))
      .every((f) => f.selected),
    isIndeterminate:
      featureNames
        .filter((f) => featureGroups[fg].includes(f.name))
        .every((f) => f.selected) === false &&
      featureNames
        .filter((f) => featureGroups[fg].includes(f.name))
        .every((f) => !f.selected) === false,
  }));
}

function FilterList({
  label,
  values,
  setter,
  subgroups,
  subgroupClick,
  disabled,
}) {
  const toggleValue = (name, checked, values, setter) => {
    let newValues = [...values];

    let valueToUpdate = newValues.find((v) => v.name === name);

    valueToUpdate.selected = checked;

    setter(newValues);
  };

  const handleAllClick = (selected) => {
    let newValues = [...values];

    let updatedValues = newValues.map((v) => ({ ...v, selected: selected }));

    setter(updatedValues);
  };

  return (
    <>
      <div>
        <Button
          color="link"
          onClick={() => handleAllClick(true)}
          disabled={disabled}
        >
          All
        </Button>{' '}
        |{' '}
        <Button
          color="link"
          onClick={() => handleAllClick(false)}
          disabled={disabled}
        >
          None
        </Button>{' '}
      </div>
      <ul>
        {values.map((v) => (
          <li key={`${label}-${v.name}`}>
            <Checkbox
              id={`${label}-${v.name}`}
              checked={v.selected === true}
              onChange={(e) => {
                toggleValue(v.name, e.target.checked, values, setter);
              }}
              isIndeterminate={v.isIndeterminate ? v.isIndeterminate : false}
              disabled={disabled}
            />{' '}
            <label htmlFor={`${label}-${v.name}`} disabled={disabled}>
              {v.name}
            </label>
            {subgroups && (
              <Button
                color="link"
                onClick={(e) => subgroupClick(e, v.name)}
                disabled={disabled}
              >
                +
              </Button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

function fillArray(value, arr, targetLength) {
  while (arr.length !== targetLength) {
    arr.push(value);
  }
  return arr;
}

export default forwardRef(Main);
