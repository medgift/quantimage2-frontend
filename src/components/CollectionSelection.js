import React from 'react';
import { ListGroup, ListGroupItem, Button } from 'reactstrap';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useHistory, useParams } from 'react-router-dom';

export default function CollectionSelection({
  album,
  collections,
  isAlternativeUser,
}) {
  const history = useHistory();

  const { albumID, collectionID, tab } = useParams();

  const handleCollectionClick = (e) => {
    e.preventDefault();

    let tabToShow = tab ? tab : 'overview';

    if (e.target.id)
      history.push(
        `/features/${albumID}/collection/${e.target.id}/${tabToShow}`
      );
    else history.push(`/features/${albumID}/${tabToShow}`);
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

      {isAlternativeUser && (
        <Button color="link" onClick={handleCreateCollectionClick}>
          <FontAwesomeIcon icon="plus" /> Create a new collection
        </Button>
      )}
    </div>
  ) : null;
}
