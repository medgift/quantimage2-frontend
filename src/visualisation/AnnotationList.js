import React, { useEffect, useState } from 'react';
import './AnnotationList.scss';
import { SubMenu } from 'react-pro-sidebar';
import { Row, Col, Badge, Button } from 'reactstrap';
import AnnotationHighlight from './AnnotationHighlight';
import moment from 'moment';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const AnnotationList = (props) => {
  const [parentAnnotations, setParentAnnotations] = useState([]);

  // Prepare annotations
  useEffect(() => {
    let sortedAnnots = [...props.annotations].sort((a, b) => {
      return a.parentId - b.parentId;
    });
    let annots = [];
    sortedAnnots.map((a) => {
      const annot = {
        id: a.id,
        user: a.user,
        title: a.title,
        text: a.text,
        date: a.date,
        lines: a.lines ? a.lines : null,
        deleted: a.deleted && true,
        show:
          a.title.toLowerCase().includes(props.search.toLowerCase()) ||
          a.text.toLowerCase().includes(props.search.toLowerCase()) ||
          props.search === '',
      };
      if (!a.parentId) {
        annot.answers = [];
        annots.push(annot);
      } else {
        annot.parentId = a.parentId;
        annots.find((x) => x.id === a.parentId).answers.push(annot);
      }
    });
    annots = sortByDate(annots);
    annots.map((a) => {
      a.answers = sortByDate(a.answers);
    });
    setParentAnnotations(annots);
  }, [props.annotations, props.search]);

  const sortByDate = (list) => {
    return list.sort((a, b) => {
      return b.date - a.date;
    });
  };

  const displayAnnotation = (annotation) => {
    props.displayAnnotation(annotation);
  };

  const answerAnnotation = (parentAnnotation) => {
    props.answerAnnotation(parentAnnotation);
  };

  const editAnnotation = (annotation) => {
    props.editAnnotation(annotation);
  };

  const deleteAnnotation = (annotation, willBeDeleted) => {
    props.deleteAnnotation(annotation, willBeDeleted);
  };

  const annotationTitle = (annot) => {
    const date = moment(annot.date).format('D.MM.YYYY à hh:mm:ss');
    return (
      <div className="py-2">
        <Row>
          <Col xs="5">
            {annot.deleted ? (
              deleted(annot)
            ) : (
              <span>
                {annot.title.length > 40
                  ? annot.title.substring(0, 40) + '...'
                  : annot.title}
              </span>
            )}
          </Col>
          <Col>{annot.lines && <AnnotationHighlight />}</Col>
          <Col xs="3">
            {!annot.deleted && (
              <Button
                color="info"
                className="small-btn"
                onClick={() => displayAnnotation(annot)}
              >
                <FontAwesomeIcon icon="eye" />
              </Button>
            )}
            {
              /* props.user.id === a.user || props.user.isAdmin && */
              annot.deleted ? (
                <Button
                  color="success"
                  size="sm"
                  onClick={() => deleteAnnotation(annot, false)}
                >
                  <FontAwesomeIcon icon="recycle" /> Réactiver
                </Button>
              ) : (
                <>
                  <Button
                    color="danger"
                    className="small-btn"
                    onClick={() => deleteAnnotation(annot, true)}
                  >
                    <FontAwesomeIcon icon="trash-alt" />
                  </Button>
                  <Button
                    color="dark"
                    className="small-btn"
                    onClick={() => editAnnotation(annot)}
                  >
                    <FontAwesomeIcon icon="edit" />
                  </Button>
                </>
              )
            }
          </Col>
        </Row>
        <Row className="text-muted">
          <Col xs="5">
            <small className={annot.answers && 'parent-small'}>le {date}</small>
          </Col>
          <Col>
            <small className={annot.answers && 'parent-small'}>
              <FontAwesomeIcon icon="user" className="mr-2" />
              {annot.user}
            </small>
          </Col>
          {annot.answers && (
            <Col xs="3">
              <Badge color={annot.answers.length ? 'warning' : 'secondary'}>
                {annot.answers.length ? annot.answers.length : 0}
                {annot.answers.length > 1 ? ' réponses' : ' réponse'}
              </Badge>
            </Col>
          )}
        </Row>
      </div>
    );
  };

  const formattedText = (text) => {
    const reg = new RegExp('(' + props.search + ')', 'gi');
    return text.replace(reg, '<strong>$1</strong>');
  };

  const deleted = (annot) => {
    return (
      <small className="text-muted deleted">
        <em>
          {annot.answers ? 'Annotation' : 'Réponse'} supprimée par son auteur
        </em>
      </small>
    );
  };

  const shownChildren = (answers) => {
    let show = false;
    answers.map((a) => {
      if (a.show) show = true;
    });
    return show;
  };

  const noResult = () => {
    let empty = true;
    parentAnnotations.map((a) => {
      if (a.show) empty = false;
      a.answers.map((x) => {
        if (x.show) empty = false;
      });
    });
    return empty;
  };

  return (
    <>
      {noResult() ? (
        <div className="text-center text-muted mt-5">
          <h5>Aucune annotation trouvée.</h5>
        </div>
      ) : (
        parentAnnotations.map((a) => {
          if (a.show || shownChildren(a.answers))
            return (
              <SubMenu
                key={a.id}
                className="SidePanelSubMenu"
                icon={<FontAwesomeIcon icon="comment" />}
                title={!props.collapsed && annotationTitle(a)}
              >
                {!props.collapsed && (
                  <div className="SidePanelItem p-3">
                    {a.deleted ? (
                      deleted(a)
                    ) : (
                      <span
                        dangerouslySetInnerHTML={{
                          __html: formattedText(a.text),
                        }}
                      />
                    )}
                    <div className="text-right">
                      <Button
                        className="ml-2"
                        color="primary"
                        size="sm"
                        onClick={() => answerAnnotation(a.id)}
                      >
                        <FontAwesomeIcon icon="reply" className="mr-2" />
                        Répondre
                      </Button>
                    </div>
                  </div>
                )}
                {!props.collapsed &&
                  a.answers.map((x) => {
                    if (x.show)
                      return (
                        <SubMenu
                          key={x.id}
                          className="SidePanelSubMenu"
                          title={!props.collapsed && annotationTitle(x)}
                        >
                          <div className="SidePanelItem py-2 px-3">
                            {x.deleted ? (
                              deleted(x)
                            ) : (
                              <span
                                dangerouslySetInnerHTML={{
                                  __html: formattedText(x.text),
                                }}
                              />
                            )}
                          </div>
                        </SubMenu>
                      );
                  })}
              </SubMenu>
            );
        })
      )}
    </>
  );
};

export default AnnotationList;
