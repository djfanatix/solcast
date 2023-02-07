
'use strict';

const Homey = require('homey');
const Sun = require('./../../lib/sun.js');
const { ManagerDrivers } = require('homey');
const fetch = require('node-fetch');
const baseUrl = 'https://api.solcast.com.au';


class SolCastdevice extends Homey.Device {

  onInit() {
    this.log('Solcast device starting...');

// Fix to remove measure power from energy tab
    if (this.hasCapability('measure_power.now') === false) {
      this.addCapability('measure_power.now')
      .catch(this.error)
      .then(this.log);
    }
    if (this.hasCapability('measure_power')) {
      this.removeCapability('measure_power')
      .catch(this.error)
      .then(this.log);;
    }
    
// Fix to add todayremaining
      if (this.hasCapability('todayremaining') === false) {
      this.addCapability('todayremaining')
      .catch(this.error)
      .then(this.log);
    }
   
// Fix to remove maintenance
    if (this.hasCapability('button.reset') === true) {
      this.removeCapability('button.reset')
      .catch(this.error)
      .then(this.log);
    }


    //Settings
        this.pollIntervals = [];
        this.summary = {
            name: this.getName(),
            api: this.getSettings().api,
            siteid: this.getSettings().siteid
        };
        this._initilializeTimers();
        this.checkDay();

        
// FLOWS
	// Triggers
    const triggerNow = this.homey.flow.getDeviceTriggerCard('trigger_now');
    const triggerToday = this.homey.flow.getDeviceTriggerCard('trigger_today');
    const triggerTomorrow = this.homey.flow.getDeviceTriggerCard('trigger_tomorrow');
    const triggerTodayRemaining = this.homey.flow.getDeviceTriggerCard('trigger_today_remaining');

    
	// UPLOAD FLOW
	
	let uploadAction = this.homey.flow.getActionCard('upload');
    uploadAction.registerRunListener(async (args, state) => {
      this.log('upload will start')
      var powerac = args['pvoutput'];
      this.log('argsparsed', powerac);
      await this.getUpload(powerac, Number(args.powerac));
    });    
    
    
    /*
    // flow conditions
    let changedStatus = this.homey.flow.getConditionCard("changedStatus");
    changedStatus.registerRunListener(async (args, state) => {
      let result = (await this.getCapabilityValue('invertorstatus') == args.argument_main);
      return Promise.resolve(result);
    })
    */

}
    
onAdded() {
    this.log('Added device');
}

_initilializeTimers() {
          // run script at starting
           this.homey.setInterval(async () => {
            await this.checkDay();
        }, 1000 * 1800);
}

checkDay(){
// Today and sunrise and sunset
			const lon = this.homey.geolocation.getLongitude();
            const lat = this.homey.geolocation.getLatitude();
            let timezone = this.homey.clock.getTimezone();
            let today = new Date(new Date().toLocaleString("en-US",{timeZone: timezone}));
			var sunrise = new Date(new Date().sunrise(lat, lon).toLocaleString("en-US",{timeZone: timezone}));
			var sunset = new Date(new Date().sunset(lat, lon).toLocaleString("en-US",{timeZone: timezone}));
			
			// Convert to hours and add 1 hour for sunrise and sunset
			var sunrisehours = sunrise.getHours();
 			var sunsethours = sunset.getHours();
 			var hoursnow = today.getHours();
 			var sunrisehours = sunrisehours - 1;
 			var sunsethours = sunsethours + 1;


//Check if it is day
  if (hoursnow >= sunrisehours && hoursnow <= sunsethours) {
    var daytime = 1;
  } else {
    var daytime = 0;
  };
  if (daytime === 1) {
  this.log('daytime starting solcast');
  this.getForecast();
  } else {
  this.checkMidnight();
  this.log('It is night');
  }
  }


// Check if it is midnight
checkMidnight() {
this.log('Start Check midnight');
//Time
const lon = this.homey.geolocation.getLongitude();
const lat = this.homey.geolocation.getLatitude();
let timezone = this.homey.clock.getTimezone();
let today = new Date(new Date().toLocaleString("en-US",{timeZone: timezone}));
var hoursnow = today.getHours();
var daydate = today.getDate();

// Check daystored
var daydatestored = this.getStoreValue('daydate');
this.log('daydatestored', daydatestored);


// Check if it is between 00 and 01 LT
if ((hoursnow == 0) && (daydate != daydatestored)){
this.getDailyMidnight()
} else {
};

}
// Midnight update values
getDailyMidnight() {

    this.log('Fetching Daily Solcast Daily at Midnight');

    const data = this.getData();
    const settings = this.getSettings();
    //get data
    var api = this.getSetting('api');
    var siteid = this.getSetting('siteid');

	//Time
	const lon = this.homey.geolocation.getLongitude();
	const lat = this.homey.geolocation.getLatitude();
	let timezone = this.homey.clock.getTimezone();
	let today = new Date(new Date().toLocaleString("en-US",{timeZone: timezone}));
	var hoursnow = today.getHours();
	var daydate = today.getDate();
	//reset daydate
	this.setStoreValue('daydate', daydate);
	//reset api calls
    var apicalls = 0;
    var apicalls = (apicalls + 1);
    this.setSettings({apicalls: apicalls,
  })
  .catch( this.error )


    // Power values
    const powerDataUrl = `${baseUrl}/rooftop_sites/${siteid}/forecasts?format=json&hours=47&api_key=${api}`;
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
                throw result.status;
            }
        })

          .then(response => {
            //today
            const solcast = response;
        //    this.log('Solcast-raw', solcast)
            var today = 0;
            var forecasts = solcast.forecasts,
            i;
            for (i = 0; i < 47; i++)
            {today += forecasts[i].pv_estimate;
            }
            var today = today / 2;
            this.setCapabilityValue('today', today);
			this.homey.flow.getDeviceTriggerCard('trigger_today').trigger(this,{ 'dailyforecast' : today }, {});
            //tomorrow
            var tomorrow = 0;
            var forecasts = solcast.forecasts,
            i;
            for (i = 47; i < forecasts.length; i++)
            {tomorrow += forecasts[i].pv_estimate;
            }
            var tomorrow = tomorrow / 2;
            this.setCapabilityValue('tomorrow', tomorrow);
            this.homey.flow.getDeviceTriggerCard('trigger_tomorrow').trigger(this,{ 'dailyforecasttomorrow' : tomorrow }, {});

        })
                //errors
                .catch(error => {
                    this.log(`Unavailable (${error})`);
                    this.setUnavailable(`Error retrieving data (${error})`);
                });
}

