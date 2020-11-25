import React from 'react';
import './Footer.css';

import sphnLogo from './assets/img/sphn-logo.png';
import fnsLogo from './assets/img/fns-logo.png';

export default function Footer() {
  //let { user } = useContext(UserContext);

  return (
    <div className="Footer">
      <p className="m-2 text-muted">&copy; 2020 - HES-SO Valais</p>
      <p className="m-2 text-muted">
        Supported by the{' '}
        <a href="https://sphn.ch" target="_blank">
          SPHN
        </a>
        {' and the '}
        <a href="https://snf.ch" target="_blank">
          SNF
        </a>
      </p>
    </div>
  );
}
