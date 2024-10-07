const puppeteer = require("puppeteer");
const fs = require("fs");
const csv = require("csv-writer").createObjectCsvWriter;

const category = "Coffee Tables";
const baseURL = "https://www.lakkadhaara.com/collections/coffee-tables";

const csvWriter = csv({
  path: "coffee_tables_detailed.csv",
  header: [
    { id: "brand", title: "Brand" },
    { id: "sku", title: "SKU" },
    { id: "title", title: "Title" },
    { id: "price", title: "Price" },
    { id: "url", title: "URL" },
    { id: "description", title: "Description" },
    { id: "note", title: "Note" },
    { id: "dimensions", title: "Dimensions (Cms)" },
    { id: "materials", title: "Materials" },
    { id: "productFinish", title: "Product Finish" },
    { id: "estimateShipping", title: "Estimate Shipping" },
    { id: "careInstructions", title: "Care Instructions" },
    { id: "imageUrls", title: "Image URLs" }
  ]
});

async function scrapeProductPage(browser, url) {
  const page = await browser.newPage();
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  try {
    await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });
    const productData = await page.evaluate(async () => {
      const brand =
        document.querySelector(
          ".product__text.inline-richtext.caption-with-letter-spacing"
        )?.innerText || "N/A";

      const skuElement = document.querySelector(".product__sku");
      const sku = skuElement
        ? skuElement.textContent.split(":").pop().trim()
        : "N/A";

      const title =
        document.querySelector(".product__title h1")?.innerText || "N/A";
      const price =
        document.querySelector(".price__regular .price-item")?.innerText ||
        "N/A";
      const description =
        document.querySelector(".product__description")?.innerText || "N/A";
      const note =
        document.querySelector(".product__text.inline-richtext em")
          ?.innerText || "N/A";

      const imageUrls = Array.from(
        document.querySelectorAll(".product__media-item img")
      ).map((img) => img.src);

      // Function to wait for a specified time
      const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

      // Click on all accordion summary elements and wait after each click
      const summaries = document.querySelectorAll(
        '.product__accordion summary[role="button"]'
      );
      for (const summary of summaries) {
        summary.click();
        await wait(500); // Wait for 500ms after each click
      }

      // Wait an additional second for all content to be fully loaded
      await wait(1000);

      const accordionContents = Array.from(
        document.querySelectorAll(".accordion__content")
      ).map((content) => {
        return content.innerText;
      });

      while (accordionContents.length < 5) {
        accordionContents.push("N/A");
      }

      const [
        dimensions,
        materials,
        productFinish,
        estimateShipping,
        careInstructions
      ] = accordionContents;

      console.log(
        `Basic product info: Brand: ${brand}, SKU: ${sku}, Title: ${title}, Price: ${price}`
      );

      return {
        brand,
        sku,
        title,
        price,
        description,
        note,
        dimensions,
        materials,
        productFinish,
        estimateShipping,
        careInstructions,
        imageUrls: imageUrls.join(", ")
      };
    });

    console.log("Scraped product data:", productData);
    return { ...productData, url };
  } catch (error) {
    console.error(`Error scraping ${url}:`, error.message);
    return null;
  } finally {
    await page.close();
  }
}

async function scrapeProducts() {
  const browser = await puppeteer
    .launch({
      headless: false,
      defaultViewport: null,
      args: ["--start-maximized"],
      executablePath:
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    })
    .catch(async () => {
      console.log(
        "Failed to launch Chrome. Falling back to bundled Chromium..."
      );
      return puppeteer.launch({
        headless: false,
        defaultViewport: null,
        args: ["--start-maximized"]
      });
    });

  const mainPage = await browser.newPage();
  let currentPage = 1;
  const products = new Set();

  try {
    while (true) {
      await mainPage.goto(`${baseURL}?page=${currentPage}`, {
        waitUntil: "networkidle0",
        timeout: 60000
      });
      console.log(`Scraping page ${currentPage}`);

      const productLinks = await mainPage.$$eval(
        "#product-grid li a.full-unstyled-link",
        (links) => links.map((link) => link.href)
      );

      if (productLinks.length === 0) {
        console.log("No more products found. Ending scrape.");
        break;
      }

      for (const link of productLinks) {
        if (!Array.from(products).some((p) => p.url === link)) {
          const productData = await scrapeProductPage(browser, link);
          if (productData) {
            products.add(productData);
            console.log(`Scraped: ${productData.title}`);
          }
        }
      }

      currentPage++;
    }
  } catch (error) {
    console.error("An error occurred during scraping:", error);
  } finally {
    await browser.close();
  }

  return Array.from(products);
}

(async () => {
  try {
    const products = await scrapeProducts();
    await csvWriter.writeRecords(products);
    console.log(
      `Scraping completed. ${products.length} unique products saved to coffee_tables_detailed.csv`
    );
  } catch (error) {
    console.error("An error occurred:", error);
  }
})();
