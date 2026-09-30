# Prompt for Distributing Reports to Respective Modules

Here is the prompt you can use to distribute the reports:

---

**Prompt:**

"Please update the BDBBC ERP Solution to distribute the reporting features into their respective modules instead of keeping them in a single centralized 'Reports' section.

The goal is to ensure that each module handles its own specific reports. Specifically:
- **Sales Module:** Must contain all sales-related reports (e.g., Daily Sales, Sales Summary, Invoice Reports).
- **HR Module:** Must contain all HR-related reports (e.g., Employee Attendance, Payroll Reports, Leave Reports).
- **CRM Module:** Must contain all CRM-related reports (e.g., Customer Interactions, Lead Conversions).
- **Purchase & Inventory:** Must contain all stock and procurement reports (e.g., Stock Valuation, Low Stock Alerts, Purchase History).

Apply this pattern to every module in the system. Every module should now have its own dedicated 'Reports' submenu or dashboard tab. 

Please provide the updated Next.js routing configuration and the sidebar/navigation UI code to implement this modular reporting structure, so the user can easily find a module's reports right inside that specific module.

Additionally, please ensure that the main module headings in the sidebar are visually highlighted (e.g., using bold text, a distinct background color, or a subtle border) so they stand out clearly from their sub-items and don't all look the same."
