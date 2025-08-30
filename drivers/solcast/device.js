
'use strict';

const Homey = require('homey');
const { ManagerDrivers } = require('homey');
const Sun = require('./../../lib/sun.js');
const fetch = require('node-fetch');
const baseUrl = 'https://api.solcast.com.au';
const util = require('util');
const setTimeoutPromise = util.promisify(setTimeout);
//const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
//const { buildChartImageUrl } = require('../charts');


class SolCastdevice extends Homey.Device {

  //when settings are changed restart
  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log('Settings changed, restart device...');
    this.restartDevice(1000);
  }
  async restartDevice(delay) {
    if (this.restarting) return;
    this.restarting = true;
    const dly = delay || 2000;
    this.log(`Device will restart in ${dly / 1000} seconds`);
    // this.setUnavailable('Device is restarting. Wait a few minutes!');
    await setTimeoutPromise(dly).then(() => this.onInit());
  }

  onInit() {
    this.log('Solcast device starting...');

    if (!this.getStoreValue('apicallstoday')) {
      this.setStoreValue('apicallstoday', 0); // Initialize as 0
    }

    //clearInterval(this,checkDaytime());
    clearInterval(this);
    clearTimeout(this);

    this.registerCapabilityListener("button", async (args) => {
      this.log('Start manual polling with Button Press')
      await this.getForecast();
    });
  
  // Flow condition card for Solcast between times
this.homey.flow
  .getConditionCard('solcast_forecast_between_times')
  .registerRunListener(async (args, state) => {
    const { startTime, endTime, threshold } = args;

    // Pass as a single object to match the device method signature
    return args.device.solcastForecastBetweenTimes({ startTime, endTime, threshold }, state);
  });
    //Update Graph
    this.updateForecastChart();


    this.summary = {
      name: this.getName(),
      api: this.getSettings().api,
      siteid: this.getSettings().siteid
    };



    // FLOWS
    // Triggers
    const triggerNow = this.homey.flow.getDeviceTriggerCard('trigger_now');
    const triggerToday = this.homey.flow.getDeviceTriggerCard('trigger_today');
    const triggerTomorrow = this.homey.flow.getDeviceTriggerCard('trigger_tomorrow');
    const triggerTodayRemaining = this.homey.flow.getDeviceTriggerCard('trigger_today_remaining');
    const apiratelimited = this.homey.flow.getDeviceTriggerCard('trigger_apiratelimited');
    
  }

  onAdded() {
    this.log('Added device');
  }
  polling() {
    this.getForecast();
  }

  upload() {
    this.getUpload();
  }

  midnightfetch() {

    this.getMidnight();
    //this.checkDaytime() //ONLY FOR DEBUG
  }

  onDeleted() {


    this.log('Solcast has been deleted');
    clearTimeout(this.intermediateTimeOut);
    clearInterval(this);
    clearTimeout(this);
  }

  _intermediateTimers() {
    // timers to run every half hour + 1 minute with saved data
    this.log('Intermediatetimersrunning');
    const now = new Date();
    const minutesUntilNextHalfHour = 31 - (now.getMinutes() % 30);
    const millisecondsUntilNextHalfHour = minutesUntilNextHalfHour * 60 * 1000;
    this.log('Intermediate update in this amount of minutes', minutesUntilNextHalfHour);


    this.homey.setTimeout(async () => {
      await this.intermediateTimeOut();
    }, millisecondsUntilNextHalfHour);

  }
  //Start van de timer + initiele call
  intermediateTimeOut() {
    this.log('Intermediatetimeout active');
    this.checkDaytime();
    /*
      this.homey.setInterval(async () => {
        await this.checkDaytime();
    }, 1000 * 30 * 60);
    */
  }


  checkDaytime() {
    this.log('Start Check day'); //REMOVE
    // Today and sunrise and sunset
    var lon = this.homey.geolocation.getLongitude();
    var lat = this.homey.geolocation.getLatitude();
    var timezone = this.homey.clock.getTimezone();
    var today = new Date(new Date().toLocaleString("en-US", { timeZone: timezone }));
    var sunrise = new Date(new Date().sunrise(lat, lon).toLocaleString("en-US", { timeZone: timezone }));
    var sunset = new Date(new Date().sunset(lat, lon).toLocaleString("en-US", { timeZone: timezone }));
    var daydate = today.getDate();

    // Convert to hours and add 1 hour for sunrise and sunset
    var sunrisehours = sunrise.getHours();
    var sunsethours = sunset.getHours();
    var hoursnow = today.getHours();

    //Check if it is day or night
    if (hoursnow >= sunrisehours && hoursnow <= sunsethours) {
      var daytime = 1;
    } else {
      var daytime = 0;
    };
    this.setStoreValue('daytime', daytime);


    // Check of het een nieuwe dag is
    // Check daystored
    var daydatestored = this.getStoreValue('daydate');
    if (daydate != daydatestored) {
      var apicallstoday = 0;
      this.setCapabilityValue('apicalls', apicallstoday);
      this.setStoreValue('apicallstoday', apicallstoday);
      this.setStoreValue('daydate', daydate);
    } else {
    };
    // Check of het apiinterval correct is
    const data = this.getStoreValue('solcast');
    var intermediateapicalls = this.getStoreValue('intermediateapicalls');
    var intermediateapicalls = intermediateapicalls + 1
    var periodend = data['forecasts'][intermediateapicalls]['period_end'];
    var periodend = new Date(periodend.toLocaleString("en-US"));
    //REMOVE
    this.log('period_end', periodend)

    var datum = new Date(new Date().toLocaleString("en-US"));
    // Round to the next half-hour
    datum.setMilliseconds(0);
    datum.setSeconds(0);
    datum.setMinutes(datum.getMinutes() + (30 - datum.getMinutes() % 30));
    //REMOVE
    this.log('datumnieuw', datum)
    var apicorrect = 5
    if (datum.getTime() === periodend.getTime()) {
      var apicorrect = 1
      this.log('times do match good', apicorrect);
    }
    else {
      var apicorrect = 0
      this.log('times do not match', apicorrect);

    }

    // Intermediate runnen indien het dag is
    if (daytime === 1 && apicorrect === 1) {
      this.log('daytime starting solcast intermediate');
      this.checkIntermediate()
    } else {
      this.log('It is night or times do not match for intermediate');
      clearInterval(this);
      clearTimeout(this);
    }
  }


  //Effectief script
  checkIntermediate() {
    this.log('start solcast intermediate'); //REMOVE
    var solcast = this.getStoreValue('solcast');
    // this.log(solcast, 'solcast')
    var intermediateapicalls = this.getStoreValue('intermediateapicalls');
    var intermediateapicalls = intermediateapicalls + 1;
    this.log(intermediateapicalls, 'intermediateapicalls') //remove

    // Check aantal uren
    // Today and sunrise and sunset
    var lon = this.homey.geolocation.getLongitude();
    var lat = this.homey.geolocation.getLatitude();
    var timezone = this.homey.clock.getTimezone();
    var today = new Date(new Date().toLocaleString("en-US", { timeZone: timezone }));
    var sunrise = new Date(new Date().sunrise(lat, lon).toLocaleString("en-US", { timeZone: timezone }));
    var sunset = new Date(new Date().sunset(lat, lon).toLocaleString("en-US", { timeZone: timezone }));

    // Convert to hours and add 1 hour for sunrise and sunset
    var sunrisehours = sunrise.getHours();
    var sunsethours = sunset.getHours();
    var sunrisehours = sunrisehours - 1;
    var sunsethours = sunsethours + 1;
    //	this.log('sunsethours', sunsethours);
    var hoursnow = today.getHours();
    //	this.log('hoursnow', hoursnow);

    // Convert to half hours for api
    //hourstoday = hours until sunset (half hours interval)
    var hourstoday = (sunsethours - hoursnow);
    var halfhourstoday = hourstoday * 2;


    //declare variables

    const data = solcast;

    // Todayremaining
    var remaining = 0;
    var forecastsremaining = solcast.forecasts,
      i;
    for (i = intermediateapicalls; i < halfhourstoday; i++) {
      remaining += forecastsremaining[i].pv_estimate;
    }
    var remaining = remaining / 2;
    //this.log('remaining intermediate', remaining);
    this.setCapabilityValue('meter_power.todayremaining', remaining);
    this.homey.flow.getDeviceTriggerCard('trigger_today_remaining').trigger(this, { 'forecastremaining': remaining }, {});
    //currentPower
    var currentPower = data['forecasts'][intermediateapicalls]['pv_estimate'];
    var currentPower = currentPower * 1000
    this.setCapabilityValue('measure_power.now', currentPower);
    this.homey.flow.getDeviceTriggerCard('trigger_now').trigger(this, { 'forecastnow': currentPower }, {});
    //Next hour
    var next1 = data['forecasts'][(intermediateapicalls + 0)]['pv_estimate'];
    var next2 = data['forecasts'][(intermediateapicalls + 1)]['pv_estimate'];
    var nexthour1 = (next1 + next2) / 2
    this.setCapabilityValue('meter_power.nexthour1', nexthour1);
    //Next 2 hours
    var next3 = data['forecasts'][(intermediateapicalls + 2)]['pv_estimate'];
    var next4 = data['forecasts'][(intermediateapicalls + 3)]['pv_estimate'];
    var nexthour2 = (next1 + next2 + next3 + next4) / 2
    this.setCapabilityValue('meter_power.nexthour2', nexthour2);
    //Next 3 hours
    var next5 = data['forecasts'][(intermediateapicalls + 4)]['pv_estimate'];
    var next6 = data['forecasts'][(intermediateapicalls + 5)]['pv_estimate'];
    var nexthour3 = (next1 + next2 + next3 + next4 + next5 + next6) / 2
    this.setCapabilityValue('meter_power.nexthour3', nexthour3);

    //update numbers
    //var intermediateapicalls = (intermediateapicalls + 1);
    this.setStoreValue('intermediateapicalls', intermediateapicalls);
    this._intermediateTimers()
        // update Graph
    this.updateForecastChart();
  }

