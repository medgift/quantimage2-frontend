import React from 'react';
import { CustomInput, FormGroup, Label } from 'reactstrap';

export default function ConfigImport({
  setCustomConfig,
  setShowImport,
  setShowEditor,
}) {
  const readConfigFile = async (e) => {
    e.preventDefault();
    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target.result;
      setCustomConfig(text);
      setShowImport(false);
      setShowEditor(true);
    };
    reader.readAsText(e.target.files[0]);
  };

  return (
    <FormGroup style={{ textAlign: 'left' }}>
      <Label for="exampleCustomFileBrowser">
        Import YAML Configuration File
      </Label>
      <CustomInput
        type="file"
        id="exampleCustomFileBrowser"
        name="customFile"
        label="Select a YAML configuration file..."
        accept=".yaml,.yml,application/x-yaml,text/yaml"
        onChange={(e) => readConfigFile(e)}
      />
    </FormGroup>
  );
}
