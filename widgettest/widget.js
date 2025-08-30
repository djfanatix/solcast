module.exports = {
  async render({ device }) {
    const chartConfig = await device.getStoreValue("forecastChartConfig");
    if (!chartConfig) return "<p>No chart data yet</p>";

    const chartUrl =
      `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}` +
      `&width=600&height=300&format=png`;

    return `
      <div style="text-align:center;">
        <img src="${chartUrl}" style="max-width:100%; border-radius:8px; background:#fff;" />
      </div>
    `;
  }
};