# Supply-Admin — Pre-Handover User Stories

User-story acceptance checklist to run through before sign-off. Every story is something an admin user should be able to do, see, or rely on during their day. Walk through each one against staging with realistic data; tick it only after you have personally completed the flow.

---

## Signing In

- [ ] I can sign in with my email and password and land on the dashboard.
- [ ] If I enter the wrong password, I see a clear error and the message does not tell me whether the email exists.
- [ ] If I close the tab and come back, I am still signed in.
- [ ] If I forget my password, I can request a reset email and finish the reset without help.
- [ ] When I sign out, I am returned to the login page and the back button does not let me back into the app.
- [ ] If someone without admin access tries to sign in, they are turned away with a clear message that this app is admin-only.

## Dashboard

- [ ] When I land on the dashboard, I can see how many orders came in today, revenue for the last 7 and 30 days, and how many products are low on stock.
- [ ] I can click the low-stock card and land on an inventory list already filtered to the items I need to reorder.
- [ ] I can see a short list of the most recent orders and inventory changes without scrolling.
- [ ] On a brand-new account with no data, the dashboard still looks tidy and explains what I will see once data arrives.

## Getting Around

- [ ] From any page, I can reach Dashboard, Catalog, Inventory, Clients, Orders, Pricing, Featured Items, API Tokens, and Admin Users in one click.
- [ ] When I type a SKU, customer name, or order number into the global search, the right result shows up and clicking it takes me to the right page.
- [ ] On any detail page, the breadcrumb at the top takes me back to the list I came from.
- [ ] When I save, archive, refund, or delete something, I see a confirmation message; when something fails, the error tells me what went wrong.

## Catalog

- [ ] I can browse my full product list, sort it, and search it.
- [ ] I can filter the list by category and by status (active or archived).
- [ ] I can add a new product, fill in all the fields, and save it; if I miss a required field, the form tells me exactly which one.
- [ ] I can open an existing product, change anything on it, save, and see my change stick.
- [ ] I can archive a product so it stops showing up in the default list, and I can bring it back later if needed.
- [ ] I can upload images for a product, drag them into the order I want, and remove ones I don't need.
- [ ] When I pick a category, I can see and choose from the full nested category tree.
- [ ] I can upload a CSV to add or update products in bulk, see a preview of what will change, see any row-level errors, and only commit after I confirm.
- [ ] I can export my catalog (the whole thing or a filtered view) to a CSV file.

## Inventory

- [ ] I can see every product's on-hand quantity, what's reserved, the low-stock threshold, and when it was last updated.
- [ ] I can filter to show only low-stock items, only out-of-stock items, or by category.
- [ ] I can record a manual inventory change with a quantity (positive or negative), pick a reason (receipt, manual adjustment, cycle count, damage, other), and add a note; the new total shows up immediately.
- [ ] I can open any product and see the full history of inventory changes: when, who, how much, why, and which order if applicable.
- [ ] Products that are below their low-stock threshold are clearly flagged wherever they appear in the app.

## Clients

- [ ] I can browse my client businesses in a searchable, filterable list.
- [ ] I can open a client and edit their business name, primary contact, email, phone, assigned sales rep, and status.
- [ ] I can add, edit, and remove shipping/billing addresses for a client and mark one as the default shipping address.
- [ ] I can add a new client; during that flow, I can optionally invite a portal login so the client can sign in themselves.
- [ ] When I suspend a client, they can no longer place orders or sign in to the portal.
- [ ] I can leave internal notes on a client that other admins can read.
- [ ] I can keep multiple named contacts per client (e.g. ordering contact, billing contact, owner).

## Per-Client Pricing

- [ ] On a client's Pricing tab, I can see every pricing rule that applies to them.
- [ ] I can create a new rule for either a specific product or an entire category, choose between a fixed price or a percent discount, and optionally set a start and end date.
- [ ] If I try to enter an invalid discount (less than 0%, more than 100%, or a negative price), the form blocks me and tells me why.
- [ ] I can edit or delete an existing rule.
- [ ] I can pick a product and instantly see what this specific client would pay for it, and which rule decided that price.
- [ ] I can see who changed which rule and when.
- [ ] If two rules conflict (same product or category for the same client), the app flags it so I can fix it.

## Featured Items

- [ ] On a client's Featured tab, I can add individual products or pre-made featured groups in the order I want them displayed.
- [ ] I can drag items to reorder them and the new order sticks.
- [ ] I can remove a featured item without affecting the others.
- [ ] On the Featured Groups page, I can create reusable groups with a name, description, and ordered list of products that I can then assign to many clients.

## Orders

