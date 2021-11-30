import * as Papa from 'papaparse';

export async function parseFeatureDetailsResponse(response) {
  let parts = await response.formData();

  let featuresTabularString = parts.get('features_tabular');
  let featuresChartString = parts.get('features_chart');

  let start = Date.now();

  let config = {
    header: true,
    skipEmptyLines: true,
    fastMode: true,
  };
  let featuresTabular = Papa.parse(featuresTabularString, config);
  let featuresChart = Papa.parse(featuresChartString, config);
  let end = Date.now();

  console.log(`Parsing features took ${end - start}ms`);
  console.log('Features Tabular', featuresTabular.data);
  console.log('Features Chart', featuresChart.data);

  return {
    featuresTabular: featuresTabular.data,
    featuresChart: featuresChart.data,
  };
}
