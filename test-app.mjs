import puppeteer from 'puppeteer';

(async () => {
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        page.on('console', msg => console.log('BROWSER LOG:', msg.type(), msg.text()));
        page.on('pageerror', err => console.log('BROWSER ERROR:', err.toString()));
        page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));

        console.log("Navigating to localhost:5174...");
        await page.goto('http://localhost:5174/', { waitUntil: 'networkidle2', timeout: 10000 });

        await new Promise(resolve => setTimeout(resolve, 2000));
        await browser.close();
    } catch (e) {
        console.error("Script failed:", e);
    }
})();
