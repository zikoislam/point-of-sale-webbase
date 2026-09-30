# Prompt for Purchase Receive & Branch Stock Issue Features

You can use the following prompt to instruct an AI to build these features. 

---
**Copy the prompt below:**

Please implement the following features for my Point of Sale web application. The application already has a sales part, and I need similar functionality for inventory management.

### 1. Manual Purchase Receive
Currently, when a manual purchase is made, there is no option to receive the stock. Please build a "Purchase Receive" module with the following requirements:
*   **Pending Purchases List:** A page displaying all pending purchase orders.
*   **Full Receive Action:** A UI similar to the sales part where I can confirm the receipt of purchased items. The entire purchase must be received at once (no partial receives).
*   **Stock Update:** Upon receiving the items, the inventory stock for the respective branch/warehouse should be automatically increased.
*   **Status Tracking:** Update the purchase status (e.g., Pending -> Received).

### 2. Branch Stock Issue and Receive
I need a system to manage stock transfers between branches with manager approval. 
*   **Issue Stock Request:** An interface where a branch (or the main warehouse) can request to issue/transfer stock to another branch.
*   **Manager Approval:** The stock issue request must be approved by a Manager before the stock is actually transferred or marked as incoming for the destination branch.
*   **Incoming Stock List:** The destination branch should have a dashboard/list showing "Incoming Stock" that has been issued to them (after manager approval).
*   **Receive Stock (Transfer In):** The destination branch must manually "Receive" the incoming stock.
*   **Branch Stock Update:** Once the destination branch receives the transfer, their local stock should increase.

Please provide the necessary database schema updates (Prisma/SQL), backend API routes (Node.js/Express), and frontend React components to achieve this.
---
