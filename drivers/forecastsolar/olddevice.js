
'use strict';

const Homey = require('homey');
const { ManagerDrivers } = require('homey');
const fetch = require('node-fetch');
const Sun = require('./../../lib/sun.js');
const baseUrl = 'https://api.forecast.solar/estimate';
const util = require('util');
const setTimeoutPromise = util.promisify(setTimeout);


class Forecastsolardevice extends Homey.Device {
//when settings are changed restart
  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log('Settings changed, restart device...');
    clearTimeout(this.PollingTimeOut);
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
    this.log('Forecastsolar device starting...');
    this.homey.clearInterval(this);
    this.homey.clearTimeout(this);


        this.summary = {
            name: this.getName(),
            kwp: this.getSettings().api,
            orientation: this.getSettings().orientation,
            declination: this.getSettings().declination
        };

this.registerCapabilityListener("button", async(args) => {
          this.log('Start manual update with Button Press')
            await this.getDetail();
              }); 
//this.PollingTimeOut();
this.getDetail();

// FLOWS
	// Triggers
    const triggerNow = this.homey.flow.getDeviceTriggerCard('trigger_now_forecast');
    const triggerToday = this.homey.flow.getDeviceTriggerCard('trigger_today_forecast');
    const triggerTomorrow = this.homey.flow.getDeviceTriggerCard('trigger_tomorrow_forecast');
    const triggerTodayRemaining = this.homey.flow.getDeviceTriggerCard('trigger_today_remaining_forecast');    
}
    
onAdded() {
    this.log('Added device');
}

onDeleted() {
  try {
  this.homey.clearInterval(this);
  this.homey.clearTimeout(this);
  
  this.log('forecastsolar has been deleted');
}
 catch (error) {
      this.error(error);
    }
  }
onUninit(){
  try {
    this.homey.clearInterval(this);
    this.homey.clearTimeout(this);
    
    this.log('forecastsolar has been deleted');
  }
   catch (error) {
        this.error(error);
      }
    }

PollingTimeOut() {
  // timers to run every half hour + 1 minute with saved data
  this.log('Initiate Timers Hourly');
  const now = new Date();
  const minutesUntilNextHour = 60 - now.getMinutes();
  const millisecondsUntilNextHour = minutesUntilNextHour * 60 * 1000;
  this.log('Intermediate update in this amount of minutes', minutesUntilNextHour);
  
this.homey.setTimeout(async () => {
  await this.StartPolling();
}, millisecondsUntilNextHour);

}
//Start van de Polling
StartPolling(){
  this.log('Start API Polling Timeout');
  this.getDetail();
}


