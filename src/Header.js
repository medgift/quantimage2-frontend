import React, { useState, useContext, useEffect } from 'react';
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
import { useKeycloak } from 'react-keycloak';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

function Header({ location, onLogout }) {
  const [isOpen, setIsOpen] = useState(false);

  const [keycloak] = useKeycloak();

  const { isAdmin } = useContext(UserContext);

  useEffect(() => {
    async function loadUser() {
      // TODO - Remove these debugging logs
      /*keycloak.loadUserInfo().success(userInfo => {
        console.log(userInfo);
      });*/
      /*keycloak.loadUserProfile().success(userProfile => {
        console.log(userProfile);
      });*/
      //console.log(keycloak.tokenParsed);
      //console.log(keycloak.token);
    }

    loadUser();
  }, [keycloak]);

  const user = useContext(UserContext);

  const toggle = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="Header">
      <Navbar light expand="md">
        <NavbarBrand href="/">QuantImage</NavbarBrand>
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
                {isAdmin && (
                  <>
                    <NavItem className="divider"></NavItem>
                    <NavbarBrand className="admin-lock">
                      <FontAwesomeIcon icon="lock"></FontAwesomeIcon>
                    </NavbarBrand>
                    <NavItem>
                      <NavLink tag={RouterNavLink} exact to="/feature-families">
                        Feature Families
                      </NavLink>
                    </NavItem>
                  </>
                )}
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
