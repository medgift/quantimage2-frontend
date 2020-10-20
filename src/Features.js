import React, { useState, useEffect, forwardRef } from 'react';
import { useParams } from 'react-router-dom';
import Backend from './services/backend';
import {
  Button,
  ButtonGroup,
  ListGroup,
  ListGroupItem,
  Spinner,
} from 'reactstrap';
import { Link } from 'react-router-dom';
import FeaturesModal from './FeaturesModal';
import { useKeycloak } from 'react-keycloak';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { downloadFeatureSet } from './utils/feature-utils';
import MaterialTable from 'material-table';

import AddBox from '@material-ui/icons/AddBox';
import ArrowDownward from '@material-ui/icons/ArrowDownward';
import Check from '@material-ui/icons/Check';
import ChevronLeft from '@material-ui/icons/ChevronLeft';
import ChevronRight from '@material-ui/icons/ChevronRight';
import Clear from '@material-ui/icons/Clear';
import DeleteOutline from '@material-ui/icons/DeleteOutline';
import Edit from '@material-ui/icons/Edit';
import FilterList from '@material-ui/icons/FilterList';
import FirstPage from '@material-ui/icons/FirstPage';
import LastPage from '@material-ui/icons/LastPage';
import Remove from '@material-ui/icons/Remove';
import SaveAlt from '@material-ui/icons/SaveAlt';
import Search from '@material-ui/icons/Search';
import ViewColumn from '@material-ui/icons/ViewColumn';
import { NON_FEATURE_FIELDS } from './Train';
import FeatureTable from './components/FeatureTable';

import './Features.css';
import CollectionSelection from './components/CollectionSelection';
import Kheops from './services/kheops';

const tableIcons = {
  Add: forwardRef((props, ref) => <AddBox {...props} ref={ref} />),
  Check: forwardRef((props, ref) => <Check {...props} ref={ref} />),
  Clear: forwardRef((props, ref) => <Clear {...props} ref={ref} />),
  Delete: forwardRef((props, ref) => <DeleteOutline {...props} ref={ref} />),
  DetailPanel: forwardRef((props, ref) => (
    <ChevronRight {...props} ref={ref} />
  )),
  Edit: forwardRef((props, ref) => <Edit {...props} ref={ref} />),
  Export: forwardRef((props, ref) => <SaveAlt {...props} ref={ref} />),
  Filter: forwardRef((props, ref) => <FilterList {...props} ref={ref} />),
  FirstPage: forwardRef((props, ref) => <FirstPage {...props} ref={ref} />),
  LastPage: forwardRef((props, ref) => <LastPage {...props} ref={ref} />),
  NextPage: forwardRef((props, ref) => <ChevronRight {...props} ref={ref} />),
  PreviousPage: forwardRef((props, ref) => (
    <ChevronLeft {...props} ref={ref} />
  )),
  ResetSearch: forwardRef((props, ref) => <Clear {...props} ref={ref} />),
  Search: forwardRef((props, ref) => <Search {...props} ref={ref} />),
  SortArrow: forwardRef((props, ref) => <ArrowDownward {...props} ref={ref} />),
  ThirdStateCheck: forwardRef((props, ref) => <Remove {...props} ref={ref} />),
  ViewColumn: forwardRef((props, ref) => <ViewColumn {...props} ref={ref} />),
};

function Features({ history, match, kheopsError }) {
  const [keycloak] = useKeycloak();

  const { albumID } = useParams();

  const [album, setAlbum] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [featureExtractionID, setFeatureExtractionID] = useState(null);
  const [features, setFeatures] = useState(null);
  const [collections, setCollections] = useState(null);
  const [activeCollection, setActiveCollection] = useState(null);
  const [header, setHeader] = useState(null);

  // Get album
  useEffect(() => {
    async function getAlbum() {
      try {
        let album = await Kheops.album(keycloak.token, albumID);
        setAlbum(album);
      } catch (err) {
        //setKheopsError(true);
        console.error(err);
      }
    }

    getAlbum();
  }, []);

  // Get collections
  useEffect(() => {
    async function getCollections() {
      const collections = await Backend.collectionsByExtraction(
        keycloak.token,
        featureExtractionID
      );

      setCollections(collections);
    }
    if (featureExtractionID) getCollections();
  }, [featureExtractionID]);

  // Get features
  useEffect(() => {
    async function getFeatures() {
      setIsLoading(true);

      console.log('Show features for albumID:', albumID);

      const latestExtraction = await Backend.extractions(
        keycloak.token,
        albumID
      );

      setFeatureExtractionID(latestExtraction.id);

      let features;
      let header;
      if (!activeCollection) {
        const {
          features: allFeatures,
          header: allHeader,
        } = await Backend.extractionFeatureDetails(
          keycloak.token,
          latestExtraction.id
        );

        features = allFeatures;
        header = allHeader;
      } else {
        const {
          features: collectionFeatures,
          header: collectionHeader,
        } = await Backend.extractionCollectionFeatureDetails(
          keycloak.token,
          latestExtraction.id,
          +activeCollection
        );

        features = collectionFeatures;
        header = collectionHeader;
      }

      setFeatures(features);
      setHeader(header);

      setIsLoading(false);
    }

    getFeatures();
  }, [albumID, activeCollection]);

  return (
    <>
      <h2>Feature Collection</h2>
      {!isLoading && album ? (
        <div style={{ textAlign: 'center' }}>
          {features.length > 0 && (
            <div className="features-wrapper">
              <div className="collections-list">
                <CollectionSelection
                  album={album.name}
                  collections={collections}
                  activeCollection={activeCollection}
                  setActiveCollection={setActiveCollection}
                />
              </div>
              <div className="features-table">
                <FeatureTable
                  features={features}
                  header={header}
                  featureExtractionID={featureExtractionID}
                  setCollections={setCollections}
                  setActiveCollection={setActiveCollection}
                />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <Spinner />
        </div>
      )}
    </>
  );
}

export default Features;
