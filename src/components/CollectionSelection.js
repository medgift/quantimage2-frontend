import React, { useState } from 'react';
import { ListGroup, ListGroupItem, Button } from 'reactstrap';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useHistory } from 'react-router-dom';

export default function CollectionSelection({
  albumID,
  album,
  collections,
  collectionID,
}) {
  const history = useHistory();

  const handleCollectionClick = (e) => {
    e.preventDefault();
    if (e.target.id)
      history.push(`/features/${albumID}/collection/${e.target.id}/overview`);
    else history.push(`/features/${albumID}/overview`);
  };

  const handleCreateCollectionClick = (e) => {
    e.preventDefault();
    history.push(`/features/${albumID}/create`);
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
          active={!collectionID ? true : null}
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
            active={+collectionID === c.collection.id ? true : null}
            onClick={handleCollectionClick}
          >
            {c.collection.name}
          </ListGroupItem>
        ))}
      </ListGroup>

      <Button color="link" onClick={handleCreateCollectionClick}>
        <FontAwesomeIcon icon="plus" /> Create a new collection
      </Button>
    </div>
  ) : null;
}
