import React, { useState } from 'react';
import { Input } from 'reactstrap';
import { CLINCAL_FEATURE_TYPES, CLINICAL_FEATURE_ENCODING } from '../config/constants';

import './ClinicalFeatureTable.css';

export const DynamicTable = () => {
  const [editableClinicalFeatureDefinitions, setEditableClinicalFeatureDefinitions] = useState({
    "Age": { "Type": CLINCAL_FEATURE_TYPES[0], "Encoding": "None" },
    "Gender": { "Type": CLINCAL_FEATURE_TYPES[0], "Encoding": "Categorical" }
  });

  const handleInputChange = (e, feature_name, feature_type) => {
    let editableClinicalFeatureDefinitionsToUpdate = { ...editableClinicalFeatureDefinitions };
    editableClinicalFeatureDefinitionsToUpdate[feature_name][feature_type] = e.target.value;
    setEditableClinicalFeatureDefinitions(editableClinicalFeatureDefinitionsToUpdate)
  };

  const testPrint = () => {
    for (let feature_name in editableClinicalFeatureDefinitions) {
      console.log(feature_name);
      console.log(editableClinicalFeatureDefinitions[feature_name]);
    }
  };

  const testSave = () => {
  };

  return (
    <div>
      <table className="table-fixed">
        <thead>
          <tr>
            <th>Clinical Feature</th>
            <th>Type</th>
            <th>Encoding</th>
          </tr>
        </thead>
        <tbody>
          {Object.keys(editableClinicalFeatureDefinitions).map(feature_name => (
            <tr key={feature_name}>
              <td>{feature_name}</td>
              <td>
                <Input
                  type="select"
                  id="type_list"
                  name="type_list"
                  value={editableClinicalFeatureDefinitions[feature_name]["Type"]}
                  onChange={(event) => handleInputChange(event, feature_name, "Type")}
                >
                  {CLINCAL_FEATURE_TYPES.map(feat_type => <option key={feat_type} value={feat_type}>{feat_type}</option>)};
                </Input>
              </td>
              <td>
                <Input
                type="select"
                id="encoding_list"
                name="encoding_list"
                value={editableClinicalFeatureDefinitions[feature_name]["Encoding"]}
                onChange={(event) => handleInputChange(event, feature_name, "Encoding")}
              >
                {CLINICAL_FEATURE_ENCODING.map(encoding_type => <option key={encoding_type} value={encoding_type}>{encoding_type}</option>)};
              </Input>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