// args: { startTime: "HH:mm", endTime: "HH:mm", threshold: number }
async solcastForecastBetweenTimes(args, state) {
  try {
    const { startTime, endTime, threshold } = args;
    if (!startTime || !endTime) { this.log('Solcast: Missing start/end'); return false; }

    // parse
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    if ([sh, sm, eh, em].some(n => Number.isNaN(n))) { this.log('Solcast: Bad time format'); return false; }

    const tz = this.homey.clock.getTimezone();
    const nowLocal = new Date(new Date().toLocaleString('en-US', { timeZone: tz }));
    const windowStart = new Date(nowLocal); windowStart.setHours(sh, sm, 0, 0);
    const windowEnd   = new Date(nowLocal); windowEnd.setHours(eh, em, 0, 0);
    if (windowEnd <= windowStart) windowEnd.setDate(windowEnd.getDate() + 1); // crosses midnight

    const store = this.getStoreValue('solcast');
    if (!store || !Array.isArray(store.forecasts)) { this.log('Solcast: No forecasts'); return false; }

    let sumKWh = 0;
    let picked = 0;

    for (const f of store.forecasts) {
      // determine bucket start (use period_start if present, otherwise infer from period_end)
      const periodStartRaw = f.period_start || null;
      const periodEndRaw   = f.period_end   || null;

      // parse minutes for this bucket (priority: f.period -> difference between period_end/period_start -> default 30)
      let minutes = 30;
      if (f.period && /^PT(\d+)M$/.test(f.period)) {
        minutes = parseInt(f.period.match(/^PT(\d+)M$/)[1], 10);
      } else if (periodStartRaw && periodEndRaw) {
        minutes = Math.round((new Date(periodEndRaw) - new Date(periodStartRaw)) / 60000);
      }

      // parse period_start into local Date
      const bucketStartUtc = periodStartRaw ? new Date(periodStartRaw) :
                             (periodEndRaw ? new Date(new Date(periodEndRaw).getTime() - minutes*60000) : null);
      if (!bucketStartUtc) continue;

      const bucketStartLocal = new Date(bucketStartUtc.toLocaleString('en-US', { timeZone: tz }));

      // include if period_start is inside [windowStart, windowEnd)
      const inside = (bucketStartLocal >= windowStart && bucketStartLocal < windowEnd);
      // Convert pv_estimate (power, kW) -> energy (kWh) for this bucket:
      const power_kW = Number(f.pv_estimate) || 0;
      const energy_kWh = power_kW * (minutes / 60);

      this.log(`bucket start=${bucketStartLocal.toISOString().replace('T',' ').slice(0,19)} mins=${minutes} power=${power_kW}kW energy=${energy_kWh.toFixed(4)}kWh inside=${inside}`);

      if (inside) {
        sumKWh += energy_kWh;
        picked++;
      }
    }

    this.log(`Picked ${picked} buckets. Window ${startTime}-${endTime} total = ${sumKWh.toFixed(3)} kWh (threshold ${threshold})`);
    return sumKWh >= Number(threshold);
  } catch (err) {
    this.error('Solcast between-times error', err);
    return false;
  }
}









  // Midnight update values
  getMidnight() {

    this.log('Fetching Daily Solcast Daily at Midnight');
    this.setCapabilityValue('alarm_generic', true);

    var data = this.getData();
    var settings = this.getSettings();
    //get data
    var api = this.getSetting('api');
    var siteid = this.getSetting('siteid');

    // Power values
    const powerDataUrl = `${baseUrl}/rooftop_sites/${siteid}/forecasts?format=json&hours=47&api_key=${api}`;
   // const powerDataUrl = `${baseUrl}/rooftop_sites/${siteid}/estimated_actuals?format=json&hours=47&api_key=${api}`;
    //      this.log(powerDataUrl);
    //       &hours=x is the amount hours to receive
    fetch(powerDataUrl)
      .then(result => {
        if (result.ok || result.status === 304) {
          if (!this.getAvailable()) {
            this.setAvailable().then(result => {
              this.log('Available');
            }).catch(error => {
              this.error('Setting availability failed');
            })
          }

          return result.json();
        } else {
          var apicallstoday = this.getStoreValue('apicallstoday');
          this.homey.flow.getDeviceTriggerCard('trigger_apiratelimited').trigger(this, { 'apirate': Number(apicallstoday) }, {});
          throw result.status;
        }
      })

      .then(response => {
        const solcast = response;
        this.setStoreValue('solcast', solcast);
        //    TODAY
        var today = 0;
        var forecasts = solcast.forecasts,
          i;
        for (i = 0; i < 47; i++) {
          today += forecasts[i].pv_estimate;
        }
        var today = today / 2;
        this.setCapabilityValue('meter_power.today', today);
        this.homey.flow.getDeviceTriggerCard('trigger_today').trigger(this, { 'dailyforecast': today }, {});

        //tomorrow
        var tomorrow = 0;
        var forecasts = solcast.forecasts,
          i;
        for (i = 47; i < forecasts.length; i++) {
          tomorrow += forecasts[i].pv_estimate;
        }
        var tomorrow = tomorrow / 2;
        this.setCapabilityValue('meter_power.tomorrow', tomorrow);
        this.homey.flow.getDeviceTriggerCard('trigger_tomorrow').trigger(this, { 'dailyforecasttomorrow': tomorrow }, {});

        //Time
        var lon = this.homey.geolocation.getLongitude();
        var lat = this.homey.geolocation.getLatitude();
        var timezone = this.homey.clock.getTimezone();
        var today = new Date(new Date().toLocaleString("en-US", { timeZone: timezone }));
        var hoursnow = today.getHours();
        var daydate = today.getDate();
        // Check of het een nieuwe dag is
        // Check daystored
        var daydatestored = this.getStoreValue('daydate');
        if (daydate != daydatestored) {
          var apicallstoday = 1;
          this.setCapabilityValue('apicalls', apicallstoday);
          this.setStoreValue('apicallstoday', apicallstoday);
          this.setStoreValue('daydate', daydate);

        } else {
        };
        this.setCapabilityValue('alarm_generic', false);
        this.updateForecastChart();
      })
      //errors
      .catch(error => {
        this.log(`Unavailable (${error})`);
        var apicallstoday = this.getStoreValue('apicallstoday');
        this.homey.flow.getDeviceTriggerCard('trigger_apiratelimited').trigger(this, { 'apirate': apicallstoday }, {});
        this.setCapabilityValue('alarm_generic', true);

        //this.setUnavailable(`Error retrieving data (${error})`);
      });
  }

 
  //camera copy van gruiter
