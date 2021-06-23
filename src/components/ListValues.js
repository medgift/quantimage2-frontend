import React from 'react';
import { ListGroup, ListGroupItem } from 'reactstrap';

export default function ListValues({ values }) {
  return (
    <ListGroup>
      {values.map((value) => (
        <ListGroupItem key={value}>{value}</ListGroupItem>
      ))}
    </ListGroup>
  );
}
