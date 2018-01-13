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

const app = express();

//App setup
app.use(morgan('xml response'));
app.use(cors());
app.use(bodyParser.json({type: '*/*'}));

//Set Routes
app.get('/', (req, res) => {
  // res.header('Content-Type','text/xml').send(
  //   '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Thanks for calling!</Say></Response>'
  // );
  res.end();
})
// app.get('/token', (req, res) => {
//   // put your Twilio API credentials here
//   const accountSid = 'AC909901561188583720d965b6d00380c8';
//   const authToken = 'your_auth_token';

//   // put your Twilio Application Sid here
//   const appSid = 'APXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

//   const capability = new ClientCapability({
//     accountSid: accountSid,
//     authToken: authToken,
//   });
//   capability.addScope(
//     new ClientCapability.OutgoingClientScope({ applicationSid: appSid })
//   );
//   const token = capability.toJwt();

//   res.set('Content-Type', 'application/jwt');
//   res.send(token);
// });

// app.post('/voice', (req, res) => {
//   // TODO: Create TwiML response
// });

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
        announcements = newList
        return sendSmsMessage('Crypto Alert: $$$ new coin(s) listed on Binance \n' + announcements)
      }
      
      console.log(`Nothing changed... ${moment().format("dddd, MMMM Do YYYY, h:mm:ss a")}`);
      done();
    }
  });

  return crawler.queue(binanceUrl);
}

function sendSmsMessage(message) {
  const numbers = [
    process.env.CHRIS,
    // process.env.DAVID,
    // process.env.PALERMO,
    // process.env.ZOUHAIR
  ];

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

// function sendVoiceMessage() {
//   const capability = new ClientCapability({
//     accountSid: process.env.TWILIO_ACCOUNT_SID,
//     authToken: process.env.TWILIO_AUTH_TOKEN
//   })
//   capability.addScope(

//   )
//   const numbers = [
//     process.env.CHRIS,
//     // process.env.DAVID,
//     // process.env.PALERMO,
//     // process.env.ZOUHAIR
//   ];

//   Promise.all(
//     numbers.map((number) => {

//     })
//   );
// }

// return letsMakeSomeMoney();

return new CronJob('*/1 * * * *', function() {
  return letsMakeSomeMoney();
}, null, true, 'America/Los_Angeles')
