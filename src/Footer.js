import React, { useContext } from 'react';
import './Footer.css';
import UserContext from './context/UserContext';

export default function Footer() {
  let { user } = useContext(UserContext);

  return (
    <div className="Footer">
      <p className="m-2 text-muted">&copy; 2019</p>
    </div>
  );
}
