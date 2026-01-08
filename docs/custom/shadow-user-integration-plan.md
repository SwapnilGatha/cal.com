# Shadow User Integration Plan (A ↔ B Booking)

This plan outlines how to integrate your custom React application with your self-hosted Cal.com instance to allow any registered user to book any other user for free (AGPL license).

## 1. Technical Strategy: "Shadow Users"
Instead of using the Commercial Platform API (v2 EE), we will use Cal.com's core "Standard User" model. Your React app will manage the users, and Cal.com will act as the background engine.

### Workflow:
1. **Sync**: When a user registers in your React App, your backend calls a "Sync Service" to create a matching account in Cal.com.
2. **Store**: Your React App stores the Cal.com `username` (slug) in its own database.
3. **Embed**: When User A wants to book User B, the React app uses the stored slug to open a Cal.com Modal.

---

## 2. Backend Component: User Sync API

We need a way for your React App's backend to programmatically create users in Cal.com.

### Action Items:
- [ ] **Create a Production-Ready Sync Script**: Transform the previous `create-user.ts` into a modular utility that can be imported or called via a secure internal API.
- [ ] **Define the User Mapping**:
| React User Property | Cal.com User Mapping |
| :--- | :--- |
| `email` | `email` |
| `name` | `name` |
| `internal_id` | `username` (e.g., `user-123`) |
| `default_password` | `password` (Hashed via Bcrypt) |

---

## 3. Frontend Component: React Integration

Using the `@calcom/embed-react` library.

### Action Items:
- [ ] **Install Dependency**: `npm install @calcom/embed-react`
- [ ] **Implement Dynamic Booking**:
  - The "Book Meeting" button retrieves the target user's `calcom_slug`.
  - Open the modal pointing to `http://your-calcom.com/[slug]/[meeting-type]`.
- [ ] **Auto-fill Guest Info**: Pass the currently logged-in user's name and email to the embed so they don't have to re-enter it.

---

## 4. Local Verification & Testing

To test this locally before moving to production (using your current running Docker setup):

### Step 1: Simulate Backend Sync
We will create a script `scripts/sync-test.ts` that simulates your React app creating 3 dummy users (User B, User C, User D).

### Step 2: Database Check
Verify that all 3 users appear in the `database` container with correct slugs.

### Step 3: Mock Frontend Call
Construct a set of `curl` commands or a simple HTML file to verify that the booking links for these users are active.

---

## 5. Security Considerations
- **Internal API**: The link between your React Backend and Cal.com Database should be secure (not exposed to the public).
- **SSO (Optional)**: If you want User B to be able to "Manage" their own availability inside your app, we will need to implement a simple JWT/Autologin token.

---

## Next Steps
1. **Approve this plan.**
2. I will create the `sync-test.ts` script for you to run locally.
3. We will verify the users in the database.
