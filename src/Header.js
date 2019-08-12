import React, { useState, useContext } from 'react';
import './Header.css';
import { withRouter, NavLink as RouterNavLink } from 'react-router-dom';
import {
  Collapse,
  Nav,
  Navbar,
  NavbarBrand,
  NavbarToggler,
  NavItem,
  NavLink
} from 'reactstrap';
import UserContext from './context/UserContext';

function Header({ location, onLogout }) {
  let { user } = useContext(UserContext);

  const [isOpen, setIsOpen] = useState(false);

  const toggle = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="Header">
      <Navbar light expand="md">
        <NavbarBrand href="/">IMAGINE</NavbarBrand>
        {user && (
          <>
            <NavbarToggler onClick={toggle} />
            <Collapse isOpen={isOpen} navbar>
              <Nav /*className="ml-auto"*/ navbar>
                <NavItem>
                  <NavLink tag={RouterNavLink} exact to="/">
                    Home
                  </NavLink>
                </NavItem>
                <NavItem>
                  <NavLink tag={RouterNavLink} to="/features">
                    Features
                  </NavLink>
                </NavItem>
                <NavItem>
                  <NavLink tag={RouterNavLink} to="/profile">
                    Profile
                  </NavLink>
                </NavItem>
              </Nav>
              <span className="ml-auto">
                <button className="btn btn-link" onClick={onLogout}>
                  Logout
                </button>
              </span>
            </Collapse>
          </>
        )}
      </Navbar>
    </div>
  );
}

export default withRouter(Header);
