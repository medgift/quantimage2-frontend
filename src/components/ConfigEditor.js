import React, { useEffect, useRef, useState } from 'react';

import Editor from '@monaco-editor/react';

import './ConfigEditor.css';

export const ConfigEditor = ({ config, setCustomConfig, error }) => {
  const [configText, setConfigText] = useState(config);

  const editorRef = useRef(null);
  function handleChange() {
    setCustomConfig(editorRef.current?.getValue());
  }

  function handleMount(editor) {
    editorRef.current = editor;
    editorRef.current.onDidChangeModelContent(handleChange);
  }

  useEffect(() => {
    setConfigText(config);
  }, [config]);

  return (
    <div className={`mt-2 ${error && 'error'}`}>
      <Editor
        height="30vh"
        defaultLanguage="yaml"
        value={configText}
        onMount={handleMount}
      />
    </div>
  );
};
