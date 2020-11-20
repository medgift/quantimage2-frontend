import React, {
  useEffect,
  useState,
  useImperativeHandle,
  forwardRef,
} from 'react';
import {
  ProSidebar,
  Menu,
  SidebarHeader,
  SidebarContent,
} from 'react-pro-sidebar';
import { Row, Col, Button } from 'reactstrap';
import Loading from './Loading';
import AnnotationList from './AnnotationList';
import AddAnnotationModal from './AddAnnotationModal';
import DeleteAnnotationModal from './DeleteAnnotationModal';
import SearchBarAnnotation from './SearchBarAnnotation';
import './AnnotationPanel.scss';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const AnnotationPanel = (props, ref) => {
  const [collapsed, setCollapsed] = useState(true);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [parentId, setParentId] = useState(null);
  const [editingAnnotation, setEditingAnnotation] = useState(null);
  const [deletingAnnotation, setDeletingAnnotation] = useState(null);
  const [search, setSearch] = useState('');

  // Reset searchbar on collapse
  useEffect(() => {
    setSearch('');
  }, [collapsed]);

  // Check if images have been loaded
  useEffect(() => {
    setImgLoaded(missingImages());
  }, [props.chartsImg]);

  const getSearch = (term) => {
    setSearch(term);
  };

  const displayAnnotation = (a) => {
    setCollapsed(true);
    props.displayAnnotation(a);
  };

  const answerAnnotation = (parentId) => {
    setEditingAnnotation(null);
    setParentId(parentId);
    setShowSaveModal(true);
  };

  const askEditAnnotation = (a) => {
    setEditingAnnotation(a);
    setParentId(a.parent_id);
    setShowSaveModal(true);
  };

  const saveAnnotation = async (title, text, lines) => {
    setShowSaveModal(false);
    setEditingAnnotation(null);
    await props.saveAnnotation(title, text, lines, parentId, editingAnnotation);
  };

  const askDeleteAnnotation = (a, willBeDeleted) => {
    if (willBeDeleted) {
      setDeletingAnnotation(a);
      setShowDeleteModal(true);
    } else {
      props.deleteAnnotation(a.id, false);
    }
  };

  const deleteAnnotation = () => {
    setShowDeleteModal(false);
    props.deleteAnnotation(deletingAnnotation.id);
    setDeletingAnnotation(null);
  };

  const cleanSaveModal = () => {
    setShowSaveModal(false);
    setParentId(null);
    setEditingAnnotation(null);
  };

  const missingImages = () => {
    let isLoaded = true;
    props.chartsImg.map((i) => {
      if (i.img === null) isLoaded = false;
    });
    return isLoaded;
  };

  useImperativeHandle(ref, () => ({
    askDelete(annotation) {
      askDeleteAnnotation(annotation, true);
    },
    askEdit(annotation) {
      askEditAnnotation(annotation);
    },
    askAnswer(annotation) {
      answerAnnotation(annotation);
    },
  }));

  return (
    <>
      <ProSidebar
        collapsed={collapsed}
        className="AnnotationPanel"
        onClick={() => collapsed && setCollapsed(false)}
      >
        <SidebarHeader className="SidePanelHeader">
          <Row>
            <Col xs="7">
              <h5>
                <FontAwesomeIcon icon="comments" className="mr-2" />
                {!collapsed && 'Discussion'}
              </h5>
            </Col>
            {!collapsed && (
              <>
                <Col xs="3" className="text-right">
                  <Button
                    color="success"
                    onClick={() => setShowSaveModal(true)}
                    disabled={!imgLoaded}
                  >
                    <FontAwesomeIcon icon="plus" className="mr-2" />
                    Comment
                  </Button>
                </Col>
                <Col className="text-right">
                  <Button
                    color="light"
                    onClick={() => setCollapsed(!collapsed)}
                  >
                    <FontAwesomeIcon icon="eye-slash" />
                  </Button>
                </Col>
                <SearchBarAnnotation search={getSearch} />
              </>
            )}
          </Row>
        </SidebarHeader>
        <SidebarContent className="SidePanelContent">
          {props.loading ? (
            <Loading color="info" size="sm">
              <small>Loading Annotations...</small>
            </Loading>
          ) : props.annotations.length === 0 ? (
            <div className="text-center text-muted mt-5">
              <h5>None</h5>
            </div>
          ) : (
            <Menu iconShape="circle">
              <AnnotationList
                annotations={props.annotations}
                search={search}
                collapsed={collapsed}
                answerAnnotation={answerAnnotation}
                editAnnotation={askEditAnnotation}
                deleteAnnotation={askDeleteAnnotation}
                displayAnnotation={displayAnnotation}
              />
            </Menu>
          )}
        </SidebarContent>
        <AddAnnotationModal
          show={showSaveModal}
          toggle={() => cleanSaveModal()}
          annotation={editingAnnotation}
          save={saveAnnotation}
          chartsImg={props.chartsImg}
        />
        <DeleteAnnotationModal
          show={showDeleteModal}
          toggle={() => setShowDeleteModal(false)}
          delete={deleteAnnotation}
          annotation={deletingAnnotation}
        />
      </ProSidebar>
    </>
  );
};

export default forwardRef(AnnotationPanel);
