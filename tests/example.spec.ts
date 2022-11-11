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
  const av = await page.evaluateHandle((funcs) => funcs.Decoder.create(), funcs);
  const testFile = await page.evaluateHandle(() =>
    fetch("/sample.opus").then((res) => res.arrayBuffer())
  );
  console.log(
    await av.evaluate(async (av, file) => {
      const TMP_FILENAME = "tmp.opus";
      await av.writeFile(TMP_FILENAME, new Uint8Array(file));
      const [fmt_ctx, streams] = await av.ff_init_demuxer_file(TMP_FILENAME);
      const packet = await av.av_packet_alloc();
      await av.av_read_frame(fmt_ctx, packet);
      return av.AVPacket_data(packet);
    }, testFile)
  );
});