/*
    async updatePriceCharts() {
    const urlToday = await charts.getPriceChart(this.state.pricesThisDay);
    if (!this.todayPriceImage) {
      this.todayPriceImage = await this.homey.images.createImage();
      await this.todayPriceImage.setUrl(urlToday);
      await this.setCameraImage('todayPriceChart', ` ${this.homey.__('today')}`, this.todayPriceImage);
    } else {
      await this.todayPriceImage.setUrl(urlToday);
      await this.todayPriceImage.update();
    }

    const urlTomorow = await charts.getPriceChart(this.state.pricesTomorrow, 0, this.state.pricesTomorrowMarketLength);
    if (!this.tomorrowPriceImage) {
      this.tomorrowPriceImage = await this.homey.images.createImage();
      await this.tomorrowPriceImage.setUrl(urlTomorow);
      await this.setCameraImage('tomorrowPriceChart', ` ${this.homey.__('tomorrow')}`, this.tomorrowPriceImage);
    } else {
      await this.tomorrowPriceImage.setUrl(urlTomorow);
      await this.tomorrowPriceImage.update();
    }
*/
    //stop copy
//Camera test

async updateForecastChart() {
  try {
      const solcast = await this.getStoreValue('solcast');
          if (!solcast || !solcast.forecasts) return;

          const timezone = this.homey.clock.getTimezone();
          const now = new Date();
          const today = new Date(now.toLocaleString("en-US", { timeZone: timezone }))
            .toISOString()
            .split("T")[0];
          const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
            .toLocaleString("en-US", { timeZone: timezone });
          const tomorrowISO = new Date(tomorrow).toISOString().split("T")[0];

          // Filter only today & tomorrow
          const forecasts = solcast.forecasts.filter(f => {
            const date = f.period_end.split("T")[0];
            return date === today || date === tomorrowISO;
          });

          if (!forecasts.length) return;

          // Build arrays
          const labels = forecasts.map(f =>
            new Date(f.period_end).toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: timezone
            })
          );

    const values = forecasts.map(f => f.pv_estimate);
    const data10 = forecasts.map(f => f.pv_estimate10);
    const data90 = forecasts.map(f => f.pv_estimate90);

    const chartConfig = {
      type: 'line',
      backgroundColor: 'rgba(255, 254, 254, 0.7)',
      data: {
        labels,
        datasets: [
          {
            label: 'PV Expected (kW)',
            data: values,
            borderColor: 'rgba(224, 145, 19, 0.2)',
            backgroundColor: 'rgba(224, 145, 19, 0.2)',
            fill: true,
            tension: 0.3
          },
          {
            label: 'PV Pessimistic (kW)',
            data: data10,
            borderColor: 'rgba(18, 78, 231, 0.5)',
            backgroundColor: 'rgba(18, 78, 231, 0.5)',
            borderDash: [5, 5],
            fill: false,
            tension: 0.3
          },
          {
            label: 'PV Optimistic (kW)',
            data: data90,
            borderColor: 'rgba(20, 214, 17, 0.7)',
            backgroundColor: 'rgba(20, 214, 17, 0.7)',
            borderDash: [5, 5],
            fill: false,
            tension: 0.3
          }
        ]
      },
      options: {
        plugins: {
          legend: { display: true },
          title: { display: true, text: 'Solar Forecast Today & Tomorrow' }
        },
        scales: { y: { beginAtZero: true } },
        backgroundColor: 'rgba(255, 254, 254, 0.7)'
      }
    };

    await this.setStoreValue("forecastChartConfig", chartConfig);
    
    const chartUrl = `https://quickchart.io/chart?c=${encodeURIComponent(JSON.stringify(chartConfig))}&backgroundColor=white&width=600&height=300&format=png`;

    // --- Homey image workflow ---
    if (!this.solcastChartImage) {
      this.solcastChartImage = await this.homey.images.createImage();
      await this.solcastChartImage.setUrl(chartUrl);
      await this.setCameraImage('solcastChart', 'Solar Forecast', this.solcastChartImage);
    } else {
      await this.solcastChartImage.setUrl(chartUrl);
      await this.solcastChartImage.update();
    }

    this.log('Forecast chart updated successfully');
  } catch (err) {
    this.log('Error updating forecast chart', err);
  }
}


