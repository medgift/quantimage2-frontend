import React, { useContext } from 'react';
import './Footer.css';
import UserContext from './context/UserContext';

export default function Footer({ onLogout }) {
  let { user } = useContext(UserContext);

  return (
    <div className="Footer">
      <p className="m-2 text-muted">&copy; 2019</p>
      {user && (
        <button className="btn btn-link" onClick={onLogout}>
          Logout
        </button>
      )}
    </div>
  );
}
