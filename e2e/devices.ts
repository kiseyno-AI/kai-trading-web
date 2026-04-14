import { devices } from "@playwright/test";

const { defaultBrowserType, ...iPhone13Context } = devices["iPhone 13"];
void defaultBrowserType;

export const chromiumIPhone13 = iPhone13Context;
