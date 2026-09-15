# Razorpay Integration Blueprint

This blueprint outlines the technical integration plan for Razorpay as our exclusive SaaS subscription payment gateway, utilizing our FastAPI backend and Next.js frontend.

## 1. Database Schema

We need to update our database models (SQLAlchemy) to support Razorpay customer and subscription tracking linked to our existing tenants.

### Proposed Changes to Tenant Model (or a new Subscription Model)
- `razorpay_customer_id` (String, nullable=True): Razorpay's unique customer identifier (e.g., `cust_12345`).
- `razorpay_subscription_id` (String, nullable=True): Active subscription ID (e.g., `sub_12345`).
- `subscription_status` (String, default='inactive'): Current status (`created`, `authenticated`, `active`, `pending`, `halted`, `cancelled`, `completed`, `expired`).

> [!NOTE]
> Depending on whether a tenant can have multiple historical subscriptions, we might want a dedicated `subscriptions` table instead of just fields on the `tenant` table. For SaaS, a single active subscription per tenant is common, but tracking history via a separate table is recommended.

## 2. Backend API (FastAPI)

We will implement a new router module for billing/payments with the following endpoints:

### `POST /api/v1/billing/customer`
- **Purpose**: Creates a Razorpay Customer.
- **Trigger**: When a user registers or initiates the checkout process for the first time.
- **Action**: Calls Razorpay API to create customer, saves `razorpay_customer_id` to DB.

### `POST /api/v1/billing/subscription`
- **Purpose**: Creates a new Subscription.
- **Payload**: Requires the selected `plan_id` (internal or Razorpay Plan ID).
- **Action**: Uses `razorpay_customer_id` to create a subscription on Razorpay. Returns the `subscription_id` to the frontend for checkout initiation.

### `GET /api/v1/billing/subscription/status`
- **Purpose**: Fetches current subscription status.
- **Action**: Checks local DB for status, optionally polling Razorpay if needed, to gate access to premium SaaS features.

## 3. Webhook Security

Webhooks are crucial for keeping our database in sync with Razorpay without constant polling.

### `POST /api/v1/webhook/razorpay`
- **Purpose**: Listens to Razorpay asynchronous events.
- **Key Events to Handle**:
  - `subscription.charged`: Payment successful, mark status as `active`, update billing cycle dates.
  - `subscription.halted`: Payment failed multiple times, mark status as `halted`, restrict user access.
  - `subscription.cancelled`: User or admin cancelled, handle offboarding.

> [!IMPORTANT]
> **Strict Signature Verification**
> We MUST verify the `x-razorpay-signature` header using our webhook secret. The signature is calculated using HMAC-SHA256 of the raw request body and the webhook secret. Only process the event if the calculated signature matches the header to prevent spoofing.

## 4. Frontend Integration (Next.js)

We will use the standard Razorpay Checkout integration to avoid handling PCI-sensitive card data on our servers.

### Process Flow
1. User clicks "Subscribe" on the pricing page.
2. Next.js calls `POST /api/v1/billing/subscription` to get the `subscription_id`.
3. We dynamically load the Razorpay checkout script (e.g., `https://checkout.razorpay.com/v1/checkout.js`).
4. We initialize the Razorpay instance with our public `key_id`, the `subscription_id`, and a callback function.
5. On successful client-side authorization, the callback receives `razorpay_payment_id`, `razorpay_subscription_id`, and `razorpay_signature`.
6. (Optional but recommended) Next.js sends these to a backend verification endpoint `POST /api/v1/billing/verify` to confirm success immediately, though the webhook will also handle it asynchronously.

## 5. Execution Checklist

- [ ] **Step 1: Configuration & Setup**
  - Obtain test API keys (`key_id`, `key_secret`) from Razorpay dashboard.
  - Setup webhook endpoint in Razorpay dashboard and generate a webhook secret.
  - Add keys and secret to `.env`.
- [ ] **Step 2: Database Updates**
  - Update SQLAlchemy models with Razorpay fields.
  - Generate and run Alembic migrations.
- [ ] **Step 3: Backend Integration (FastAPI)**
  - Install `razorpay` Python SDK.
  - Implement `/customer` and `/subscription` API endpoints.
- [ ] **Step 4: Webhook Implementation**
  - Implement `/webhook/razorpay` endpoint.
  - Add HMAC signature verification logic.
  - Implement event handlers for `charged` and `halted`.
- [ ] **Step 5: Frontend Integration (Next.js)**
  - Create the UI for selecting a plan and initiating checkout.
  - Implement dynamic script loading for Razorpay Checkout.
  - Handle checkout success and failure callbacks.
- [ ] **Step 6: Testing**
  - Test end-to-end subscription flow using Razorpay test cards.
  - Simulate webhook events using the Razorpay dashboard or Postman.
