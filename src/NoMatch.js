import React from 'react';

export default function NoMatch() {
  return (
    <div>
      <h1>
        404 NOT FOUND{' '}
        <span role="img" aria-label="sad face">
          😢
        </span>
      </h1>
      <p>
        <span>
          Sorry, please try going back to the <a href="/">main page</a>
        </span>
      </p>
    </div>
  );
}
