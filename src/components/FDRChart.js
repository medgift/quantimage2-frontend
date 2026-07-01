import HighchartsReact from 'highcharts-react-official';
import React, { useMemo } from 'react';
import Highcharts from 'highcharts';

export default function FDRChart({
  fdrResults,
  fdrIndex,
  FDR_THRESHOLDS_LIST,
}) {
  const options = useMemo(() => {
    if (!fdrResults || !fdrResults.length) return null;

    const currentTrheshold = FDR_THRESHOLDS_LIST[fdrIndex];

    const seriesData = FDR_THRESHOLDS_LIST.map((threshold, i) => ({
      x: threshold,
      y: fdrResults[i]?.featureCount ?? 0,
    }));

    return {
      chart: {
        type: 'line',
        height: 400,
        animation: false,
      },
      title: {
        text: 'FDR Feature Selection',
      },
      xAxis: {
        title: { text: 'Qvalue' },
        plotLines: [
          {
            color: '#cc0000',
            dashStyle: 'Dash',
            width: 2,
            value: currentTrheshold,
            label: {
              text: `qvalue = ${currentTrheshold}`,
              rotation: -90,
              textAlign: 'right',
              x: -4,
              style: { color: '#cc0000', fontSize: '11px' },
            },
          },
        ],
      },
      yAxis: {
        title: { text: 'Number of selected features' },
        min: 0,
        allowDecimals: false,
      },
      tooltip: {
        formatter: function () {
          return `<b>${this.x}</b><br/>Features: <b>${this.y}</b>`;
        },
      },
      legend: { enabled: false },
      credits: { enabled: false },
      series: [
        {
          name: 'FDR',
          data: seriesData,
          color: '#4a90d9',
          marker: { enabled: true, radius: 4 },
        },
      ],
    };
  }, [fdrResults, fdrIndex, FDR_THRESHOLDS_LIST]);

  if (!options) return null;

  return <HighchartsReact highcharts={Highcharts} options={options} />;
}
