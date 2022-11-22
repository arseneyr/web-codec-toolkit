import { test, expect } from "@playwright/test";

test("homepage has Playwright in title and get started link linking to the intro page", async ({
  page,
}) => {
  await page.goto("https://playwright.dev/");

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Playwright/);

  // create a locator
  const getStarted = page.getByText("Get Started");

  // Expect an attribute "to be strictly equal" to the value.
  await expect(getStarted).toHaveAttribute("href", "/docs/intro");

  // Click the get started link.
  await getStarted.click();

  // Expects the URL to contain intro.
  await expect(page).toHaveURL(/.*intro/);
});

test("lib loads", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const funcs = await page.evaluateHandle(() => window.testFuncs);
  const demux = await page.evaluateHandle(
    async (funcs) => funcs.createDemuxer(await window.libav),
    funcs
  );
  const testStream = await page.evaluateHandle(() =>
    fetch("/sample.opus").then((res) => res.body!)
  );
  console.log(
    await demux.evaluate(async (demux, stream) => {
      let ret = [];
      for await (const chunk of window.testFuncs.streamAsyncIterator(
        stream.pipeThrough(demux)
      )) {
        ret.push(chunk);
      }
      return ret;
    }, testStream)
  );
});
