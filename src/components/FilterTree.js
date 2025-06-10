import React, { useCallback, useState } from 'react';
import { Button } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { FEATURE_ID_SEPARATOR } from '../Visualisation';
import _ from 'lodash';

export default function FilterTree({
  formatTreeData,
  treeData,
  getNodeAndAllChildrenIDs,
  filteringItems,
  selected,
  setSelected,
  disabled,
}) {
  const [expandedNodes, setExpandedNodes] = useState(new Set(['CT', 'PT', 'MR']));

  const toggleExpanded = (nodeId) => {
    setExpandedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const selectNode = useCallback(
    (event, node) => {
      let nodeAndChildren = getNodeAndAllChildrenIDs(node, []);
      event.persist();

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
    },
    [getNodeAndAllChildrenIDs, setSelected]
  );

  const selectNodeAll = useCallback(
    (event, node) => {
      event.preventDefault();
      event.stopPropagation();

      let formattedData = formatTreeData(filteringItems);

      let allNodeIDs = [];
      for (let topLevelElement of formattedData) {
        let nodeAndChildrenIds = getNodeAndAllChildrenIDs(topLevelElement, []);
        allNodeIDs.push(...nodeAndChildrenIds);
      }

      let nodeIDComponents = node.id.split(FEATURE_ID_SEPARATOR);
      let nodeComponentIndexToCheck = nodeIDComponents.length - 1;

      setSelected((s) => {
        let newSelections = [...s];

        if (!newSelections.includes(node.id)) {
          let nodesToSelect = allNodeIDs
            .filter((n) => {
              let currentNodeComponents = n.split(FEATURE_ID_SEPARATOR);

              if (node.value)
                return (
                  nodeIDComponents[nodeComponentIndexToCheck] ===
                    currentNodeComponents[nodeComponentIndexToCheck] &&
                  nodeIDComponents[nodeComponentIndexToCheck - 1] ===
                    currentNodeComponents[nodeComponentIndexToCheck - 1]
                );

              return (
                currentNodeComponents.length >= nodeIDComponents.length &&
                nodeIDComponents[nodeComponentIndexToCheck] ===
                  currentNodeComponents[nodeComponentIndexToCheck]
              );
            })
            .filter((n) => !newSelections.includes(n));
          newSelections.push(...nodesToSelect);
        } else {
          newSelections = newSelections.filter((n) => {
            let currentNodeComponents = n.split(FEATURE_ID_SEPARATOR);

            if (node.value)
              return (
                nodeIDComponents[nodeComponentIndexToCheck] ===
                  currentNodeComponents[nodeComponentIndexToCheck] &&
                nodeIDComponents[nodeComponentIndexToCheck - 1] !==
                  currentNodeComponents[nodeComponentIndexToCheck - 1]
              );

            return (
              currentNodeComponents.length >= nodeIDComponents.length &&
              nodeIDComponents[nodeComponentIndexToCheck] !==
                currentNodeComponents[nodeComponentIndexToCheck]
            );
          });
        }

        return newSelections;
      });
    },
    [filteringItems, formatTreeData, getNodeAndAllChildrenIDs, setSelected]
  );

  const renderTreeNode = (node, level = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes.has(node.id);
    const indent = level * 20;

    // Calculate checkbox state
    const isChecked = (() => {
      if (hasChildren) {
        return (selected.includes(node.id) && !noChildrenSelected(node, selected)) ||
               allChildrenSelected(node, selected, getNodeAndAllChildrenIDs);
      } else {
        return selected.includes(node.id);
      }
    })();

    const isIndeterminate = hasChildren && someChildrenSelected(node, selected, getNodeAndAllChildrenIDs);
    const checkAllTitle = `${selected.includes(node.id) ? 'Uncheck' : 'Check'} everywhere`;

    return (
      <div key={node.id} style={{ marginLeft: `${indent}px` }}>
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            padding: '4px 0',
            borderBottom: hasChildren ? '1px solid #eee' : 'none',
            backgroundColor: hasChildren ? '#f8f9fa' : 'transparent'
          }}
        >
          {/* Expand/collapse button */}
          {hasChildren && (
            <button
              onClick={() => toggleExpanded(node.id)}
              style={{
                background: 'none',
                border: 'none',
                padding: '2px 6px',
                cursor: 'pointer',
                marginRight: '6px',
                fontSize: '12px'
              }}
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              <FontAwesomeIcon 
                icon={isExpanded ? 'chevron-down' : 'chevron-right'} 
                size="sm"
              />
            </button>
          )}
          
          {/* Spacer if no children */}
          {!hasChildren && <span style={{ width: '20px', display: 'inline-block' }} />}
          
          {/* Checkbox */}
          <input
            type="checkbox"
            checked={isChecked}
            ref={(input) => {
              if (input) input.indeterminate = isIndeterminate;
            }}
            onChange={(event) => {
              event.stopPropagation();
              selectNode(event, node);
            }}
            onClick={(e) => e.stopPropagation()}
            disabled={disabled}
            style={{ marginRight: '8px' }}
          />
          
          {/* Node label */}
          <span
            title={(node.value && node.value.description) || node.description}
            style={{ 
              fontSize: hasChildren ? '14px' : '13px',
              fontWeight: hasChildren ? 'bold' : 'normal',
              flex: 1,
              cursor: 'default'
            }}
          >
            {node.name}
          </span>
          
          {/* Select all button */}
          {!disabled && node.id.split(FEATURE_ID_SEPARATOR).length > 1 && (
            <Button
              color="link"
              size="sm"
              onClick={(e) => selectNodeAll(e, node)}
              title={checkAllTitle}
              style={{ 
                padding: '2px 6px', 
                fontSize: '11px',
                marginLeft: '8px',
                textDecoration: 'none'
              }}
              className="check-all-btn"
            >
              {checkAllTitle}
            </Button>
          )}
        </div>
        
        {/* Children */}
        {hasChildren && isExpanded && (
          <div style={{ marginTop: '2px' }}>
            {node.children.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <style>
        {`
          .check-all-btn {
            opacity: 0;
            transition: opacity 0.2s;
          }
          .check-all-btn:hover,
          div:hover .check-all-btn {
            opacity: 1;
          }
        `}
      </style>
      
      {filteringItems && treeData && (
        <div 
          className="text-left m-2"
          style={{ 
            border: '1px solid #ddd', 
            borderRadius: '4px', 
            padding: '10px', 
            maxHeight: '600px', 
            overflowY: 'auto',
            backgroundColor: '#fff'
          }}
        >
          <div style={{ marginBottom: '10px', fontSize: '12px', color: '#666' }}>
            <strong>{selected ? selected.length : 0}</strong> features selected
          </div>
          {treeData.map(node => renderTreeNode(node, 0))}
        </div>
      )}
    </div>
  );
}

// Helper functions (same as original)
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