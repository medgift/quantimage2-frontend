import React, { useEffect, useMemo } from 'react';

import TreeView from '@mui/lab/TreeView';
import TreeItem from '@mui/lab/TreeItem';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import _ from 'lodash';

import './FilterTree.css';
import MyCheckbox from './MyCheckbox';
import { Button } from 'reactstrap';

export default function FilterTree({
  formatTreeData,
  treeData,
  getNodeAndAllChildrenIDs,
  filteringItems,
  selected,
  setSelected,
  disabled,
}) {
  const selectNode = (event, node) => {
    let nodeAndChildren = getNodeAndAllChildrenIDs(node, []);
    event.persist();

    setSelected((s) => {
      let newSelections = [...s];

      console.log('event target is', event.target);

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
          .filter((n) =>
            node.value ? n.endsWith(stringToCheck) : n.includes(stringToCheck)
          )
          .filter((n) => !newSelections.includes(n));
        newSelections.push(...nodesToSelect);
      } else {
        newSelections = newSelections.filter((n) =>
          node.value ? !n.endsWith(stringToCheck) : !n.includes(stringToCheck)
        );
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
            <MyCheckbox
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
                (event) => {
                  event.stopPropagation();
                  selectNode(event, n);
                }
                //getOnChange(event.currentTarget.checked, nodes)
              }
              onClick={(e) => {
                e.stopPropagation();
              }}
              disabled={disabled}
              style={{ marginRight: '0.5em' }}
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
              <Button
                color="link"
                className="Check-All"
                onClick={(e) => selectNodeAll(e, n)}
                title={checkAllTitle}
              >
                <small>{checkAllTitle}</small>
              </Button>
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
