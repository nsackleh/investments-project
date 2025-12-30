# Investments Platform

A lightweight investment analysis platform built with **Next.js** that provides real-time equity dashboards, performance metrics, and valuation tools. The platform is designed to support rapid analysis of public equities with a focus on clean data handling, extensibility, and financial modeling.

---

## Features

-  **Equity Dashboards**
  - Interactive price charts
  - Short- and long-horizon returns (1D, 1W, 1M, 1Y)
  - Annualized volatility calculations

-  **Market Data API**
  - Server-side data fetching via custom API routes
  - Secure handling of third-party market data APIs
  - No client-side exposure of API keys

-  **DCF Valuation Framework**
  - Dedicated valuation route for each equity
  - Designed to support discounted cash flow modeling
  - Easily extensible to include assumptions, scenarios, and sensitivity analysis
