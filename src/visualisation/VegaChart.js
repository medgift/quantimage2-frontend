import React, { forwardRef, useImperativeHandle } from 'react';
import { Vega, VegaLite } from 'react-vega';
import './VegaChart.scss';

const VegaChart = (props, ref) => {
  useImperativeHandle(ref, () => ({
    getChart(id) {
      return document
        .getElementById(id)
        .getElementsByTagName('canvas')[0]
        .toDataURL();
    },
  }));

  return (
    <>
      <div className="VegaChart">
        {props.type === 'vega' ? (
          <Vega
            spec={props.chart.spec}
            data={props.chart.data}
            onNewView={async (view) => {
              if (props.setImage) {
                let image = await view.toImageURL('png');
                props.setImage(image);
              }
            }}
            width={props.width}
          />
        ) : props.type === 'vega-lite' ? (
          <VegaLite
            spec={props.chart.spec}
            data={props.chart.data}
            onNewView={async (view) => {
              if (props.setImage) {
                let image = await view.toImageURL('png');
                props.setImage(image);
              }
            }}
          />
        ) : (
          <h5>Graphique inconnu</h5>
        )}
      </div>
    </>
  );
};

export default forwardRef(VegaChart);
