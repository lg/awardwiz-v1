**AwardMan**
  Search for mileage awards on United

*Current status*:
  Baseline uploading of actor -- no United scraping yet

*How this works*:
  Really it's quite simple, but unusual. Basically all the code that's run is controllable
from the client side. AwardMan will create "actors" (aka lambdas) on Apify to scrape different
airline mileage award websites. This makes things fast and parallelizable. When you 'prep' the
system, it'll upload any changes you made to the `remote-apify-*.js` files to Apify.

*Make sure to have installed*:
  - SublimeText 3 plugins:
    Package Control, SublimeLinter, SublimeLinter-eslint, JavaScriptNext - ES6 Syntax
  - eslint (via npm)

*Getting started*:
  1. Create an Apify account and get your token
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
  - auto pull in points from awardwallet
  - auto generate routes here instead of using the airlines (since we're smarter)
  - suggest which airlines to get more miles onto (i.e. "you could have saved X miles if you had these kinds of miles")
  - auto calculate cost savings
  - parallel requests to scan all possibilities