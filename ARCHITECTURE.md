# Husky Share — Product Architecture

This document explains what Husky Share is, how it works, and how the code is organized. It is written for anyone new to the project, whether that is a teammate, a reviewer, or an AI coding assistant.

The detailed sources are in the [team Notion](https://app.notion.com/p/INFO-442-F-Team-a6a34f64765c4ef9ae21a4f4bf14be42). This document summarizes them and points to them. If the two disagree, the Notion **Requirements** page wins.

| Source | What it holds |
| --- | --- |
| Notion → Specifications | Problem statement, research, and screen-by-screen wireframes with descriptions |
| Notion → Requirements | Numbered, testable requirements (F1.1, L4.9, LS5, NF7, …) |
| Notion → Data Modelling | Logical data model (what we store) |
| Notion → Delivery Plan | Milestones and issues, which match GitHub Milestones and Issues |
| `SETUP.md` | How to install, run, and verify the app locally |
| `src/data/schema.js` | Collection names, status values, and document shapes used in code |

---

## 1. What Husky Share is

### The problem

UW students often buy things they only need for a short time, such as a moving cart, a desk lamp, or a rice cooker. Dorms are small and buying new is expensive. Someone a few minutes away usually already owns the item, but there is no easy way to find them outside your friend group.

The same items are often thrown away. During move-out week in June 2025, UW residence halls sent more than 80 tonnes of material to landfill. Students are willing to give things away and other students need them, but timing, storage, and coordination get in the way.

Existing platforms (Facebook Marketplace, OfferUp, Buy Nothing) are not built for a campus. You cannot tell whether the other person is a student, and you still have to message back and forth to find out where an item is and when you can meet.

### The solution

Husky Share is a web app, used mainly on phones, where **verified UW students** can:

- **Borrow / Lend** an item for a period of time and return it
- **Buy / Sell** an item for a fixed price
- **Get / Give** an item for free

Students find items on a **campus map**, send a **request**, and the owner approves it with a **pickup time and place**. Borrowing uses **photos at pickup and return** so both sides have a record of the item's condition. **Points** reward people who share, and **star ratings** help students trust each other.

The project supports UN Sustainable Development Goal 12.5: reduce waste through reuse.

### Who uses it

Only students with a `@uw.edu` Google account. Every user can be both an **owner** (posts items) and a **requester** (asks for items).

### Team

| Name | Role |
| --- | --- |
| Harry Han | Developer |
| Ling Wang | Developer |
| Peitong Qi | Developer |
| Jessie Zhuang | Product Designer |
| Stella Sun | Product Manager |

---

## 2. Key concepts

| Term | Meaning |
| --- | --- |
| **Listing** | An item someone posted. It has one type: Lend, Sell, or Give. |
| **Listing type** | The owner posts with **Lend / Sell / Give**. Other users browse with **Borrow / Buy / Free**. These are the same three types seen from the two sides. |
| **Owner** | The user who posted the listing (lender, seller, or giver). |
| **Requester** | The user who asks for the item (borrower, buyer, or recipient). |
| **Request** | One requester asking for one listing. A single request record covers the whole exchange, from "Pending" until it is complete. |
| **Pickup Area** | One of five fixed campus areas (North Campus, West Campus, South Campus, Central Campus, U District). Each one has a map position. Map markers are placed at the pickup area, not at a user's address, to protect privacy. |
| **Timeline** | The stages a request moves through after approval, shown to both users. |
| **Points** | Earned for lending, borrowing, and giving. They decide the order of search results. |
| **Rating** | 1–5 stars plus feedback tags, given after a completed exchange. |

Map colors: **blue = Borrow**, **yellow = Buy**, **green = Free**.

---

## 3. How it works (user flows)

Screen IDs (F1, L4, B2, …) match the Notion Specifications and Requirements.

### 3.1 Getting in

1. **F1 Verification:** the user enters a UW email. Empty or non-`@uw.edu` emails show an error.
2. A Google sign-in window opens with the email filled in.
3. On success, the user lands on the **map (F2)**. On failure, they return to F1 with an error.
4. A verified user who has not signed out goes straight to the map next time. Signed-out users always see F1.

### 3.2 Navigation

A **home bar** appears on every page except F1:

- **Map:** the main browsing page (F2)
- **Manage:** links to *my lending / selling / giveaway listings* (L3, S3, G3), plus the requests I have sent and their status. A badge shows how many new requests my listings have received.
- **My Account:** name, UW email, total points, and Sign Out

From the map, a purple **"+" Post Items** button opens **F3 Post an Item**, where the user picks Lend, Sell, or Give.

### 3.3 Borrowing (Lend ↔ Borrow), the core flow

| Step | Lender | Borrower |
| --- | --- | --- |
| 1 | **L1** fills in the lending form: name, category, condition, pickup area, available dates and time slot, photo | |
| 2 | **L2** sees a confirmation. The listing is now **Active** and appears on the map. | |
| 3 | | **B1** finds the blue marker on the map or through search |
| 4 | | **B2** opens item details and taps "Send Request" |
| 5 | | **B3** fills in start date, return date, pickup preference, and purpose |
| 6 | | **B4** sees the request as **Pending** and can cancel it |
| 7 | **L4** sees the request with the borrower's rating and tags, then approves (entering pickup date, time, and location) or declines | |
| 8 | **L5** ongoing page with timeline: Approved → Pickup → Return → Received | **B5** sees the same timeline |
| 9 | **L6** "Mark as Picked Up" plus a photo | **B6** "Mark as Picked Up" plus a photo. The stage moves to **Pickup** only after **both** have confirmed. |
| 10 | | **B7** returns the item, adds a photo, and the stage becomes **Return** |
| 11 | **L7** confirms the return with 1–3 photos, and the stage becomes **Received** | |
| 12 | **L8** +10 points, rates the borrower | **B8** +5 points, rates the lender |

### 3.4 Selling (Sell ↔ Buy)

1. **S1–S2** the seller posts with a price, then sees a confirmation.
2. **S4–S5** the buyer finds the yellow marker, opens the details, and taps "I want it". This creates a Pending request, which the buyer can cancel.
3. **S3** the seller sees the purchase requests on their listing and accepts (entering pickup date, time, and location) or declines.
4. **S6** timeline: Approved → Pickup. The buyer taps "Mark as Picked Up" and the sale is complete.
5. There is no return step and no points for selling.

### 3.5 Giving (Give ↔ Free)

1. **G1–G2** the giver posts the item (no price), then sees a confirmation.
2. **G6** the recipient finds the green marker, opens the details, and taps "I want it". This creates a Pending request, which the recipient can cancel.
3. **G3** the giver sees requests and approves (entering pickup details) or declines.
4. **G4** timeline: Approved → Pickup → Rate. The **giver** taps "Mark as Picked Up".
5. **G5** the giver gets +15 points and rates the recipient.

---

## 4. Business rules

### 4.1 Listing status (LS)

| Status | Meaning | Visible to others? |
| --- | --- | --- |
| Active | Published and available | Yes, on the map and in search |
| Inactive | The available end date has passed (LS9) | No |
| On Loan | A borrow request was approved (Lend only) | No |
| Sold | A purchase request was approved (Sell only) | No |
| Given Away | A giveaway request was approved (Give only) | No |

- A new listing starts as **Active** (LS1).
- When one request is approved, every other pending request for that listing becomes **Declined** (LS4). The listing is locked and takes no new requests (LS11–LS12).
- A lending listing goes back to **Active** when the transaction reaches **Received** (LS6).

```
Lend:  Active ──approve──▶ On Loan ──Received──▶ Active
Sell:  Active ──approve──▶ Sold
Give:  Active ──approve──▶ Given Away
Any:   Active ──end date passes──▶ Inactive
```

### 4.2 Request status

```
Pending ──owner approves──▶ Approved ──▶ (timeline stages, see below)
Pending ──owner declines──▶ Declined
Pending ──requester cancels──▶ Canceled
```

Timeline after approval:

| Type | Stages | Who moves it forward |
| --- | --- | --- |
| Borrow | Approved → Pickup → Return → Received | Pickup: **both** users confirm with photos. Return: borrower confirms with a photo. Received: lender confirms with photos. |
| Buy | Approved → Pickup | Buyer marks picked up |
| Free | Approved → Pickup → Rate | Giver marks picked up |

An owner cannot approve a request the requester has already canceled. The app shows an error and the request stays Canceled.

### 4.3 Points (P)

| Event | Points |
| --- | --- |
| Lending reaches Received | Lender +10, borrower +5 |
| Giveaway reaches Pickup | Giver +15 |
| Selling | No points |

- Points are never added twice for the same request (P4). One points record is stored per request.
- Search results are ordered by the owner's total points, highest first (P5). This rewards people who share more.

### 4.4 Ratings (R)

- After a completed exchange, each side gives 1–5 stars plus optional tags (On Time, Polite, Gentle Use, Quickly Reply).
- A user can rate each transaction only once (R9).
- A user's overall rating is the average of all stars they have received, rounded to the nearest whole star (R8). Users with no ratings show "No ratings yet" (R10).
- Request cards (L4, S3, G3) show the requester's overall rating and their top 3 most-received tags (R13).

### 4.5 Photos (PH)

Photos are used on listings (one photo) and on pickup and return confirmation (borrowing only). Only image files are accepted, and the user sees a preview before submitting.

---

## 5. Data model

From Notion → Data Modelling. Data that comes from outside services (Google sign-in, the map) is not stored.

```
User ──owns──▶ Listing ──at──▶ Pickup Area
  │               ▲
  │               │ for
  └──makes──▶ Request ──has──▶ Confirmation Photo
                  │
                  ├──has──▶ Rating (rater → rated user)
                  └──earns─▶ Points Record (one per user per request)
```

| Entity | Key fields |
| --- | --- |
| **User** | name, UW email, total points, overall rating |
| **Pickup Area** | name, latitude, longitude |
| **Listing** | owner, type (Lend/Sell/Give), item name, category, condition, pickup area, available start and end date, time slot, photo, price (Sell only), status |
| **Request** | listing, requester, status, created at, viewed by owner, requested start and return date (Borrow only), pickup preference and purpose (Borrow only), pickup date, time, and location, owner and requester pickup confirmed |
| **Confirmation Photo** | request, uploaded by, stage (Pickup/Return), photo |
| **Rating** | request, rater, rated user, stars (1–5), tags |
| **Points Record** | user, request, points |

Fixed dropdown values (not stored as separate tables):
- **Category:** Furniture, Electronics, Kitchen & Appliances, Bedding & Linens, Clothing & Accessories, Books & School Supplies, Sports & Outdoor, Moving & Storage, Other
- **Condition:** New, Like New, Good, Fair
- **Time slot:** Morning, Afternoon, Evening

> **Known gap (Nov 2026):** `src/data/schema.js` does not fully match this model yet. Listing statuses use `Unavailable` in place of On Loan / Sold / Given Away. Request is missing *viewed by owner* and the two *pickup confirmed* fields. Listing is missing *time slot*. There is no pickup area seed data. See the comment on PR #26.

---

## 6. Technical architecture

### 6.1 Stack

| Layer | Choice |
| --- | --- |
| Front end | React 18 + Vite, React Router for pages |
| Database | Firebase Cloud Firestore (NoSQL document database) |
| Sign-in | Firebase Authentication with Google, limited to `@uw.edu` |
| Hosting | Firebase Hosting (HTTPS only, NF6) |
| Local development | Firebase emulators for Firestore and Auth |
| Code quality | ESLint, which must pass before merging (NF10) |

There is **no separate back-end server**. The React app reads and writes Firestore directly. **Firestore security rules** (`firestore.rules`) are the access control layer:

- Only signed-in users with a verified `@uw.edu` email can read data (NF7).
- Users can only create or edit their own user profile and their own listings.
- Rules for requests, photos, ratings, and points are tightened in Sprint 2. Points records can only be written by trusted code.

```
 Browser (React app)
   │  Google sign-in ───────▶ Firebase Auth
   │  read/write documents ─▶ Firestore ── checked by firestore.rules
   │  (photos) ─────────────▶ Firebase Storage (planned, Issue 2.2)
   ▼
 Served by Firebase Hosting over HTTPS
```

### 6.2 Code layout

```
src/
  main.jsx              App entry
  App.jsx               All routes
  firebase.js           Firebase setup (switches to emulators locally)
  components/
    Layout.jsx          Page wrapper with the home bar
    HomeBar.jsx         Map / Manage / My Account
  pages/                One file per screen
  data/
    schema.js           Collection names, status values, document shapes
    currentUser.js      Signed-in user (mock until Issue 1.2)
firestore.rules         Database access rules
SETUP.md                How to run the project
```

### 6.3 Routes

| Route | Screen | Status |
| --- | --- | --- |
| `/` | Redirects to `/map` | Done |
| `/map` | F2 Map & search, plus the Post Items button | Placeholder map, button done |
| `/post` | F3 Post an Item | Done |
| `/post/lend`, `/post/sell`, `/post/give` | L1, S1, G1 forms | Placeholder (Milestone 2) |
| `/manage` | Manage | Links done, sent requests in Milestone 4 |
| `/manage/lend`, `/manage/sell`, `/manage/give` | L3, S3, G3 manage listings | Placeholder (Milestone 2) |
| `/account` | My Account | Done with a mock user |
| `/dev/db-check` | Database setup check | Dev only |

The verification page (F1) and item detail, request, and ongoing pages will be added by later issues. Pages with the home bar go inside the `Layout` route group in `App.jsx`. The verification page goes outside it.

### 6.4 Conventions

- One branch per issue, then a pull request to `main`.
- Run `npm run lint` before pushing.
- Import collection names and status values from `src/data/schema.js`. Do not type them by hand.
- Use the requirement IDs (e.g. "F2.16") in issues and PRs so work can be traced back to Notion.

---

## 7. Scope and plan

### 7.1 MVP (in scope)

Everything in the Notion Requirements sections 3.1–3.6 and the nonfunctional requirements NF1–NF10: verification, map and search, the three listing types, requests and approval, pickup and return confirmation, points, and ratings.

### 7.2 Stretch goals (not in the core plan)

- **AT:** owners manually deactivate or reactivate a listing.
- **SC:** borrowers edit a pending request to coordinate dates with the lender.
- **IR:** report damaged, missing-part, or unreturned items, with a dispute flow.

### 7.3 Milestones

| Milestone | Focus |
| --- | --- |
| M1 | App setup, UW verification, navigation |
| M2 | Listing forms, photo upload, confirmation, manage listings |
| M3 | Map, search and filters, item details |
| M4 | Borrow, purchase, and giveaway requests, approval and status rules |
| M5 | Ongoing pages, pickup and return confirmation |
| M6 | Points, ratings, final testing |

Issues and owners are tracked in GitHub Milestones.

### 7.4 Nonfunctional targets

| ID | Target |
| --- | --- |
| NF1 | The map loads with up to 200 markers within 3 seconds |
| NF2 | Search results appear within 1 second |
| NF3–NF4 | WCAG 2.1 AA contrast. Every image and icon button has alt text. |
| NF5 | No horizontal scrolling from 375px to 1440px wide |
| NF6 | HTTPS only |
| NF7 | Only verified `@uw.edu` users can read data |
| NF8 | A user's email is never shown to other users |
| NF9 | Failed saves leave no partial data |
| NF10 | ESLint passes with zero errors before merge |
