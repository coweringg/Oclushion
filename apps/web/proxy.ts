import createMiddleware from "next-intl/middleware";

import { defaultLocale, locales } from "./i18n/routing";

export default createMiddleware({
  locales,
  defaultLocale,
  localeDetection: true,
});

export const config = {
  matcher: ["/", "/(en|es|fr|zh|pt|de|ja|ko)/:path*"],
};
