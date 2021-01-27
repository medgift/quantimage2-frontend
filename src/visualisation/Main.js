import React, {
  forwardRef,
  useImperativeHandle,
  useState,
  useEffect,
  createRef,
  useMemo,
} from 'react';
import { Button, Nav, NavItem, NavLink, TabContent, TabPane } from 'reactstrap';
import VegaChart from './VegaChart';
import Loading from './Loading';
import DisplayedAnnotation from './DisplayedAnnotation';
import useDynamicRefs from 'use-dynamic-refs';
import classnames from 'classnames';

import './Main.scss';
import { NON_FEATURE_FIELDS } from '../Train';

const PYRADIOMICS_PREFIX = 'original';

const Main = (props, ref) => {
  const [getRef, setRef] = useDynamicRefs();

  const [activeTab, setActiveTab] = useState(props.charts[0].id);

  const toggle = (tab) => {
    if (activeTab !== tab) setActiveTab(tab);
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
    props.setSelectedFeatureGroups(
      featureGroups.filter((g) => g.selected).map((g) => g.name)
    );
    props.toggleTab('create');
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
                <NavItem>
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
                    />
                  </div>
                </div>
                {(props.modalities.filter((m) => !m.selected).length > 0 ||
                  props.regions.filter((r) => !r.selected).length > 0 ||
                  props.patients.filter((p) => !p.selected).length > 0 ||
                  featureGroups.filter((g) => !g.selected).length > 0) && (
                  <div>
                    <Button color="link" onClick={handleCreateCollectionClick}>
                      + Create collection with these settings
                    </Button>
                  </div>
                )}
              </>
            )}
            {activeTab === 'pca' && <h2>Coming soon...</h2>}
            <div className="charts">
              <TabContent activeTab={activeTab}>
                {props.charts.map((c) => {
                  return (
                    <TabPane tabId={c.id}>
                      <div id={c.id} key={c.id}>
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
                      </div>
                    </TabPane>
                  );
                })}
              </TabContent>
            </div>
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

    if (name.startsWith(PYRADIOMICS_PREFIX)) {
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
    selected: featureNames.find((fn) => fn.name === featureGroups[fg][0])
      .selected,
  }));
}

function FilterList({ label, values, setter }) {
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
        <Button color="link" onClick={() => handleAllClick(true)}>
          All
        </Button>{' '}
        |{' '}
        <Button color="link" onClick={() => handleAllClick(false)}>
          None
        </Button>{' '}
      </div>
      <ul>
        {values.map((v) => (
          <li key={`${label}-${v.name}`}>
            <input
              id={`${label}-${v.name}`}
              type="checkbox"
              checked={v.selected}
              onChange={(e) => {
                toggleValue(v.name, e.target.checked, values, setter);
              }}
            />{' '}
            <label htmlFor={`${label}-${v.name}`}>{v.name}</label>
          </li>
        ))}
      </ul>
    </>
  );
}

export default forwardRef(Main);
