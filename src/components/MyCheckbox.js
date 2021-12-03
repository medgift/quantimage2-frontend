import React, { useEffect, useRef } from 'react';

export default function MyCheckbox(props) {
  const checkRef = useRef();

  useEffect(() => {
    if (checkRef.current) checkRef.current.indeterminate = props.indeterminate;
  }, [props.indeterminate]);

  return (
    <input
      type="checkbox"
      id={props.id}
      checked={props.checked}
      disabled={props.disabled}
      ref={checkRef}
      style={props.style}
      onClick={props.onClick}
      onChange={props.onChange}
    />
  );
}