// Detail API 
getDetail() {

this.log('Making a forecastsolar Detail');
this.setCapabilityValue('alarm_generic', true);



            const data = this.getData();
            const settings = this.getSettings();
            //get data
            var declination = this.getSetting('declination');
            var orientation = this.getSetting('orientation');
            var orientation = (orientation - 180);
            this.log('Orientation', orientation);
            var kwp = this.getSetting('kwp');
            var damping = this.getSetting('damping');


                       
            // Location
		      	var lon = this.homey.geolocation.getLongitude();
            var lat = this.homey.geolocation.getLatitude();

     
// Power values
const powerDataUrl = `${baseUrl}/watts/${lon}/${lat}/${declination}/${orientation}/${kwp}`;
//this.log(powerDataUrl);
fetch(powerDataUrl)
.then(result => {
  const responseInternals = result[Object.getOwnPropertySymbols(result)[1]];
  const status = responseInternals.status;
  this.log('status', status)
  if (status != 429 ) {
      if (!this.getAvailable()) {
          this.setAvailable().then(result => {
              this.log('Available');
          }).catch(error => {
              this.error('Setting availability failed');
          })
      }

      return result.json();
  } else {            

      this.log('error', status)
      this.setCapabilityValue('alarm_generic', true);
      this.homey.clearInterval(this);
      this.homey.clearTimeout(this);
      this.PollingTimeOut();

      ;

  }
})


			.then(response => {
            //clearInterval(this.checkDay());
            var damping = this.getSetting('damping');
            if (typeof damping === 'number' && !isNaN(damping)) {
                var damping = 1;
            } else {
}


            const forecastsolar = response.result;
           // this.log('response1', response)
           // this.log(forecastsolar, 'forecastsolar');
            //API Error
            var status = response.message.type
            this.log('Status', status)
    
            //TODAY
            var today = 0;
            var todaydate = new Date().toISOString().split('T')[0];
            // Iterate through the result object and sum values for today
            for (const [timestamp, value] of Object.entries(forecastsolar)) {
              if (timestamp.startsWith(todaydate)) {
                today += value;
              }
            }
          var today = (today/1000) * damping;
          //this.log('Total sum for today:', today);
          if (typeof today === 'number' && !isNaN(today)) {
            this.setCapabilityValue('meter_power.today', today);
            this.homey.flow.getDeviceTriggerCard('trigger_today_forecast').trigger(this,{ 'dailyforecast' : today }, {});
          } else {
            this.log('not a numeric value', today);
}
 
          

          //TOMORROW
          var tomorrow = 0
          var todaydate = new Date();
          const tomorrowdate = new Date(todaydate);
          tomorrowdate.setDate(todaydate.getDate() + 1);
          const tomorrowString = tomorrowdate.toISOString().split('T')[0];

            // Iterate through the result object and sum values for tomorrow
            for (const [timestamp, value] of Object.entries(forecastsolar)) {
              if (timestamp.startsWith(tomorrowString)) {
                tomorrow += value;
              }
            }

            var tomorrow = (tomorrow/1000) * damping;
            // Ensure 'tomorrow' is a numeric value before proceeding
            if (typeof tomorrow === 'number' && !isNaN(tomorrow)) {
              this.setCapabilityValue('meter_power.tomorrow', tomorrow);
              this.homey.flow.getDeviceTriggerCard('trigger_tomorrow_forecast').trigger(this, { 'dailyforecasttomorrow': tomorrow }, {});
            } else {
              this.log('not a numeric value', tomorrow);
}
   
          //  this.log('Total sum for tomoworrow:', tomorrow);
          //  this.setCapabilityValue('meter_power.tomorrow', tomorrow);
          //  this.homey.flow.getDeviceTriggerCard('trigger_tomorrow_forecast').trigger(this,{ 'dailyforecasttomorrow' : tomorrow }, {});

            // Todayremaining
            // Get the current date and time in LOCAL TIME
            var timezone = this.homey.clock.getTimezone();
            const now = new Date();
            const todayString = now.toISOString().split('T')[0]; // unchanged
            
            const localNow = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
            const year = localNow.getFullYear();
            const month = String(localNow.getMonth() + 1).padStart(2, '0');
            const day = String(localNow.getDate()).padStart(2, '0');
            const hours = String(localNow.getHours()).padStart(2, '0');
            const minutes = String(localNow.getMinutes()).padStart(2, '0');
            const seconds = String(localNow.getSeconds()).padStart(2, '0');
            
            const currentTime = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
            
       
            var remaining = 0
            // Iterate through the result object and sum values for today from the current hour onwards
            for (const [timestamp, value] of Object.entries(forecastsolar)) {
              if (timestamp.startsWith(todayString) && timestamp >= currentTime) {
                remaining += value;
              }
            }
          var remaining = (remaining/1000) * damping;
          this.log('Remaining today:', remaining);
        	this.setCapabilityValue('meter_power.todayremaining', remaining);
        	this.homey.flow.getDeviceTriggerCard('trigger_today_remaining_forecast').trigger(this,{'forecastremaining' : remaining }, {});

           //currentPower      
           // Initialize sum and current value
           var currentPower = 0;
           var endTime = new Date(localNow.getTime() + (0 * 60 * 60 * 1000)); // Now
           const localNow1 = new Date(now.toLocaleString("en-US", { timeZone: timezone }));
           localNow1.setHours(localNow1.getHours() - 1);
           var currenthour1 = String(localNow1.getHours()).padStart(2, '0');
           var currentTime1 = `${year}-${month}-${day} ${currenthour1}:${minutes}:${seconds}`;
           for (const [timestamp, value] of Object.entries(forecastsolar)) {
             if (timestamp.startsWith(todayString) && timestamp >= currentTime1 && new Date(timestamp) <= endTime) {
               currentPower += value;
             }
           }           

            this.log('currentPower', currentPower)
            var currentPower = currentPower * damping;
            this.setCapabilityValue('measure_power.now', currentPower);
            this.homey.flow.getDeviceTriggerCard('trigger_now_forecast').trigger(this,{ 'forecastnow' : currentPower }, {});
                  
            //Next hour
            var nexthour1 = 0;
            var endTime = new Date(localNow.getTime() + (1 * 60 * 60 * 1000)); // Next 1 hours from now
            for (const [timestamp, value] of Object.entries(forecastsolar)) {
              if (timestamp.startsWith(todayString) && timestamp >= currentTime && new Date(timestamp) <= endTime) {
                nexthour1 += value;
              }
            }
            var nexthour1 = (nexthour1/1000) * damping;
            this.setCapabilityValue('meter_power.nexthour1', nexthour1);
            //Next 2 hours
            var nexthour2 = 0;
            var endTime = new Date(localNow.getTime() + (2 * 60 * 60 * 1000)); // Next 2 hours from now
            for (const [timestamp, value] of Object.entries(forecastsolar)) {
              if (timestamp.startsWith(todayString) && timestamp >= currentTime && new Date(timestamp) <= endTime) {
                nexthour2 += value;
              }
            }
            var nexthour2 = (nexthour2/1000) * damping;
            this.setCapabilityValue('meter_power.nexthour2', nexthour2);
            //Next 3 hours
            var nexthour3 = 0;
            var endTime = new Date(localNow.getTime() + (3 * 60 * 60 * 1000)); // Next 3 hours from now
            for (const [timestamp, value] of Object.entries(forecastsolar)) {
              if (timestamp.startsWith(todayString) && timestamp >= currentTime && new Date(timestamp) <= endTime) {
                nexthour3 += value;
              }
            }
            var nexthour3 = (nexthour3/1000) * damping;
            this.setCapabilityValue('meter_power.nexthour3', nexthour3);
            this.setCapabilityValue('alarm_generic', false);

                          //interval delete
                         // clearInterval(this);
                         this.homey.clearInterval(this);
                         this.homey.clearTimeout(this);
                          // intervl end delete
                       this.PollingTimeOut();

                })
                .catch(error => {
                    this.log(`Error (${error})`);
                });
              }
            }
module.exports = Forecastsolardevice;



 