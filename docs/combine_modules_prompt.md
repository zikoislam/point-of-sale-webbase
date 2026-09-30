# Prompt for Combining Modules and Dynamic Sidebar

Here is the prompt you can use to update the sidebar and combine the modules:

---

**Prompt:**

"Please update the BDBBC ERP Solution UI, specifically the sidebar/navigation component and routing, with the following major changes:

### 1. Combine Modules
Group the following 5 modules into a single, unified 'Trade & Inventory Management' main section:
- Sales Management
- Purchase Management
- Inventory Management
- Smart POS
- Wholesale & Retail

### 2. Contextual / Dynamic Sidebar
Currently, having all 9 parts in the sidebar at once makes the UI extremely cluttered and hard to understand. I need a contextual/dynamic sidebar implementation:
- When a user logs in and clicks on a main module (e.g., 'Trade & Inventory Management'), the sidebar should **only** display the features, sub-modules, and reports relevant to that specific module.
- All other unrelated modules should be hidden from the sidebar while the user is working inside 'Trade & Inventory Management'.
- Common global sections like 'Settings', 'Dashboard', or 'My Profile' must always remain visible in the sidebar.
- This exact same dynamic sidebar logic must apply to the other main modules in the system (e.g., HR, CRM, Accounts). If the user navigates to the HR module, they should only see HR-related features, reports, and the common settings.

Please provide the updated Next.js code for the `Sidebar` navigation component (using layout-based navigation or state to show context-specific menus) and the required routing configuration to reflect this clean, focused UI structure."
