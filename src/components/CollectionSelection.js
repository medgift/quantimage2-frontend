import React, { useState } from 'react';
import { ListGroup, ListGroupItem, Button } from 'reactstrap';

export default function CollectionSelection({
  album,
  collections,
  activeCollection,
  setActiveCollection,
}) {
  const handleCollectionClick = (e) => {
    e.preventDefault();
    setActiveCollection(e.target.id ? e.target.id : null);
  };

  return collections ? (
    <div style={{ margin: '0.5em' }}>
      <h5 style={{ marginTop: '16px' }}>
        Collections of album <strong>{album}</strong>
      </h5>
      <ListGroup>
        <ListGroupItem
          key="original"
          tag="a"
          href="#"
          active={activeCollection === null ? true : null}
          onClick={handleCollectionClick}
        >
          {'<original>'}
        </ListGroupItem>
        {collections.map((c) => (
          <ListGroupItem
            id={c.collection.id}
            key={c.collection.id}
            tag="a"
            href="#"
            active={+activeCollection === c.collection.id ? true : null}
            onClick={handleCollectionClick}
          >
            {c.collection.name}
          </ListGroupItem>
        ))}
      </ListGroup>
    </div>
  ) : null;
}
