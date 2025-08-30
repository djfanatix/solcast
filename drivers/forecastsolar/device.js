'use strict';

const Homey = require('homey');
const { ManagerDrivers } = require('homey');
const fetch = require('node-fetch');
const baseUrl = 'https://api.forecast.solar/estimate';
const util = require('util');
const setTimeoutPromise = util.promisify(setTimeout);

class Forecastsolardevice extends Homey.Device {


  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log('Settings changed, restarting device...');
    clearTimeout(this.pollingTimeout);
    this.restartDevice(1000);
  }

  async restartDevice(delay) {
    if (this.restarting) return;
    this.restarting = true;
    clearTimeout(this.pollingTimeout);
    const dly = delay || 2000;
    this.log(`Device will restart in ${dly / 1000} seconds`);
    await setTimeoutPromise(dly).then(() => this.onInit());
  }

  onInit() {
    this.log('Forecastsolar device starting...');
    this.summary = {
      name: this.getName(),
      kwp: this.getSettings().api,
      orientation: this.getSettings().orientation,
      declination: this.getSettings().declination
    };
    //this.updateForecastSolarChart();

    // Register capability listener for manual update button
    this.registerCapabilityListener("button", async (args) => {
      this.log('Manual update triggered by button press');
      await this.getDetail();
    });

  // Flow condition card for Solcast between times
this.homey.flow
  .getConditionCard('forecastsolar_forecast_between_times')
  .registerRunListener(async (args, state) => {

    const { startTime, endTime, threshold } = args;

    if (!args.device) {
      return false;
    }

    return args.device.forecastSolarBetweenTimes({ startTime, endTime, threshold }, state);
  });

    //clear all old timeouts
    clearTimeout(this.pollingTimeout);
    // Schedule polling to start at the next full hour
   // this.scheduleNextFullHour();

    // Delay before scheduling polling
    setTimeout(() => {
      this.scheduleNextFullHour();
    }, 10000); // 30 seconds delay

  }

  scheduleNextFullHour() {
    const now = new Date();
    const nextHour = new Date(now.getTime());
    nextHour.setMinutes(0, 0, 0); // Reset to the top of the hour
    nextHour.setHours(nextHour.getHours() + 1); // Move to the next hour

    const delayUntilNextHour = nextHour - now;
    this.log(`Scheduled to start polling at: ${nextHour}`);

    setTimeout(() => {
      if(this.getId){
        this.log(`initial getDetail (ID: ${this.getId}):`)
         this.startPolling();
          this.getDetail().catch(error => {
            this.log(`Error during initial getDetail (ID: ${this.getId}):`, error);
          });
      } else {
        this.log("Id is undefined, initial getDetail skipped");
      }

    }, delayUntilNextHour);
  }
    /*
    setTimeout(() => {
      this.startPolling();
      this.getDetail();
    }, delayUntilNextHour);
  }
*/
  startPolling() {
    const pollInterval = 60 * 60 * 1000; // 1 hour
    const poll = () => {
      this.log('Hourly update triggered');
      if (this.getId) { // Check if 'this.id' exists
        this.getDetail()
          .catch(error => {
            this.log(`Error during hourly update (ID: ${this.getId}):`, error);
          })
          .finally(() => {
            this.pollingTimeout = this.homey.setTimeout(poll, pollInterval);
          });
      } else {
        this.log('ID is undefined. Cannot proceed with hourly update.');
        this.pollingTimeout = this.homey.setTimeout(poll, pollInterval); //schedule next run even if Id is missing.
      }
    };
  
    poll(); // Start the first poll immediately
  }

    /*
    this.pollingTimeout = this.homey.setInterval(() => {
      this.log('Hourly update triggered');
      this.getDetail();
    }, pollInterval);
  }
*/
  onAdded() {
    this.log('Device added');
  }

  onDeleted() {
    try {
      this.homey.clearInterval(this.pollingTimeout);
      this.log('Forecastsolar device deleted');
    } catch (error) {
      this.error('Error during deletion:', error);
    }
  }