// Interval every half hour between sunrise and sunset
getForecast() {

this.log('Fetching Solcast Hourly values');

            const data = this.getData();
            const settings = this.getSettings();
            //get data
            var api = this.getSetting('api');
            var siteid = this.getSetting('siteid');
            var apicalls = this.getSetting('apicalls');
            var apicalls = (apicalls + 1);
            
            // Today and sunrise and sunset
			const lon = this.homey.geolocation.getLongitude();
            const lat = this.homey.geolocation.getLatitude();
            let timezone = this.homey.clock.getTimezone();
            let today = new Date(new Date().toLocaleString("en-US",{timeZone: timezone}));
			var sunrise = new Date(new Date().sunrise(lat, lon).toLocaleString("en-US",{timeZone: timezone}));
			var sunset = new Date(new Date().sunset(lat, lon).toLocaleString("en-US",{timeZone: timezone}));
			//	this.log('sunrise', sunrise);
			//	this.log('sunset', sunset);
			
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
 			this.setSettings({apicalls: apicalls,
				  })
 			 .catch( this.error )


 			const powerDataUrl = `${baseUrl}/rooftop_sites/${siteid}/forecasts?format=json&hours=${hourstommorrow}&api_key=${api}`;
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
                        throw result.status;
                    }
                })
			.then(response => {
            const solcast = response;
            // Todayremaining
            var remaining = 0;
            var forecastsremaining = solcast.forecasts,
            i;
            for (i = 0; i < halfhourstoday; i++)
            {remaining += forecastsremaining[i].pv_estimate;
            }
            var remaining = remaining / 2;
            //	this.log('remaining', remaining);
        	this.setCapabilityValue('todayremaining', remaining);
        	this.homey.flow.getDeviceTriggerCard('trigger_today_remaining').trigger(this,{'forecastremaining' : remaining }, {});
            //tomorrow
            var tomorrow = 0;
            var forecasts = solcast.forecasts,
            i;
            for (i = (halfhourstoday); i < halfhourstommorrow; i++)
            {tomorrow += forecasts[i].pv_estimate;
            }
            var tomorrow = tomorrow / 2;
            	// this.log('tomorrow', tomorrow);
            this.setCapabilityValue('tomorrow', tomorrow);
            this.homey.flow.getDeviceTriggerCard('trigger_tomorrow').trigger(this,{ 'dailyforecasttomorrow' : tomorrow }, {});
           //currentPower
            const data = response;
            var currentPower = data['forecasts'][0]['pv_estimate'];
            var currentPower = currentPower*1000
            this.setCapabilityValue('measure_power.now', currentPower);
            this.homey.flow.getDeviceTriggerCard('trigger_now').trigger(this,{ 'forecastnow' : tomorrow }, {});
       
            
            //Next hour
            var next1 = data['forecasts'][0]['pv_estimate'];
            var next2 = data['forecasts'][1]['pv_estimate'];
            var nexthour1 = (next1 + next2) / 2
            this.setCapabilityValue('nexthour1', nexthour1);
            //Next 2 hours
            var next3 = data['forecasts'][2]['pv_estimate'];
            var next4 = data['forecasts'][3]['pv_estimate'];
            var nexthour2 = (next1 + next2 + next3 + next4) / 2
            this.setCapabilityValue('nexthour2', nexthour2);
            //Next 3 hours
            var next5 = data['forecasts'][4]['pv_estimate'];
            var next6 = data['forecasts'][5]['pv_estimate'];
            var nexthour3 = (next1 + next2 + next3 + next4 + next5 + next6) / 2
            this.setCapabilityValue('nexthour3', nexthour3);
                })
                .catch(error => {
                    this.log(`Unavailable (${error})`);
                    this.setUnavailable(`Error retrieving data (${error})`);
                });
              }
///////////
getUpload(powerac) {
    this.log('Upload Solcast');
    const isoDate = new Date().toISOString();
    const uploadPower = powerac;
  	//  this.log('uploadPower', uploadPower);
    const data = this.getData();
    const settings = this.getSettings();
    //get data
    var api = this.getSetting('api');
    var siteid = this.getSetting('siteid');

    // Power values
      const body = `{"measurement": {"period_end": "${isoDate}", "period": "PT5M", "total_power": ${uploadPower}}}`;
//  this.log('body', body);
    const powerDataUrl = `${baseUrl}/rooftop_sites/${siteid}/measurements/?api_key=${api}`;
//      this.log(powerDataUrl);
//       &hours=x is the amount hours to receive
    fetch(powerDataUrl, {
            method: 'post',
          //  body:    JSON.stringify(body),
            body:    body,
            headers: { 'Content-Type': 'application/json' },
        })
        //.then(res => console.log(res));
      }
            }
        module.exports = SolCastdevice;
