require('dotenv').config();

const _ = require('lodash');
const bodyParser = require('body-parser');
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
const numbers = [
  process.env.CHRIS,
  // process.env.DAVID,
  // process.env.PALERMO,
  // process.env.ZOUHAIR
];
const xml = require('object-to-xml');
let announcements;
let lastPrice;
let setLimitCron;
let setLimitInterval;
let totalPriceDrop = 0;

// binance crawler cron job
const crawlBinanceAnnouncements = new CronJob('*/5 * * * *', function() {
  keepAwake();
  return fetchAnnouncements();
}, null, true, 'America/New_York');

//App setup
const app = express();
app.use(cors());

//Set Routes
app.get('/', (req, res) => {
  res.set('Content-Type', 'text/xml');
  res.sendStatus(200);
});

app.post('/', (req, res) => {
  res.set('Content-Type', 'text/xml');
  res.send(xml({
    '?xml version="1.0" encoding="UTF-8"?' : null,
    Response: {
      Say: 'Crypto Announcements Update!'
    }
  }));
});

app.get('/set-drop-alert', (req, res) => {
  if (setLimitInterval) {
    clearInterval(setLimitInterval);
    totalPriceDrop = 0;
  }

  if (_.has(req.query, 'name') && _.has(req.query, 'limit') && _.has(req.query, 'time')) {
    const { name, limit, time } = req.query;

    fetchListPrice(name, limit, time);

    return res.send(
      `Setting price drop alert for ${name}, limit of ${limit * 100}%, time interval of ${time} milliseconds`
    );
  }

  return res.sendStatus(404);
});

app.get('/clear-drop-alert', (req, res) => {
  if (setLimitInterval) {
    clearInterval(setLimitInterval);
    totalPriceDrop = 0;
    return res.send('cleared drop alert');
  }
  
  return res.sendStatus(500);
})

//Sever setup
const port = process.env.PORT || 3090;
const server = http.createServer(app);

server.listen(port);
console.log('Server listening on ', port);

const announcementsCrawler = new Crawler({
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
      sendSmsMessage('$$$ Crypto Alert $$$: new announcements listed on Binance \n' + announcements);
      return sendVoiceMessage();
    }
    
    console.log(`No changes: ${moment().format("dddd, MMMM Do YYYY, h:mm:ss a")}`);
    done();
  }
});

const listPriceCrawler = function (name, limit) {
  return new Crawler({
    maxConnections: 10,
    callback: function (err, res, done) {
      if (res.statusCode === 200) {
        const $ = res.$;
        const currentPrice = $('#quote_price').attr('data-usd');
        // no price element
        if (!currentPrice) return;
        // no comparison price stored yet
        if (!lastPrice) {
          lastPrice = currentPrice;
        }
        // current price higher than stored price - new high!
        if (currentPrice > lastPrice) lastPrice = currentPrice;

        const currentPriceDrop = 1 - (currentPrice/lastPrice);

        if (currentPriceDrop > limit) {
          totalPriceDrop += currentPriceDrop
          sendSmsMessage(
            `-$ PRICE DROP: ${
              name.toUpperCase()
            } has dropped ${
              currentPriceDrop * 100
            }% TOTAL PRICE DROP: ${
              totalPriceDrop * 100
            }%`
          );
          lastPrice = currentPrice;
        }

        return done();
      }
      
      if (setLimitInterval) {
        clearInterval(setLimitInterval);
        totalPriceDrop = 0;
      }
      return done();
    }
  })
};


function fetchAnnouncements() {
  return announcementsCrawler.queue(process.env.BINANCE_URL);
}

function fetchListPrice(name, limit, time) {
  return setLimitInterval = setInterval(function () {
    listPriceCrawler(name, limit).queue(`${process.env.COIN_MARKET_CAP_URL}/${name}/`);
  }, time);
} 

function sendSmsMessage(message) {
  Promise.all(
    numbers.map((number) => {
      return client.messages.create({
        from: process.env.MESSAGE_SERVICE_ID,
        to: number,
        body: message,
      }).then((message) => {
        return console.log(`MESSAGE ID: ${message.sid} on ${moment().format("dddd, MMMM Do YYYY, h:mm:ss a")}`)
      });
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
      }).then((call) => {
        return console.log(`CALL ID: ${call.sid} on ${moment().format("dddd, MMMM Do YYYY, h:mm:ss a")}`)
      });
    })
  );
}

function keepAwake () {
  console.log(`prevent app from sleeping ${moment().format("dddd, MMMM Do YYYY, h:mm:ss a")}`);
  return http.get(process.env.APP_URL);
}
