Solcast - Solar Forecasts

Homey app using the Solcast API to get solar forecasts customized for your location and installation*


Purpose

The app will download every half hour the latest solar forecast with the current forecasted value, and the next 1, 2 and 3 hours.
Every night at Midnight, it will download the accumulated forecasts for Today and Tomorrow.

Every 5 minutes the app will upload your current solar production to fine-tune the prediction model of your solcast forecast.

Usage

You could use the app to switch on electric appliances or charge a car or battery based on the forecast solar power, to maximize self-consumption.
You can compare the daily forecast with your actual production.

image
image
1125×2269 123 KB
Setup

Sign up your solar installation at Solcast Toolkit 1
You have to setup the ‘Free’ Home PV owner account (hobbyist) which gives you (currently) 50 API calls a day.
Fill in all the exact details of your solar installation.

Setup the Solcast app

You have to provide your API-key and Resource ID to get the app working.
API Key can be found under - Your name - Your API key
Resource ID can be found if you click on your location on the main screen.

Support topic

For support please use the official support topic on the forum.

Donations

If you appreciate the app: Buy me a Beer]
@athom a Homey Pro (2023) is always appreciated :slight_smile:


The upload functionality will not be fully built into the app, as everybody uses different apps to monitor their PV system, it will be a combination of logic and flows.


v1.0.0
Initial release

v2.0.0
SDK3
Flow triggers
Today remaining added
