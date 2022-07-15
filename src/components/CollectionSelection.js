import React from 'react';
import { ListGroup, ListGroupItem } from 'reactstrap';

import { useHistory, useParams } from 'react-router-dom';

export default function CollectionSelection({
  album,
  collections,
  setIsLoading,
}) {
  const history = useHistory();

  const { albumID, collectionID, tab } = useParams();

  const handleCollectionClick = (e) => {
    setIsLoading(true);

    e.preventDefault();

    let tabToShow = tab ? tab : 'overview';

    if (e.target.id)
      history.push(
        `/features/${albumID}/collection/${e.target.id}/${tabToShow}`
      );
    else history.push(`/features/${albumID}/${tabToShow}`);
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
          onClick={
            collectionID ? handleCollectionClick : (e) => e.preventDefault()
          }
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
            onClick={
              +collectionID !== c.collection.id
                ? handleCollectionClick
                : (e) => e.preventDefault()
            }
          >
            {c.collection.name}
          </ListGroupItem>
        ))}
      </ListGroup>
    </div>
  ) : null;
}
