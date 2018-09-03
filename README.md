**AwardMan**
  Search for mileage awards on United

![Screenshot](/lg/award-man/master/screenshot.png?raw=true)

*Current status*:
  Actor uploading is automatic now, runs query for SFO-YOW, returns raw results. Needs to integrate parsing and cleanup of results into main flow.

*How this works*:
  Really it's quite simple, but unusual. Basically all the code that's run is controllable from the client side. AwardMan will create "actors" (aka lambdas) on Apify to scrape different airline mileage award websites (in `apify-runner.js`). This makes things fast and parallelizable. When you 'prep' the system, it'll upload any changes you made to the `scrapers/*.js` files to Apify. Then when you run things, it simply calls the actor with the params you entered which does the cloud scraping and returns the results to `award-man.js` which controls everything.

*Make sure to have installed*:
  - SublimeText 3 plugins:
    Package Control, SublimeLinter, SublimeLinter-eslint, JavaScriptNext - ES6 Syntax
  - eslint (via npm)

*Getting started*:
  1. Create an Apify account and get your token from [here](https://my.apify.com/account#/integrations)
  2. Start a local server with this code using `python -m SimpleHTTPServer`
  3. Open a browser at http://127.0.0.1:8000/ and open the Dev Console
  4. Enter your token and other info into the website
  5. Hit the 'prep' button to upload the actors
  6. Play around!

*TODO*:
  - publish the united parser and and have an option to just use that directly
  - split off CORS lambda runner into its own lib

*Vision*:
  - add Delta, Aeroplan and many more award providers
  - auto pull in points from AwardWallet
  - auto generate routes here instead of using the airlines (since we're smarter)
  - suggest which airlines to get more miles onto (i.e. "you could have saved X miles if you had these kinds of miles")
  - auto calculate cost savings
  - parallel requests to scan all possibilities

*Appendix*:

Actors
  - As input they expect:
    - _proxyUrl_: (optional) a url to use as a proxy server for scraping
    - _from_: the IATA code for the airport you're flying from
    - _to_: the IATA code for the airport you're flying to
    - _date_: the date on which you're flying (YYYY-MM-DD)
    - _maxConnections_: (optional) maximum airport connections (default 2)
  - Returns an array of:
    - _flights_: ex. `UA1234,AC223,SQ1`
    - _fromDateTime_: ex. `08/31/2018 23:45`
    - _toDateTime_: ex. `09/01/2018 05:29`
    - _fromAirport_: ex. `SFO`
    - _toAirport_: ex. `YOW`
    - _costs_: map of following:
      - _economy_: map of: _miles_ (in miles), and _dollars_ (in USD)
      - _business_: map of: _miles_ (in miles), and _dollars_ (in USD)
      - _first_: map of: _miles_ (in miles), and _dollars_ (in USD)

*References*
  - https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md