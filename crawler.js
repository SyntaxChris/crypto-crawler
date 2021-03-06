// require('dotenv').config();
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
  process.env.DAVID,
  process.env.PALERMO,
  process.env.ZOUHAIR
];
const xml = require('object-to-xml');
let announcements;
let lastPrice;
let setLimitInterval;
let totalPriceDrop = 0;
let totalPriceIncrease = 0;

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
    lastPrice = null;
    totalPriceDrop = 0;

  }

  if (
    _.has(req.query, 'name') &&
    _.has(req.query, 'limit') &&
    _.has(req.query, 'time')
  ) {
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
    lastPrice = null;
    totalPriceDrop = 0;

    return res.send('cleared drop alert');
  }

  res.send('no drop alert set');
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
      return sendGroupSmsMessage('Crypto Alert: URL responding with ' + res.statusCode + ' status code.')
    }

    if (error) return sendGroupSmsMessage('Crypto Alert: URL ERROR ' + error);

    const $ = res.$;
    let newList = $(".article-list-item").text();

    if (announcements !== newList) {
      announcements = newList;
      sendGroupSmsMessage('+$ Crypto Alert +$: new announcements listed on Binance \n' + announcements);
      return sendVoiceMessage();
    }
    
    console.log(`------ no changes ------ ${moment().tz('America/New_York').format('h:mm:ss a')}`);
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
        const btc = $('span.text-gray.details-text-medium').text();
        // no price element
        if (!currentPrice) return;
        // no btc element
        if (!btc) return;
        // no comparison price stored yet
        if (!lastPrice) lastPrice = currentPrice;
        // current price higher than stored price - new high!
        if (currentPrice > lastPrice) lastPrice = currentPrice;

        if (lastPrice < currentPrice) totalPriceIncrease += (1 - lastPrice/currentPrice);

        const currentPriceDrop = 1 - (currentPrice/lastPrice);

        console.log(`
          ${moment().tz('America/New_York').format('dddd, MMMM Do YYYY, h:mm:ss a')}
          -------------------- ${name.toUpperCase()}
          TOTAL DECREASE: ${(totalPriceDrop * 100).toFixed(4)}%
          TOTAL INCREASE: ${(totalPriceIncrease * 100).toFixed(4)}%
          CURRENT USD: ${currentPrice}
          CURRENT BTC: ${btc}
          -------------------- END
        `);

        if (currentPriceDrop > limit) {
          totalPriceDrop += currentPriceDrop;
          sendSmsMessage(`
            --- ${name.toUpperCase()} ---
            CURR DROP: ${(currentPriceDrop * 100).toFixed(4)}%
            TOT DROP: ${(totalPriceDrop * 100).toFixed(4)}%
            CURR USD: $${currentPrice}
            CURR BTC: ${btc}
            --- END ---
          `,
            process.env.CHRIS
          );

          lastPrice = currentPrice;
        }

        return done();
      }
      
      if (setLimitInterval) {
        clearInterval(setLimitInterval);
        lastPrice = null;
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

function sendGroupSmsMessage(message) {
  Promise.all(
    numbers.map((number) => {
      return client.messages.create({
        from: process.env.MESSAGE_SERVICE_ID,
        to: number,
        body: message,
      }).then((message) => {
        return console.log(`MESSAGE ID: ${message.sid} on ${moment().tz('America/New_York').format("dddd, MMMM Do YYYY, h:mm:ss a")}`)
      });
    })
  );
}

function sendSmsMessage(message, number) {
  return client.messages.create({
    from: process.env.MESSAGE_SERVICE_ID,
    to: number,
    body: message,
  }).then((message) => {
    return console.log(`MESSAGE ID: ${message.sid} on ${moment().tz('America/New_York').format("dddd, MMMM Do YYYY, h:mm:ss a")}`)
  });
}

function sendVoiceMessage() {
  Promise.all(
    numbers.map((number) => {
      return client.calls.create({
        from: process.env.TWILIO_PHONE_NUMBER,
        to: number,
        url: process.env.VOICE_URL,
      }).then((call) => {
        return console.log(`CALL ID: ${call.sid} on ${moment().tz('America/New_York').format("dddd, MMMM Do YYYY, h:mm:ss a")}`)
      });
    })
  );
}

function keepAwake () {
  console.log(`------ keep awake ------ ${moment().tz('America/New_York').format("h:mm:ss a")}`);
  return http.get(process.env.APP_URL);
}
