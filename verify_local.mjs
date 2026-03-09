import { chromium } from 'playwright';

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    let ordersRequestUrl = null;
    page.on('request', request => {
        if (request.url().includes('rest/v1/orders') && request.method() === 'GET') {
            const url = new URL(request.url());
            if (url.searchParams.has('createdAt')) {
                console.log(`[Network] Intercepted Orders Request: ${request.url()}`);
                ordersRequestUrl = request.url();
            }
        }
    });

    try {
        console.log('Navigating to local site...');
        await page.goto('http://localhost:5173/');

        console.log('Logging in...');
        await page.fill('input[type="email"]', 'admin@coko.com');
        await page.fill('input[type="password"]', 'Admin@123');
        await page.click('button:has-text("Sign In")');

        await page.waitForURL('**/dashboard');
        console.log('Logged in successfully, waiting for dashboard to load...');

        await page.waitForTimeout(2000);

        console.log('Clicking Custom filter...');
        await page.click('button:has-text("custom")');

        console.log('Setting custom dates to March 6...');
        await page.evaluate(() => {
            const inputs = document.querySelectorAll('input[type="date"]');
            if (inputs.length >= 2) {
                // @ts-ignore
                inputs[0].value = '2026-03-06';
                inputs[0].dispatchEvent(new Event('input', { bubbles: true }));
                inputs[0].dispatchEvent(new Event('change', { bubbles: true }));
                // @ts-ignore
                inputs[1].value = '2026-03-06';
                inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
                inputs[1].dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        await page.waitForTimeout(1000);

        console.log('Clicking Refresh...');
        await page.evaluate(() => {
            const btns = document.querySelectorAll('button');
            for (const b of btns) {
                if (b.title === 'Refresh Data' || b.querySelector('svg')) {
                    if (b.className.includes('p-2 text-gray-400')) {
                        b.click();
                        return;
                    }
                }
            }
        });

        await page.waitForTimeout(3000);

        console.log('Getting Dashboard Metrics Text...');
        const revenue = await page.locator('.font-bold').first().textContent();
        console.log(`Current Top Left Number (Revenue/etc): ${revenue}`);

        if (ordersRequestUrl) {
            console.log('Verification COMPLETE. The network request was captured.');
        } else {
            console.log('Verification FAILED. No new network request captured.');
        }
    } catch (e) {
        console.error('Error during verification:', e);
    } finally {
        await browser.close();
    }
})();
