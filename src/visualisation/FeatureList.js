import React, { useState, useEffect } from 'react';
import { MenuItem, SubMenu } from 'react-pro-sidebar';
import { Row, Col, Button, ButtonGroup } from 'reactstrap';
import './FeatureList.scss';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const FeatureList = (props) => {
  const [parentFeatures, setParentFeatures] = useState([]);

  const green = '#75BD4B';
  const red = '#F0706A';

  // Prepare Features display
  useEffect(() => {
    let features = [];
    props.modalities.map((m) => {
      props.regions.map((r) => {
        const modality = {
          name: getMenuName(m, r),
          items: [],
        };
        features.push(modality);
      });
    });
    props.features.map((f) => {
      const modality = f.key.split('-')[0];
      const region = f.key.split('-')[1].split('_')[0];
      const feature = {
        key: f.key,
        name: f.name,
        selected: f.selected,
      };
      features.map((i) => {
        if (i.name === getMenuName(modality, region)) i.items.push(feature);
      });
    });
    setParentFeatures(features);
  }, [props.features, props.regions, props.modalities]);

  const bulkSelect = (feature, selected) => {
    feature.items.map((i) => {
      props.forceChange(i, selected);
    });
  };

  const formatName = (name, size) => {
    return name.length > size ? name.substring(0, size) + '...' : name;
  };

  const getMenuName = (modality, region) => {
    return modality + ' - ' + region;
  };

  return (
    <>
      <div className="FeatureList">
        {parentFeatures.map((f) => {
          return f.items ? (
            <SubMenu title={f.name} key={f.name} className="SidePanelSubMenu">
              <MenuItem className="text-center border-bottom border-light">
                <ButtonGroup size="sm">
                  <Button color="success" onClick={() => bulkSelect(f, true)}>
                    Tout
                  </Button>
                  <Button color="danger" onClick={() => bulkSelect(f, false)}>
                    Aucun
                  </Button>
                </ButtonGroup>
              </MenuItem>
              {f.items.map((i) => {
                return (
                  <MenuItem
                    key={i.key}
                    onClick={() => props.change(i)}
                    className="SidePanelItem"
                  >
                    <Row noGutters>
                      <Col xs="10">
                        <small className={i.selected ? 'selected' : ''}>
                          {formatName(i.name, 32)}
                        </small>
                      </Col>
                      <Col style={{ textAlign: 'right' }}>
                        {i.selected ? (
                          <FontAwesomeIcon icon="check" color={green} />
                        ) : (
                          <FontAwesomeIcon icon="times" color={red} />
                        )}
                      </Col>
                    </Row>
                  </MenuItem>
                );
              })}
            </SubMenu>
          ) : (
            <MenuItem
              key={f.key}
              onClick={() => props.change(f)}
              className="SidePanelItem"
            >
              <Row>
                <Col xs="8">
                  <span className={f.selected ? 'selected' : ''}>
                    {formatName(f.name, 16)}
                  </span>
                </Col>
                <Col style={{ textAlign: 'right' }}>
                  {f.selected ? (
                    <FontAwesomeIcon icon="check" color={green} />
                  ) : (
                    <FontAwesomeIcon icon="times" color={red} />
                  )}
                </Col>
              </Row>
            </MenuItem>
          );
        })}
      </div>
    </>
  );
};

export default FeatureList;
