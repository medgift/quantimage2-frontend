import React from 'react';
import './Footer.css';

export default function Footer() {
  return (
    <div className="Footer">
      <p className="m-2 text-muted">&copy; 2021 - HES-SO Valais</p>
      <p className="m-2 text-muted">
        Supported by the{' '}
        <a href="https://sphn.ch" target="_blank" rel="noopener noreferrer">
          SPHN
        </a>
        {' and the '}
        <a href="https://snf.ch" target="_blank" rel="noopener noreferrer">
          SNF
        </a>
      </p>
    </div>
  );
}