async updateForecastSolarChart() {
  try {
    const forecastsolar = await this.getStoreValue("forecastsolar");
    if (!forecastsolar) return;

    const timezone = this.homey.clock.getTimezone();
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: timezone }));
    now.setMinutes(0, 0, 0); // round down to full hour

    // Convert object into array with local timestamps
    const data = Object.entries(forecastsolar).map(([timestamp, value]) => {
      const localDate = new Date(new Date(timestamp).toLocaleString("en-US", { timeZone: timezone }));
      return { timestamp: localDate, value: value / 1000 }; // kWh
    });

    // Sort by time
    data.sort((a, b) => a.timestamp - b.timestamp);

    // Filter: keep only from current hour onwards (today + tomorrow automatically included)
    const filtered = data.filter(d => d.timestamp >= now);

    // Build labels and values
    const labels = filtered.map(d =>
      d.timestamp.toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })
    );
    const values = filtered.map(d => d.value.toFixed(2));

    // Chart config
    const chartConfig = {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "PV Forecast",
            data: values,
            borderColor: "orange",
            backgroundColor: "rgba(255,165,0,0.2)",
            fill: true,
            tension: 0.4
          }
        ]
      },
      options: {
        plugins: {
          title: { display: true, text: "Forecast.Solar PV Forecast" },
          legend: { display: false }
        },
        scales: {
          x: { title: { display: true, text: timezone } },
          y: { title: { display: true, text: "kWh" }, beginAtZero: true }
        }
      }
    };

    const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&backgroundColor=white&width=600&height=300&format=png`;

    // Set/update camera image
    if (!this.solarChartImage) {
      this.solarChartImage = await this.homey.images.createImage();
      await this.solarChartImage.setUrl(chartUrl);
      await this.setCameraImage("forecastSolarChart", "Forecast.Solar Chart", this.solarChartImage);
    } else {
      await this.solarChartImage.setUrl(chartUrl);
      await this.solarChartImage.update();
    }

  } catch (err) {
    this.error("Error updating Forecast.Solar chart:", err);
  }
}

async forecastSolarBetweenTimes(args, state) {
  try {
    const { startTime, endTime, threshold } = args;
    if (!startTime || !endTime) {
      this.log('Forecast.Solar: Missing startTime or endTime');
      return false;
    }

    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    if ([sh, sm, eh, em].some(isNaN)) {
      this.log('Forecast.Solar: Invalid time format');
      return false;
    }

    const tz = this.homey.clock.getTimezone();
    const nowLocal = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));

    const windowStart = new Date(nowLocal); windowStart.setHours(sh, sm, 0, 0);
    const windowEnd   = new Date(nowLocal); windowEnd.setHours(eh, em, 0, 0);
    if (windowEnd <= windowStart) windowEnd.setDate(windowEnd.getDate() + 1); // handle midnight wrap

    const forecast = this.getStoreValue('forecastsolar');
    this.log(forecast, 'forecast')
    if (!forecast || Object.keys(forecast).length === 0) {
      this.log('Forecast.Solar: No forecast data');
      return false;
    }

const forecasts = Object.entries(forecast).map(([ts, value]) => {
  // Fix timestamp format for Date parsing
  const date = new Date(ts.replace(' ', 'T'));
  return {
    ts: date,
    value: Number(value) / 1000 // Wh → kWh
  };
});


    const filtered = forecasts.filter(f => f.ts >= windowStart && f.ts < windowEnd);
    const sum = filtered.reduce((acc, f) => acc + f.value, 0);

    this.log(`Forecast.Solar ${startTime}-${endTime}: ${sum.toFixed(2)} kWh (threshold ${threshold})`);
    return sum >= threshold;
  } catch (err) {
    this.error('Forecast.Solar check error', err);
    return false;
  }
}







  async getDetail() {
    this.log('Fetching forecastsolar data');
    this.setCapabilityValue('alarm_generic', true);
    const settings = this.getSettings();
    const lon = this.homey.geolocation.getLongitude();
    const lat = this.homey.geolocation.getLatitude();
    //this.log('lon', lon);
    //this.log('lat', lat);
    const declination = this.getSetting('declination');
    const orientation = this.getSetting('orientation') - 180;
    const kwp = this.getSetting('kwp');
    const damping = this.getSetting('damping') || 1;
    const powerDataUrl = `${baseUrl}/watts/${lat}/${lon}/${declination}/${orientation}/${kwp}`;
    /*
    if (!this.getId()) {
      this.log("Device ID not yet available, retrying...");
      setTimeout(() => {
        this.getDetail();
      }, 2000); // Retry after 2 seconds
      return;
    }
      */
    try {
      const result = await fetch(powerDataUrl);

      if (result.status === 429 || result.status === 404) {
        this.log(`API rate limit reached or error: ${result.status}`);
        this.setCapabilityValue('alarm_generic', true);
        throw new Error('API rate limit or not found');
      }
      this.setCapabilityValue('alarm_generic', false);

      const response = await result.json();
      const forecastsolar = response.result;
      //this.log('forecastsolar', forecastsolar);
      this.setStoreValue('forecastsolar', forecastsolar);
      
      // Convert to Local Time
      var timezone = this.homey.clock.getTimezone();
      const nowUtc = new Date();
      const nowLocal = new Date(nowUtc.toLocaleString("en-US", { timeZone: timezone })); 
      // Round to the closest hour
      const nowDate = new Date(nowUtc.toLocaleString("en-US", { timeZone: timezone }));
      const minutes = nowDate.getMinutes();
      if (minutes >= 30) {
        nowDate.setHours(nowDate.getHours() + 1);
      }
      nowDate.setMinutes(0, 0, 0);  
      const todayDate = nowDate.toISOString().split('T')[0];
      const currentTime = nowDate.toISOString().replace('T', ' ').slice(0, 19);
      this.log(todayDate, 'todaydate');
      this.log(currentTime, 'currentime');

     //const todayDate = nowLocal.toISOString().split('T')[0];  
      //const currentTime = nowLocal.toISOString().replace('T', ' ').slice(0, 19);
      
      //this.log(todayDate, 'todaydate');
      //this.log(currentTime, 'currentime');
      //
      
      //var today = new Date(new Date().toLocaleString("en-US", { timeZone: timezone }))
       
      //const todayDate = new Date().toISOString().split('T')[0];
      //const now = new Date();
      //const currentTime = now.toISOString().replace('T', ' ').slice(0, 19);

      this.calculateTodayForecast(forecastsolar, todayDate, damping);
      this.calculateTomorrowForecast(forecastsolar, damping);
      this.calculateRemainingToday(forecastsolar, todayDate, currentTime, damping);
      this.calculateNextHours(forecastsolar, todayDate, currentTime, damping);
      this.updateForecastSolarChart();
    } catch (error) {
      this.error(`Error fetching forecast data: ${error}`);
    }
  }

  calculateTodayForecast(forecastsolar, todayDate, damping) {
    let today = 0;
    for (const [timestamp, value] of Object.entries(forecastsolar)) {
      if (timestamp.startsWith(todayDate)) {
        today += value;
      }
    }
    today = (today / 1000) * damping;
    if (this.getId()) {
      this.setCapabilityValue('meter_power.today', today);
      this.homey.flow.getDeviceTriggerCard('trigger_today_forecast').trigger(this, { 'dailyforecast': today }, {});
    } else {
      this.log("device ID invalid, cannot set capability");
    }
  }

  calculateTomorrowForecast(forecastsolar, damping) {
    const todayDate = new Date();
    const tomorrowDate = new Date(todayDate);
    tomorrowDate.setDate(todayDate.getDate() + 1);
    const tomorrowString = tomorrowDate.toISOString().split('T')[0];

    let tomorrow = 0;
    for (const [timestamp, value] of Object.entries(forecastsolar)) {
      if (timestamp.startsWith(tomorrowString)) {
        tomorrow += value;
      }
    }
    tomorrow = (tomorrow / 1000) * damping;
    if (this.getId()) {
      this.setCapabilityValue('meter_power.tomorrow', tomorrow);
      this.homey.flow.getDeviceTriggerCard('trigger_tomorrow_forecast').trigger(this, { 'dailyforecasttomorrow': tomorrow }, {});
    } else {
      this.log("device ID invalid, cannot set capability");
    }
  }


  calculateRemainingToday(forecastsolar, todayDate, currentTime, damping) {
    let remaining = 0;
    for (const [timestamp, value] of Object.entries(forecastsolar)) {
      if (timestamp.startsWith(todayDate) && timestamp >= currentTime) {
        remaining += value;
      }
    }
    remaining = (remaining / 1000) * damping;
    if (this.getId()) {
      this.setCapabilityValue('meter_power.todayremaining', remaining);
      this.homey.flow.getDeviceTriggerCard('trigger_today_remaining_forecast').trigger(this, { 'forecastremaining': remaining }, {});
    } else {
      this.log("device ID invalid, cannot set capability");
    }
  }

  calculateNextHours(forecastsolar, todayDate, currentTime, damping) {
    let [nexthour1, nexthour2, nexthour3] = [0, 0, 0];
    let hourCounter = 1;

    for (const [timestamp, value] of Object.entries(forecastsolar)) {
      if (timestamp >= currentTime && hourCounter <= 3) {
        if (hourCounter === 1) nexthour1 = value;
        if (hourCounter === 2) nexthour2 = value;
        if (hourCounter === 3) nexthour3 = value;
        hourCounter++;
      }
    }
    if (this.getId()) {
      this.setCapabilityValue('measure_power.now', nexthour1 * damping);
      this.log('now', nexthour1);
      this.homey.flow.getDeviceTriggerCard('trigger_now_forecast').trigger(this, { 'forecastnow': Number(nexthour1) }, {});
      this.setCapabilityValue('meter_power.nexthour1', nexthour1 * damping / 1000);
      this.setCapabilityValue('meter_power.nexthour2', (nexthour1 + nexthour2) * damping / 1000);
      this.setCapabilityValue('meter_power.nexthour3', (nexthour1 + nexthour2 + nexthour3) * damping / 1000);
    } else {
      this.log("device ID invalid, cannot set capability");
    }
  }
}

module.exports = Forecastsolardevice;
