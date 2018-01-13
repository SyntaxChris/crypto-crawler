// require('dotenv').config();

let announcements;
const bodyParser = require('body-parser');
const binanceUrl= 'https://support.binance.com/hc/en-us/categories/115000056351-Announcements';
const client = require('twilio')(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const cors = require('cors');
const ClientCapability = require('twilio').jwt.ClientCapability;
const Crawler = require("crawler");
const CronJob = require('cron').CronJob;
const http = require('http');
const express = require('express');
const moment = require('moment');
const morgan = require('morgan');
const numbers = [
  process.env.CHRIS,
  // process.env.DAVID,
  // process.env.PALERMO,
  // process.env.ZOUHAIR
];

const app = express();

//App setup
app.use(morgan('xml response'));
app.use(cors());
app.use(bodyParser.json({type: '*/*'}));

//Set Routes
app.get('/', (req, res) => {
  res.header('Content-Type','text/xml').send(
    '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Crypto Announcements Update!</Say></Response>'
  );
});

//Sever setup
const port = process.env.PORT || 3090;
const server = http.createServer(app);

server.listen(port);
console.log('Server listening on ', port);

function letsMakeSomeMoney() {
  const crawler = new Crawler({
    maxConnections : 10,
    callback : function (error, res, done) {
      if (res.statusCode !== 200){
        return sendSmsMessage('Crypto Alert: URL responding with ' + res.statusCode + ' status code.')
      }

      if (error) return sendSmsMessage('Crypto Alert: URL ERROR ' + error);

      const $ = res.$;
      let newList = $(".article-list-item").text();

      if (announcements !== newList) {
        announcements = newList;
        sendSmsMessage('Crypto Alert: $$$ new coin(s) listed on Binance \n' + announcements);
        return sendVoiceMessage();
      }
      
      console.log(`Nothing changed... ${moment().format("dddd, MMMM Do YYYY, h:mm:ss a")}`);
      done();
    }
  });

  return crawler.queue(binanceUrl);
}

function sendSmsMessage(message) {
  Promise.all(
    numbers.map((number) => {
      return client.messages.create({
        from: process.env.MESSAGE_SERVICE_ID,
        to: number,
        body: message,
      }).then((message) => console.log(`Message id:::: ${message.sid}`));
    })
  );
}

function sendVoiceMessage() {
  Promise.all(
    numbers.map((number) => {
      return client.calls.create({
        from: process.env.TWILIO_PHONE_NUMBER,
        to: number,
        url: process.env.VOICE_URL,
      }).then((call) => process.stdout.write(call.sid));
    })
  );
}

return new CronJob('*/1 * * * *', function() {
  return letsMakeSomeMoney();
}, null, true, 'America/Los_Angeles')
