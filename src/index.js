const puppeteer = require("puppeteer");
const csv = require("csv-writer").createObjectCsvWriter;

const csvWriter = csv({
  path: "wedding_venues.csv",
  header: [
    { id: "name", title: "Venue Name" },
    { id: "about", title: "About" },
    { id: "spaceCapacity", title: "Space Available and Capacity" },
    { id: "facilities", title: "Facilities Available" },
    { id: "cuisines", title: "Cuisines" },
    { id: "location", title: "Location" },
    { id: "otherServices", title: "Other Services" },
    { id: "price", title: "Price" }
  ]
});

async function scrapeVenuePage(page, url) {
  try {
    await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });

    const venueData = await page.evaluate(() => {
      // Helper function to get text content by heading
      const getContentAfterHeading = (headingText) => {
        const headings = Array.from(document.querySelectorAll('h2'));
        const targetHeading = headings.find(h => h.textContent.includes(headingText));
        if (targetHeading) {
          // Get the next sibling paragraph
          let nextElement = targetHeading.nextElementSibling;
          while (nextElement && nextElement.tagName !== 'P') {
            nextElement = nextElement.nextElementSibling;
          }
          return nextElement ? nextElement.textContent.trim() : "N/A";
        }
        return "N/A";
      };

      return {
        // Get venue name from the main heading
        name: document.querySelector('h1')?.textContent.trim() || "N/A",
        
        // Get About section
        about: getContentAfterHeading('About'),
        
        // Get Space and Capacity
        spaceCapacity: getContentAfterHeading('Space Available and Capacity'),
        
        // Get Facilities
        facilities: getContentAfterHeading('Facilities Available'),
        
        // Get Cuisines
        cuisines: getContentAfterHeading('Cuisines'),
        
        // Get Location
        location: getContentAfterHeading('Location'),
        
        // Get Other Services
        otherServices: getContentAfterHeading('Other services'),
        
        // Get Price
        price: document.querySelector('.price')?.textContent.trim() || 
               document.querySelector('[class*="price"]')?.textContent.trim() || "N/A",
      };
    });

    console.log(`Successfully scraped: ${venueData.name}`);
    return venueData;

  } catch (error) {
    console.error(`Error scraping ${url}:`, error.message);
    return null;
  }
}

async function getAllVenueLinks(page) {
  try {
    // Get all venue links from the listing page
    const links = await page.evaluate(() => {
      const venueCards = document.querySelectorAll('a[href*="/wedding-venues/"]');
      return Array.from(venueCards, card => card.href);
    });
    return links;
  } catch (error) {
    console.error('Error getting venue links:', error);
    return [];
  }
}

async function scrapeVenues() {
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null
  });

  try {
    const page = await browser.newPage();
    const venues = [];
    let currentPage = 1;
    let hasNextPage = true;

    while (hasNextPage) {
      // Go to the venue listing page
      const listingUrl = `https://www.wedmegood.com/vendors/all/wedding-venues?page=${currentPage}`;
      await page.goto(listingUrl, { waitUntil: "networkidle0", timeout: 60000 });
      console.log(`Scanning page ${currentPage} for venue links...`);

      // Get all venue links on current page
      const venueLinks = await getAllVenueLinks(page);
      
      if (venueLinks.length === 0) {
        hasNextPage = false;
        continue;
      }

      // Scrape each venue
      for (const link of venueLinks) {
        console.log(`Scraping venue: ${link}`);
        const venueData = await scrapeVenuePage(page, link);
        if (venueData) {
          venues.push(venueData);
        }
        // Add a small delay between venues
        await new Promise(r => setTimeout(r, 1000));
      }

      currentPage++;
      // Add a delay between pages
      await new Promise(r => setTimeout(r, 2000));
    }

    // Save to CSV
    await csvWriter.writeRecords(venues);
    console.log(`Successfully scraped ${venues.length} venues to wedding_venues.csv`);

  } catch (error) {
    console.error('Scraping error:', error);
  } finally {
    await browser.close();
  }
}

scrapeVenues();

// const puppeteer = require("puppeteer");
// const csv = require("csv-writer").createObjectCsvWriter;

// const csvWriter = csv({
//   path: "venue_links.csv",
//   header: [{ id: "url", title: "URL" }]
// });

// (async () => {
//   const browser = await puppeteer.launch({ headless: false });
//   const page = await browser.newPage();
//   await page.goto("https://www.wedmegood.com/vendors/all/wedding-venues", {
//     waitUntil: "networkidle0",
//     timeout: 60000
//   });

//   const venueLinks = await page.$$eval(".vendor-card a", links =>
//     links.map(link => ({ url: link.href }))
//   );

//   await csvWriter.writeRecords(venueLinks);
//   console.log("Venue Links saved to venue_links.csv");
//   await browser.close();
// })();