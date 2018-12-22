/**
 * @param {import("puppeteer").Page} page
 * @param {SearchQuery} input
 */
exports.scraperMain = async(page, input) => {
  console.log("Going to homepage...")
  await page.goto("https://matrix.itasoftware.com", {waitUntil: "networkidle0"})

  console.log("Setting one way...")
  const tabs = await page.$$(".gwt-TabBarItem .gwt-HTML")
  await tabs[1].click()

  console.log("Setting origin...")
  const fields = await page.$$(".gwt-SuggestBox")
  await fields[2].focus()
  await page.keyboard.type(input.from)

  console.log("Setting destination...")
  await fields[3].focus()
  await page.keyboard.type(input.to)

  // console.log("Setting no connections...")
  // const [stopsElement] = (await page.$x("//label[contains(text(), 'Stops')]/..//select"))
  // stopsElement.focus()
  // stopsElement.press("N")
  // stopsElement.press("Enter")
  // consider using page.select

  console.log("Setting date...")
  await (await page.$x("(//div[contains(text(), 'Departure Date')]/..)[1]/div[2]/input"))[0].focus()
  await page.keyboard.type(`${input.date.substr(5, 2)}/${input.date.substr(8, 2)}/${input.date.substr(0, 4)}`)    // mm/dd/year
  await tabs[1].click()     // hide calendar

  console.log("Starting search...")
  await page.click("button")


  // await page.waitForResponse("https://matrix.itasoftware.com/search")

  // // If there are multiple pages, request everything
  // const allLink = await page.$x("//a[text()='All']")
  // if (allLink.length > 0) {
  //   await allLink[0].click()
  //   page.waitForResponse("https://matrix.itasoftware.com/search")
  // }

  // Unfortunately the AJAX request is all messed up, so we'll need to scrape the UI
  debugger

  return {searchResults: []}
}
