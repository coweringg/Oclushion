import { getTranslations, setRequestLocale } from "next-intl/server";

import { OclushionLanding } from "@/components/marketing/OclushionLanding";
import type { AppLocale } from "../../i18n/routing";
import { locales } from "../../i18n/routing";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocalizedHomePage({
  params,
}: Readonly<{
  params: Promise<{ locale: AppLocale }>;
}>) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("structuredData");

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Oclushion",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Windows, macOS, Linux",
    description: t("description"),
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      lowPrice: "0",
      highPrice: "50",
      offerCount: 3,
    },
    featureList: t.raw("features") as string[],
  };

  return (
    <>
      <script
        dangerouslySetInnerHTML={{ __html: safeJsonLd(structuredData) }}
        type="application/ld+json"
      />
      <OclushionLanding />
    </>
  );
}

function safeJsonLd(data: object): string {
  return JSON.stringify(data)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
}
