import { expect, test, type Page } from "@playwright/test";

const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? "";
const appBasePath =
  configuredBasePath && configuredBasePath !== "/"
    ? `${configuredBasePath.startsWith("/") ? "" : "/"}${configuredBasePath}`.replace(/\/+$/, "")
    : "";

const withBasePath = (pathname: `/${string}`) => `${appBasePath}${pathname}`;

async function seedSignalDeciderFeedbackCache(page: Page, marketDate: string) {
  await page.addInitScript((date) => {
    const feedback = {
      request: {
        market_date: date,
        symbols: [],
        agent_name: "signal-decider",
        limit: 200,
      },
      summary: {
        count: 1,
      },
      items: [
        {
          id: `navigation-recovery-${date}`,
          market_date: date,
          symbol: "005930",
          agent: {
            name: "signal-decider",
            run_id: `feedback-cycle-${date}`,
          },
          summary: {},
          feedback: {
            role: "signal-decider",
            symbol: "005930",
            market_date: date,
            preferred_action: "wait",
            next_day_open_action: "wait",
            confidence_score_10: 7,
            conviction_score_10: 6,
            thesis_summary: "Navigation recovery test cached row.",
          },
          normalized_feedback: null,
          details: null,
          context: {
            symbol_day_context: {
              company: {
                name_ko: "Samsung Electronics",
              },
            },
          },
          received_at: `${date}T07:45:00+00:00`,
        },
      ],
    };

    window.sessionStorage.setItem(
      `kai.signalDeciderFeedback.v1:${date}`,
      JSON.stringify({
        version: 1,
        marketDate: date,
        cachedAt: Date.now(),
        source: "calendar",
        feedback,
        progress: null,
      }),
    );
    window.sessionStorage.setItem(
      "kai.signalDeciderFeedback.v1:dates",
      JSON.stringify({
        version: 1,
        marketDates: [date],
      }),
    );
  }, marketDate);
}

test.describe("navigation failure recovery", () => {
  test("keeps recovery controls visible when a route chunk load rejection is reported", async ({ page }) => {
    await page.goto(withBasePath("/dashboard"));
    await expect(page.getByRole("link", { name: /^Explore$/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /^Explore$/i }).first()).toHaveAttribute(
      "href",
      withBasePath("/search"),
    );

    await page.goto(withBasePath("/search"));
    await expect(page).toHaveURL(/\/search$/);
    await expect(page.getByRole("heading", { name: /Universal Search/i })).toBeVisible();

    await page.evaluate(() => {
      const failedChunk = document.createElement("script");
      failedChunk.src = `${window.location.origin}/_next/static/chunks/app/search/page.js`;
      document.head.appendChild(failedChunk);
      failedChunk.dispatchEvent(new Event("error", { bubbles: true, cancelable: true }));
      failedChunk.remove();
    });

    const recoveryShell = page.locator("[data-navigation-recovery-shell]");
    await expect(recoveryShell).toBeVisible();
    await expect(
      recoveryShell.getByRole("heading", { name: /Navigation did not finish loading/i }),
    ).toBeVisible();
    await expect(recoveryShell.getByRole("button", { name: /Retry route/i })).toBeVisible();
    await expect(recoveryShell.getByRole("button", { name: /Reload app/i })).toBeVisible();
    await expect(recoveryShell.getByRole("link", { name: /Back to Dashboard/i })).toHaveAttribute(
      "href",
      withBasePath("/dashboard"),
    );
    await expect(recoveryShell.getByText(/Static route chunk failed to load/i)).toBeVisible();
    await expect(recoveryShell.locator("dl")).toContainText("Source route");
    await expect(recoveryShell.locator("dl")).toContainText(withBasePath("/search"));
    await expect(recoveryShell.locator("dl")).toContainText("Attempted route");

    await recoveryShell.getByRole("button", { name: /Retry route/i }).click();
    await expect(recoveryShell).toHaveCount(0);
  });

  test("reports and retries the attempted feedback route when a chunk fails before route completion", async ({ page }) => {
    await seedSignalDeciderFeedbackCache(page, "2026-05-28");

    const sourceRoute = withBasePath("/calendar?date=2026-05-28");
    const attemptedRoute = withBasePath(
      "/dashboard/signal-decider-feedback?marketDate=2026-05-28&navContext=calendar",
    );

    await page.goto(sourceRoute);
    await expect(page.getByRole("heading", { name: /Signal Review Calendar/i })).toBeVisible();

    await page.evaluate((expectedRoute) => {
      document.addEventListener(
        "click",
        (event) => {
          const anchor = (event.target as Element | null)?.closest("a[href]");
          if (!anchor) return;

          const targetUrl = new URL(anchor.href);
          const targetRoute = `${targetUrl.pathname}${targetUrl.search}`;
          if (targetRoute !== expectedRoute) return;

          event.preventDefault();
          window.setTimeout(() => {
            const failedChunk = document.createElement("script");
            failedChunk.src = `${window.location.origin}/_next/static/chunks/app/dashboard/signal-decider-feedback/page.js`;
            document.head.appendChild(failedChunk);
            failedChunk.dispatchEvent(new Event("error", { bubbles: true, cancelable: true }));
            failedChunk.remove();
          }, 0);
        },
        { once: true },
      );
    }, attemptedRoute);

    await page.getByRole("link", { name: /Open feedback table/i }).click();

    const recoveryShell = page.locator("[data-navigation-recovery-shell]");
    await expect(recoveryShell).toBeVisible();
    await expect(recoveryShell.getByText(/Static route chunk failed to load/i)).toBeVisible();
    await expect(recoveryShell.locator("dl")).toContainText("Source route");
    await expect(recoveryShell.locator("dl")).toContainText(sourceRoute);
    await expect(recoveryShell.locator("dl")).toContainText("Attempted route");
    await expect(recoveryShell.locator("dl")).toContainText(attemptedRoute);

    await recoveryShell.getByRole("button", { name: /Retry route/i }).click();
    await expect
      .poll(() => page.evaluate(() => `${window.location.pathname}${window.location.search}`))
      .toBe(attemptedRoute);
    await expect(page.getByRole("heading", { name: /Signal-decider feedback/i })).toBeVisible();
  });
});
