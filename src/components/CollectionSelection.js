import React from 'react';
import { ListGroup, ListGroupItem } from 'reactstrap';

import { useParams, Link } from 'react-router-dom';

export default function CollectionSelection({ album, collections }) {
  const { albumID, collectionID, tab } = useParams();

  const tabToShow = tab ? tab : 'overview';

  return collections ? (
    <div style={{ margin: '0.5em' }}>
      <h5 style={{ marginTop: '16px' }}>
        Collections of album <strong>{album}</strong>
      </h5>
      <ListGroup>
        <ListGroupItem
          key="original"
          tag={Link}
          to={`/features/${albumID}/${tabToShow}`}
          active={!collectionID ? true : null}
        >
          {'<original>'}
        </ListGroupItem>
        {collections.map((c) => (
          <ListGroupItem
            id={c.collection.id}
            key={c.collection.id}
            tag={Link}
            to={`/features/${albumID}/collection/${c.collection.id}/${tabToShow}`}
            active={+collectionID === c.collection.id ? true : null}
          >
            {c.collection.name}
          </ListGroupItem>
        ))}
      </ListGroup>
    </div>
  ) : null;
}