//Camera test stop
  // Forecast
  getForecast() {

    this.log('Making a Solcast API Call');
    this.setCapabilityValue('alarm_generic', true);


    const data = this.getData();
    const settings = this.getSettings();
    //get data
    var api = this.getSetting('api');
    var siteid = this.getSetting('siteid');


    // Today and sunrise and sunset
    var lon = this.homey.geolocation.getLongitude();
    var lat = this.homey.geolocation.getLatitude();
    var timezone = this.homey.clock.getTimezone();
    var today = new Date(new Date().toLocaleString("en-US", { timeZone: timezone }));
    var sunrise = new Date(new Date().sunrise(lat, lon).toLocaleString("en-US", { timeZone: timezone }));
    var sunset = new Date(new Date().sunset(lat, lon).toLocaleString("en-US", { timeZone: timezone }));


    // Convert to hours and add 1 hour for sunrise and sunset
    var sunrisehours = sunrise.getHours();
    var sunsethours = sunset.getHours();

    var sunrisehours = sunrisehours - 1;
    var sunsethours = sunsethours + 1;
    //	this.log('sunsethours', sunsethours);
    var hoursnow = today.getHours();
    //	this.log('hoursnow', hoursnow);

    // Convert to half hours for api
    //hourstoday = hours until sunset (half hours interval)
    var hourstoday = (sunsethours - hoursnow);
    var halfhourstoday = hourstoday * 2;
    // this.log('hourstoday corrected', halfhourstoday);
    var hourstommorrow = (hourstoday + 25);
    var halfhourstommorrow = hourstommorrow * 2;
    //	this.log('hourstommorow corrected', halfhourstommorrow);


    const powerDataUrl = `${baseUrl}/rooftop_sites/${siteid}/forecasts?format=json&hours=${hourstommorrow}&api_key=${api}`;
    //const powerDataUrl = `${baseUrl}/rooftop_sites/${siteid}/estimated_actuals?format=json&hours=47&api_key=${api}`;
    fetch(powerDataUrl)
      .then(result => {
        if (result.ok || result.status === 304) {
          if (!this.getAvailable()) {
            this.setAvailable().then(result => {
              this.log('Available');
            }).catch(error => {
              this.error('Setting availability failed');
            })
          }

          return result.json();
        } else {
          var apicallstoday = this.getStoreValue('apicallstoday');
          this.setCapabilityValue('apicalls', apicallstoday);
          this.setStoreValue('apicallstoday', apicallstoday);
          this.homey.flow.getDeviceTriggerCard('trigger_apiratelimited').trigger(this, { 'apirate': apicallstoday }, {});
          throw result.status;
        }
      })
      .then(response => {
        //clearInterval(this.checkDay());

        const solcast = response;
        this.log('raw data', solcast)
        this.setStoreValue('solcast', solcast);
        // maak een teller aan
        var intermediateapicalls = 0
        this.setStoreValue('intermediateapicalls', intermediateapicalls);
        // Todayremaining
        var remaining = 0;
        var forecastsremaining = solcast.forecasts,
          i;
        for (i = 0; i < halfhourstoday; i++) {
          remaining += forecastsremaining[i].pv_estimate;
        }
        var remaining = remaining / 2;
        //this.log('remaining', remaining);
        this.setCapabilityValue('meter_power.todayremaining', remaining);
        this.homey.flow.getDeviceTriggerCard('trigger_today_remaining').trigger(this, { 'forecastremaining': remaining }, {});
        //tomorrow
        var tomorrow = 0;
        var forecasts = solcast.forecasts,
          i;
        for (i = (halfhourstoday); i < halfhourstommorrow; i++) {
          tomorrow += forecasts[i].pv_estimate;
        }
        var tomorrow = tomorrow / 2;
        // this.log('tomorrow', tomorrow);
        this.setCapabilityValue('meter_power.tomorrow', tomorrow);
        this.homey.flow.getDeviceTriggerCard('trigger_tomorrow').trigger(this, { 'dailyforecasttomorrow': tomorrow }, {});
        //currentPower
        const data = response;
        var currentPower = data['forecasts'][0]['pv_estimate'];
        var currentPower = currentPower * 1000
        this.setCapabilityValue('measure_power.now', currentPower);
        this.homey.flow.getDeviceTriggerCard('trigger_now').trigger(this, { 'forecastnow': currentPower }, {});


        //Next hour
        var next1 = data['forecasts'][0]['pv_estimate'];
        var next2 = data['forecasts'][1]['pv_estimate'];
        var nexthour1 = (next1 + next2) / 2
        this.setCapabilityValue('meter_power.nexthour1', nexthour1);
        //Next 2 hours
        var next3 = data['forecasts'][2]['pv_estimate'];
        var next4 = data['forecasts'][3]['pv_estimate'];
        var nexthour2 = (next1 + next2 + next3 + next4) / 2
        this.setCapabilityValue('meter_power.nexthour2', nexthour2);
        //Next 3 hours
        var next5 = data['forecasts'][4]['pv_estimate'];
        var next6 = data['forecasts'][5]['pv_estimate'];
        var nexthour3 = (next1 + next2 + next3 + next4 + next5 + next6) / 2
        this.setCapabilityValue('meter_power.nexthour3', nexthour3);
        //
        var apicallstoday = this.getStoreValue('apicallstoday');
        var apicallstoday = (apicallstoday + 1);
        this.setStoreValue('apicallstoday', apicallstoday);
        //delete het interval
        var resetapi = 0
        this.setStoreValue('resetapi', resetapi);
        //interval delete
        clearInterval(this);
        clearTimeout(this);
        // intervl end delete
        this._intermediateTimers();
        //
        this.setCapabilityValue('apicalls', apicallstoday);
        //delay voor capability
        //const dly = delay || 2000;
        //await setTimeoutPromise(dly).then(() => this.setCapabilityValue('alarm_generic', false);
        this.setCapabilityValue('alarm_generic', false);
                // update camers
    this.updateForecastChart();


      })
      .catch(error => {
        this.log(`Unavailable (${error})`);
        var apicallstoday = this.getStoreValue('apicallstoday');
        this.homey.flow.getDeviceTriggerCard('trigger_apiratelimited').trigger(this, { 'apirate': apicallstoday }, {});
        this.setCapabilityValue('alarm_generic', true);
        //this.setUnavailable(`Error retrieving data (${error})`);
      });
  }
}
module.exports = SolCastdevice;



