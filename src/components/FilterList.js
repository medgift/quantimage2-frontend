import React from 'react';
import { Button } from 'reactstrap';
import MyCheckbox from './MyCheckbox';

export default function FilterList({
  label,
  values,
  setter,
  subgroups,
  subgroupClick,
  disabled,
}) {
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
        <Button
          color="link"
          onClick={() => handleAllClick(true)}
          disabled={disabled}
        >
          All
        </Button>{' '}
        |{' '}
        <Button
          color="link"
          onClick={() => handleAllClick(false)}
          disabled={disabled}
        >
          None
        </Button>{' '}
      </div>
      <ul>
        {values.map((v) => (
          <li key={`${label}-${v.name}`}>
            <MyCheckbox
              id={`${label}-${v.name}`}
              checked={v.selected === true}
              onChange={(e) => {
                toggleValue(v.name, e.target.checked, values, setter);
              }}
              isIndeterminate={v.isIndeterminate ? v.isIndeterminate : false}
              disabled={disabled}
            />{' '}
            <label htmlFor={`${label}-${v.name}`} disabled={disabled}>
              {v.name}
            </label>
            {subgroups && (
              <Button
                color="link"
                onClick={(e) => subgroupClick(e, v.name)}
                disabled={disabled}
              >
                +
              </Button>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}
