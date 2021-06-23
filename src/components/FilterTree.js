import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';

import TreeView from '@material-ui/lab/TreeView';
import TreeItem from '@material-ui/lab/TreeItem';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import ChevronRightIcon from '@material-ui/icons/ChevronRight';
import _ from 'lodash';
import { v4 as uuidv4 } from 'uuid';

import './FilterTree.css';
import { Checkbox, FormControlLabel } from '@material-ui/core';

export default function FilterTree({
  formatTreeData,
  treeData,
  getNodeAndAllChildrenIDs,
  filteringItems,
  leafItems,
  featureIDs,
  setFeatureIDs,
  selected,
  setSelected,
  disabled,
}) {
  //const [expanded, setExpanded] = useState([]);
  const selectedFeatureIDs = useMemo(() => {
    if (!leafItems) return [];

    return new Set(
      Object.keys(leafItems)
        .filter((n) => selected.includes(n))
        .map((n) => leafItems[n])
    );
  }, [leafItems, selected]);

  useEffect(() => {
    setFeatureIDs(selectedFeatureIDs);
  }, [selectedFeatureIDs]);

  useEffect(() => {
    console.log('filtertree : feature ids changed', featureIDs);
    console.log('filtertree : leaf items', leafItems);
    console.log('filtertree : selected', selected);
  }, [featureIDs, leafItems]);

  // const handleToggle = (event, nodeIds) => {
  //   setExpanded(nodeIds);
  // };

  const selectNode = (event, node) => {
    let nodeAndChildren = getNodeAndAllChildrenIDs(node, []);

    setSelected((s) => {
      let newSelections = [...s];

      if (event.target.checked) {
        newSelections.push(
          ...nodeAndChildren.filter((n) => !newSelections.includes(n))
        );
      } else {
        newSelections = newSelections.filter(
          (ns) => !nodeAndChildren.includes(ns)
        );
      }

      return newSelections;
    });
  };

  const selectNodeAll = (event, node) => {
    event.preventDefault();
    event.stopPropagation();

    let formattedData = formatTreeData(filteringItems);

    let allNodeIDs = [];
    for (let topLevelElement of formattedData) {
      let nodeAndChildrenIds = getNodeAndAllChildrenIDs(topLevelElement, []);
      allNodeIDs.push(...nodeAndChildrenIds);
    }

    let nodeIDComponents = node.id.split('-');

    // For leaf items, check the immediate parent as well
    let stringToCheck = !node.value
      ? nodeIDComponents[nodeIDComponents.length - 1]
      : [
          nodeIDComponents[nodeIDComponents.length - 2],
          nodeIDComponents[nodeIDComponents.length - 1],
        ].join('-');

    setSelected((s) => {
      let newSelections = [...s];

      if (!newSelections.includes(node.id)) {
        let nodesToSelect = allNodeIDs
          .filter((n) => n.includes(stringToCheck))
          .filter((n) => !newSelections.includes(n));
        newSelections.push(...nodesToSelect);
      } else {
        newSelections = newSelections.filter((n) => !n.includes(stringToCheck));
      }

      return newSelections;
    });
  };

  return (
    <div>
      {filteringItems && (
        <RecursiveTreeView
          //handleToggle={handleToggle}
          getNodeAndAllChildrenIDs={getNodeAndAllChildrenIDs}
          selectNode={selectNode}
          selectNodeAll={selectNodeAll}
          //expanded={expanded}
          selected={selected}
          data={treeData}
          disabled={disabled}
        />
      )}
    </div>
  );
}

function RecursiveTreeView({
  data,
  handleToggle,
  getNodeAndAllChildrenIDs,
  selectNode,
  selectNodeAll,
  expanded,
  selected,
  disabled,
}) {
  const renderTree = (nodes) => {
    return Array.isArray(nodes)
      ? nodes.map((n) => renderItem(n))
      : renderItem(nodes);
  };

  const renderItem = (n) => {
    let checkAllTitle = `${
      selected.includes(n.id) ? 'Uncheck' : 'Check'
    } everywhere`;

    // TODO - Remove this alternative way of labelling the "uncheck for all" link
    // for all ${n.id.split('-').length === 2 ? ' Modalities' : ''} ${
    //       n.id.split('-').length > 2 ? ' Modalities & Regions' : ''
    //     }

    return (
      <TreeItem
        key={n.id}
        nodeId={n.id}
        label={
          <>
            <Checkbox
              color="primary"
              indeterminate={
                n.children &&
                someChildrenSelected(n, selected, getNodeAndAllChildrenIDs)
              }
              checked={
                n.children
                  ? (selected.includes(n.id) &&
                      !noChildrenSelected(n, selected)) ||
                    allChildrenSelected(n, selected, getNodeAndAllChildrenIDs)
                  : selected.includes(n.id)
              }
              onChange={
                (event) => selectNode(event, n)
                //getOnChange(event.currentTarget.checked, nodes)
              }
              onClick={(e) => e.stopPropagation()}
              disabled={disabled}
            />
            <span
              title={
                (n.value && n.value.description) ||
                (n.description && n.description)
              }
            >
              {n.name}{' '}
            </span>
            {!disabled && n.id.split('-').length > 1 && (
              <a
                href="#"
                className="Check-All"
                onClick={(e) => selectNodeAll(e, n)}
                title={checkAllTitle}
              >
                <small>{checkAllTitle}</small>
              </a>
            )}
          </>
        }
      >
        {Array.isArray(n.children)
          ? n.children.map((node) => renderTree(node))
          : null}
      </TreeItem>
    );
  };

  return (
    <TreeView
      defaultCollapseIcon={<ExpandMoreIcon />}
      defaultExpanded={['CT', 'PT', 'MR']}
      defaultExpandIcon={<ChevronRightIcon />}
      //onNodeToggle={handleToggle}
      //selected={selected}
      //expanded={expanded}
      disableSelection={true}
      className="text-left m-2 FilterTree"
    >
      {renderTree(data)}
    </TreeView>
  );
}

function noChildrenSelected(node, selected) {
  return (
    _.intersection(
      selected,
      node.children.map((c) => c.id)
    ).length === 0
  );
}

function allChildrenSelected(node, selected, getNodeAndAllChildrenIDs) {
  let nodeAndAllChildrenIDs = getNodeAndAllChildrenIDs(node, []);

  let childrenIDs = nodeAndAllChildrenIDs.filter((n) => n !== node.id);

  return childrenIDs.every((c) => selected.includes(c));
}

function someChildrenSelected(node, selected, getNodeAndAllChildrenIDs) {
  let nodeAndAllChildrenIDs = getNodeAndAllChildrenIDs(node, []);

  let childrenIDs = nodeAndAllChildrenIDs.filter((n) => n !== node.id);

  return (
    !childrenIDs.every((c) => selected.includes(c)) &&
    childrenIDs.some((c) => selected.includes(c))
  );
}
