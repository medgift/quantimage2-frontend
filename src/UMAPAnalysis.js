import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Alert } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import HighchartsReact from 'highcharts-react-official';
import Highcharts from 'highcharts';
import { UMAP } from 'umap-js';

const UMAPAnalysis = ({
  filteredFeatures,
  sortedPatientIDs,
  sortedOutcomes,
  outcomeField,
  isComputingUmap,
  setIsComputingUmap,
}) => {
  const [umapData, setUmapData] = useState(null);
  const [umapError, setUmapError] = useState(null);

  const computeUMAP = useCallback(async () => {
    try {
      setIsComputingUmap(true);
      setUmapError(null);
      
     
      
      // Build data matrix directly from raw data
      const dataMatrix = [];
      
      for (
        let patientIdx = 0;
        patientIdx < sortedPatientIDs.length;
        patientIdx++
      ) {
        const patient = sortedPatientIDs[patientIdx];
        const patientFeatures = [];

        for (let feature of filteredFeatures) {
          let value = feature[patient];
          patientFeatures.push(+value);
        }
        dataMatrix.push(patientFeatures);
      }

      // Run UMAP
      const umap = new UMAP();
      const embedding = umap.fit(dataMatrix);

      // Process results
      const umapPoints = embedding.map((coords, idx) => {
        const patient = sortedPatientIDs[idx];
        const outcomeData = sortedOutcomes[idx] || {};
        const outcome = outcomeData[outcomeField] || 'UNKNOWN';

        return {
          x: coords[0],
          y: coords[1],
          name: patient,
          className: outcome,
          patientData: outcomeData, // Store full patient data for tooltip
        };
      });

      setUmapData(umapPoints);
      setIsComputingUmap(false);
    } catch (error) {
      console.error('UMAP computation failed:', error);      setUmapError(`UMAP computation failed: ${error.message}`);
      setIsComputingUmap(false);
    }
  }, [filteredFeatures, sortedPatientIDs, sortedOutcomes, outcomeField, setIsComputingUmap]);

  // Automatically compute UMAP when data is available
  useEffect(() => {
    if (filteredFeatures.length > 0 && sortedPatientIDs.length > 0) {
      computeUMAP();
    }
  }, [filteredFeatures, sortedPatientIDs, sortedOutcomes, computeUMAP]);

  // Chart options
  const chartOptions = useMemo(() => {
    if (!umapData || umapData.length === 0) return null;

    const series = [
      {
        name: 'Outcome 0',
        data: umapData
          .filter((p) => p.className === 0 || p.className === '0')
          .map((p) => ({
            x: p.x,
            y: p.y,
            name: p.name,
            className: p.className,
            patientData: p.patientData,
          })),
        color: '#2E86AB', // Standard blue for outcome 0
        marker: { symbol: 'circle' },
      },
      {
        name: 'Outcome 1',
        data: umapData
          .filter((p) => p.className === 1 || p.className === '1')
          .map((p) => ({
            x: p.x,
            y: p.y,
            name: p.name,
            className: p.className,
            patientData: p.patientData,
          })),
        color: '#E74C3C', // Standard red for outcome 1
        marker: { symbol: 'circle' },
      },
      {
        name: 'Unknown',
        data: umapData
          .filter((p) => p.className === 'UNKNOWN')
          .map((p) => ({
            x: p.x,
            y: p.y,
            name: p.name,
            className: p.className,
            patientData: p.patientData,
          })),
        color: '#666666',
        marker: { symbol: 'circle' },
      },
    ].filter((s) => s.data.length > 0);

    return {
      chart: {
        type: 'scatter',
        height: 600,
        zoomType: 'xy',
      },
      title: {
        text: '',
      },
      credits: {
        enabled: false,
      },
      xAxis: {
        title: { text: 'UMAP 1' },
      },
      yAxis: {
        title: { text: 'UMAP 2' },
      },
      legend: {
        enabled: true,
      },
      plotOptions: {
        scatter: {
          marker: {
            symbol: 'circle',
            radius: 6,
            fillOpacity: 0.8,
            lineWidth: 1,
            lineColor: '#ffffff',
          },
        },
      },
      tooltip: {
        formatter: function () {
          const point = this.point;
          
          // Simplified tooltip - only patient, value, and info
          return (
            `<strong>Patient:</strong> ${point.name}<br />` +
            `<strong>Value:</strong> (${point.x.toFixed(3)}, ${point.y.toFixed(3)})<br /><br />` +
            `<strong>INFO:</strong> UMAP projection of ${filteredFeatures.length} features`
          );
        },
      },
      series: series,
    };
  }, [umapData, filteredFeatures]);

  return (
    <div className="umap-analysis">
      {umapError && (
        <Alert color="danger" className="mb-3">
          <FontAwesomeIcon icon="exclamation-triangle" className="me-2" />
          <strong>UMAP Error:</strong> {umapError}
        </Alert>
      )}

      {isComputingUmap && (
        <Alert color="info" className="mb-3">
          <FontAwesomeIcon icon="sync" spin className="me-2" />
          Computing UMAP projection...
        </Alert>
      )}

      

      <HighchartsReact highcharts={Highcharts} options={chartOptions} />
    </div>
  );
};

export default UMAPAnalysis;
