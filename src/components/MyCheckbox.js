import React from 'react';
import { Checkbox } from '@material-ui/core';

export default function MyCheckbox(props) {
  return (
    <Checkbox
      color="primary"
      indeterminate={props.isIndeterminate}
      id={props.id}
      checked={props.checked}
      onChange={props.onChange}
      disabled={props.disabled}
    />
  );
}