- [ ] I can browse every order across all clients, with status, client name, total, placed date, and source visible at a glance.
- [ ] I can filter by status, by client, by date range, and by source; I can sort by placed date or total.
- [ ] I can open any order and see the client, current status, totals, payment reference, source, the line items exactly as they were at the time of the order, the shipping address, and the timeline of what's happened so far.
- [ ] I can mark an order fulfilled, mark it shipped (entering a tracking number), mark it delivered, or cancel it.
- [ ] I can refund an order; before it runs, a confirmation modal tells me what will happen to inventory and the payment, and I have to confirm.
- [ ] I can refund part of an order rather than all of it.
- [ ] I can see the full history of payment attempts on the order.
- [ ] I can add internal notes to an order that only admins can see.

## Returns (RMAs)

- [ ] I can browse all RMAs across clients.
- [ ] I can open an RMA and see the items being returned, the status, and the history of what's happened.
- [ ] I can move an RMA through its lifecycle: requested → approved → received → refunded, with the right things happening at each step.
- [ ] I can add, edit, or remove line items on an RMA (product, quantity, unit refund amount).

## Invoices

- [ ] I can browse invoices across all clients.
- [ ] I can create a new invoice, choose the products it contains, preview what it will look like, and save it.
- [ ] I can edit an existing invoice and the changes stick.
- [ ] A client can open the link to their own invoice and view it themselves.

## Purchases

- [ ] I can browse purchase orders.
- [ ] I can create a new purchase order with line items, and edit it later.

## Trends (per Client)

- [ ] On a client's Trends tab, I can see how often they have ordered over the last 12 months.
- [ ] I can see their top 10 products by quantity and their top 10 products by revenue, as both a table and a chart.
- [ ] I can see the mix of categories they spend across.
- [ ] I can see products they used to order regularly but haven't ordered in the last N days (I can change N).
- [ ] I can export any of these tables to CSV.
- [ ] For a brand-new client with no order history, the Trends tab still looks tidy and explains what I'll see once orders arrive.

## API Tokens

- [ ] On a client's Tokens tab, I can see every token issued to them: label, when it was last used, when it was created, and whether it's been revoked.
- [ ] I can create a new token by giving it a label; the full token value is shown to me exactly once, in a copy-to-clipboard modal, with a clear warning that I will never see it again.
- [ ] I never see the full token value anywhere else — not in lists, not in detail pages, not in logs.
- [ ] I can revoke a token; once revoked, any API call using it fails.
- [ ] I can rotate a token in one action (revokes the old one and gives me a new one).

## Admin Users

- [ ] I can see every admin user.
- [ ] I can invite a new admin by email; they get an invitation and become a working admin.
- [ ] I can deactivate an admin so they can't sign in, while still keeping their history visible.

## Tasks, Tags, Territories, Routines

- [ ] I can create tasks, assign them to admins, attach them to clients, and mark them complete.
- [ ] I can manage tags and apply them to clients and products.
- [ ] I can manage sales territories and assign reps to them.
- [ ] Routine workflows do what they say they do for every role that uses them.

## Reports

- [ ] The AR aging report loads with realistic numbers and the totals reconcile against the underlying invoices.
- [ ] The profitability report loads with realistic numbers and the totals reconcile against the underlying orders.

## Image Generator

- [ ] I can generate an image and the result is saved where I expect to find it again.

## Quality I Should Be Able to Take for Granted

- [ ] Every long list paginates — nothing tries to load thousands of rows at once.
- [ ] Every destructive action (archive, revoke, refund, delete) asks me to confirm before it happens.
- [ ] Every page that loads data shows a skeleton or placeholder, not a blank screen.
- [ ] Every empty list explains what I'm looking at and what to do next.
- [ ] When something goes wrong on the server, I see a clear error message that I could repeat to support, not a stack trace or a blank page.
- [ ] If I save something and the save secretly fails, the change I thought I made is rolled back visibly in front of me.
- [ ] I can complete the most important flows (signing in, creating a product, taking an order, refunding an order) using only the keyboard.
- [ ] The primary forms are usable with a screen reader and don't have obvious accessibility problems.
- [ ] Every table with meaningful data has a CSV export button.

## Day-Two Operations

- [ ] There is a written runbook explaining how to manually cancel an order that has gotten stuck, and I have walked through it on staging.
- [ ] There is a written runbook explaining how to release an inventory hold, and I have walked through it on staging.
- [ ] There is a written runbook explaining how to rotate an admin's credentials, and I have walked through it on staging.
- [ ] When something breaks in production, someone is notified and the error tells them which admin user hit it.

## Going Live

- [ ] Staging has realistic test clients, products, and orders so we could rehearse every flow above.
- [ ] On the production environment, I have personally completed: sign in, create a product, take an order, refund an order, and revoke a token.
