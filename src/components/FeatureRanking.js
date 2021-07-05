import React from 'react';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { UncontrolledTooltip } from 'reactstrap';

export default function FeatureRanking({ rankFeatures, setRankFeatures }) {
  return (
    <div className="tools">
      <p className="mt-4">
        <strong>Feature ranking</strong>
      </p>
      <div>
        <input
          id="rank-feats"
          type="checkbox"
          value={rankFeatures}
          onChange={(e) => {
            setRankFeatures(e.target.checked);
          }}
        />{' '}
        <label htmlFor="rank-feats">
          Rank by F-value{' '}
          <FontAwesomeIcon icon="info-circle" id="ranking-explanation" />
          <UncontrolledTooltip placement="right" target="ranking-explanation">
            Sort the features (lines of the chart) so that more predictive
            features (when taken individually) will appear at the top and less
            predictive features will appear at the bottom.
          </UncontrolledTooltip>
        </label>
      </div>
    </div>
  );
}
