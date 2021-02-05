import React from 'react';

export default function Checkbox(props) {
  const setCheckboxRef = (checkbox) => {
    if (checkbox) {
      checkbox.indeterminate = props.isIndeterminate;
    }
  };

  return (
    <input
      type="checkbox"
      ref={setCheckboxRef}
      id={props.id}
      checked={props.checked}
      onChange={props.onChange}
    />
  );
}
