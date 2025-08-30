const querystring = require('querystring');

/**
 * Generates an Image-Charts URL for Solcast forecast data
 * @param {Array} forecasts - Array of Solcast forecast objects
 *        Each object should have: { period_end: ISOString, pv_estimate: Number }
 * @returns {string} Image URL
 */
function buildChartImageUrl(forecasts) {
  if (!forecasts || forecasts.length === 0) return '';

  // Extract labels (hours) and values (PV estimates)
  const labels = forecasts.map(f => {
    const date = new Date(f.period_end);
    return `${date.getHours()}:00`;
  });
  const values = forecasts.map(f => f.pv_estimate);

  const chartConfig = {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'PV Forecast (kW)',
          data: values,
          borderColor: 'orange',
          fill: true,
          backgroundColor: 'rgba(255,165,0,0.3)',
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: true } },
      scales: {
        y: { title: { display: true, text: 'kW' } },
        x: { title: { display: true, text: 'Hour' } },
      },
    },
  };

  const query = {
    bkg: 'white',
    c: JSON.stringify(chartConfig),
    height: 320,
    width: 540,
  };

  return `https://image-charts.com/chart.js/2.8.0?${querystring.stringify(query)}`;
}

module.exports = { buildChartImageUrl };
