
'use strict';

const Homey = require('homey');
const Sun = require('./../../lib/sun.js');
const { ManagerDrivers } = require('homey');
const fetch = require('node-fetch');
const baseUrl = 'https://api.solcast.com.au';

class SolCastdevice extends Homey.Device {

   onInit() {
    this.log('Solcast device starting...');

    //Energy fix
  this.addCapability('measure_temperature')
  .catch(this.error)
  .then(this.log);

    /*
    if (this.hasCapability('measure_power.now') === false) {
      // You need to check if migration is needed
      // do not call addCapability on every init!
      this.addCapability('measure_power.now');
    }
    if (this.hasCapability('measure_power')) {
      // You need to check if migration is needed
      // do not call addCapability on every init!
      this.removeCapability('measure_power');
    }
    */
    //test
//    this.setCapabilityValue('measure_power.now', 5);
    //cronTask
    try {
        this.log('Initializing Crontask');

        if (this.getStoreValue('cronTask') === null) {
            this.createCronTask();
        } else {
            this.initializeCronTask();
        }
    } catch (error) {
        this.error(error)
    }

    //Settings
        this.pollIntervals = [];
        this.summary = {
            name: this.getName(),
            api: this.getSettings().api,
            siteid: this.getSettings().siteid
        };
        this._initilializeTimers();
        this.getForecast();
        //FlowCardAction for upload
      let uploadAction = new Homey.FlowCardAction('upload');
      uploadAction
      .register()
      .registerRunListener(( args, state ) => {
            this.log('upload will start')
            var powerac = args['pvoutput'];
            this.log('argsparsed', powerac);
            let uploadSet = this.getUpload(powerac);
            return Promise.resolve(uploadSet);
      })
}
onAdded() {
    this.log('Added device');
}

onDeleted() {
    this.deleteCronTask();
    this.log('Deleted device');
}

initializeCronTask() {
    const taskName = this.getStoreValue('cronTask');
    Homey.ManagerCron.getTask(taskName)
        .then(result => {
            result.on('run', data => {
                this.log(`Running task ${taskName}`);
                this.getDaily();
            });
            this.log(`Initialized cron job ${taskName}`);
        }).catch(error => {
            this.error(`Failed retrieving cron job ${taskName}`);
            this.createCronTask();
        });
}

createCronTask() {
    const taskName = 'midnight';
    Homey.ManagerCron.registerTask(taskName, this.getCronString(), this.getData())
        .then(task => {
            this.log(`Cron job ${taskName} created successfully`);
            this.setStoreValue('cronTask', taskName).catch(error => {
                this.error('Failed setting cron task name');
            });
            this.initializeCronTask(taskName);
        }).catch(error => {
            this.error(`Cron job creation failed (${error})`);
        });
}

deleteCronTask() {
    const taskName = this.getStoreValue('cronTask');
    Homey.ManagerCron.unregisterTask(taskName)
        .then(result => {
            this.log('Cron job deleted successfully');
        }).catch(error => {
            this.error(`Cron job deletion failed (${error}`);
        });
}
//interval for daily values
  getCronString() {
                // Everyday at midnight
                return '0 0 * * *'
            }
        //polling
  _initilializeTimers() {
          // run script at starting
          this.pollIntervals.push(setInterval(() => {
          this.checkDay()
        }, 1000 * 1800))
      }

checkDay(){
  const lat = (Homey.ManagerGeolocation.getLatitude()).toString();
  const lon = (Homey.ManagerGeolocation.getLongitude()).toString();
  var sunrise = new Date().sunrise(lat, lon);
  var sunset = new Date().sunset(lat, lon);
  //var sunrisehours = sunrise.getHours();
  //var sunsethours = sunset.getHours();
  var today = new Date();
  sunset.setHours(sunset.getHours() + 1);
  sunrise.setHours(sunrise.getHours() - 1);
  //var timenow= today.getUTCHours();
  if (today >= sunrise && today <= sunset) {
    var daytime = 1;
  } else {
    var daytime = 0;
  };
  if (daytime === 1) {
  this.log('daytime starting solcast');
  this.getForecast();
  this.getDailyupdate();
  } else {
  this.log('It is night');
  }
  }
////////////

getDaily() {
    this.log('Fetching Daily Solcast');

    const data = this.getData();
    const settings = this.getSettings();
    //get data
    var api = this.getSetting('api');
    var siteid = this.getSetting('siteid');
    this.setStoreValue('dailyupdate', 1);

    // Power values
    const powerDataUrl = `${baseUrl}/rooftop_sites/${siteid}/forecasts?format=json&hours=48&api_key=${api}`;
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
            for (i = 0; i < 48; i++)
            {today += forecasts[i].pv_estimate;
            }
            var today = today / 2;
            this.setCapabilityValue('today', today);
            //tomorrow
            var tomorrow = 0;
            var forecasts = solcast.forecasts,
            i;
            for (i = 48; i < forecasts.length; i++)
            {tomorrow += forecasts[i].pv_estimate;
            }
            var tomorrow = tomorrow / 2;
            this.setCapabilityValue('tomorrow', tomorrow);

        })
                //errors
                .catch(error => {
                    this.log(`Unavailable (${error})`);
                    this.setUnavailable(`Error retrieving data (${error})`);
                });
}
//////////////////
getDailyupdate(){
var dailyupdate = this.getStoreValue('dailyupdate');
if (dailyupdate == 1) {
  this.getDaily2()
} else {
};
}
// 2nd daily update
getDaily2() {

    this.log('Fetching Daily Solcast');

    const data = this.getData();
    const settings = this.getSettings();
    //get data
    var api = this.getSetting('api');
    var siteid = this.getSetting('siteid');
    this.setStoreValue('dailyupdate', 0);

    // Power values
    const powerDataUrl = `${baseUrl}/rooftop_sites/${siteid}/forecasts?format=json&hours=48&api_key=${api}`;
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
            for (i = 0; i < 48; i++)
            {today += forecasts[i].pv_estimate;
            }
            var today = today / 2;
            this.setCapabilityValue('today', today);
            //tomorrow
            var tomorrow = 0;
            var forecasts = solcast.forecasts,
            i;
            for (i = 48; i < forecasts.length; i++)
            {tomorrow += forecasts[i].pv_estimate;
            }
            var tomorrow = tomorrow / 2;
            this.setCapabilityValue('tomorrow', tomorrow);

        })
                //errors
                .catch(error => {
                    this.log(`Unavailable (${error})`);
                    this.setUnavailable(`Error retrieving data (${error})`);
                });
}
        //Hourly values
        getForecast() {
            this.log('Fetching Solcast');

            const data = this.getData();
            const settings = this.getSettings();
            //get data
            var api = this.getSetting('api');
            var siteid = this.getSetting('siteid');

            // Power values
            const powerDataUrl = `${baseUrl}/rooftop_sites/${siteid}/forecasts?format=json&hours=5&api_key=${api}`;
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
                  //currentPower
                  const data = response;
                  var currentPower = data['forecasts'][0]['pv_estimate'];
                  var currentPower = currentPower*1000
                  this.setCapabilityValue('measure_power.now', currentPower);
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
    const data = this.getData();
    const settings = this.getSettings();
    //get data
    var api = this.getSetting('api');
    var siteid = this.getSetting('siteid');

    // Power values
      const body = `{"measurement": {"period_end": "${isoDate}", "period": "PT5M", "total_power": ${uploadPower}}}`;
  this.log('body', body);
    const powerDataUrl = `${baseUrl}/rooftop_sites/${siteid}/measurements/?api_key=${api}`;
//      this.log(powerDataUrl);
//       &hours=x is the amount hours to receive
    fetch(powerDataUrl, {
            method: 'post',
          //  body:    JSON.stringify(body),
            body:    body,
            headers: { 'Content-Type': 'application/json' },
        })
        .then(res => console.log(res));
      }
            }
        module.exports = SolCastdevice;
