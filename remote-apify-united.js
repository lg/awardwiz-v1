/* This file is uploaded by AwardMan to Apify and run as an Actor */
/* eslint-disable */

const Apify = require('apify');

Apify.main(async () => {
  console.log('Hello world from actor!');

  const output = { message: 'Hello world!' };
  await Apify.setValue('OUTPUT', output);
});