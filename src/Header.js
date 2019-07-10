import React, { useState } from 'react';
import './Header.css';
import { withRouter, NavLink as RouterNavLink } from 'react-router-dom';
import {
  Collapse,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
  Nav,
  Navbar,
  NavbarBrand,
  NavbarToggler,
  NavItem,
  NavLink,
  UncontrolledDropdown
} from 'reactstrap';
//import { LinkContainer } from 'react-router-bootstrap';
//import { Link, withRouter } from 'react-router-dom';
//import { Nav, Navbar } from 'react-bootstrap';

function Header({ location }) {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="Header">
      <Navbar light expand="md">
        <NavbarBrand href="/">IMAGINE</NavbarBrand>
        <NavbarToggler onClick={toggle} />
        <Collapse isOpen={isOpen} navbar>
          <Nav /*className="ml-auto"*/ navbar>
            <NavItem>
              <NavLink tag={RouterNavLink} exact to="/">
                Home
              </NavLink>
            </NavItem>
            <NavItem>
              <NavLink tag={RouterNavLink} to="/profile">
                Profile
              </NavLink>
            </NavItem>
            {/*
            <UncontrolledDropdown nav inNavbar>
              <DropdownToggle nav caret>
                Options
              </DropdownToggle>
              <DropdownMenu right>
                <DropdownItem>Option 1</DropdownItem>
                <DropdownItem>Option 2</DropdownItem>
                <DropdownItem divider />
                <DropdownItem>Reset</DropdownItem>
              </DropdownMenu>
            </UncontrolledDropdown>
            */}
          </Nav>
        </Collapse>
      </Navbar>
      {/*<Navbar>
        <Navbar.Brand>
          <Link to="/">IMAGINE</Link>
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="main-menu" />
        <Navbar.Collapse id="main-menu">
          <Nav className="mr-auto">
            <Nav.Link href="/">Home</Nav.Link>
            <Nav.Link href="/profile">Profile</Nav.Link>
            <LinkContainer exact to="/">
              <Nav.Link>Home</Nav.Link>
            </LinkContainer>
            <LinkContainer to="/profile">
              <Nav.Link>Profile</Nav.Link>
            </LinkContainer>
          </Nav>
        </Navbar.Collapse>
      </Navbar>*/}
    </div>
  );
}

export default withRouter(Header);
