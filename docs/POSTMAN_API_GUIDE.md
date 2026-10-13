# Storify Backend — Postman API Integration Guide

## Overview
This guide provides complete instructions for Flutter frontend developers integrating with the Storify backend APIs using Postman.

The accompanying files are:
- [`Storify_API.postman_collection.json`](../Storify_API.postman_collection.json) (Postman Collection v2.1)
- [`Storify Local.postman_environment.json`](../Storify Local.postman_environment.json) (Postman Environment)

---

## 1. Quick Setup & Base URL

### Base URL
- Default Local URL: `http://localhost:3000`
- API Version Prefix: `/api/v1`
- Full API Endpoint Root: `http://localhost:3000/api/v1`

In Postman, requests use the collection variable `{{baseUrl}}`. Ensure the `Storify Local` environment is selected or collection variables are enabled.

---

## 2. Authentication Architecture

Storify uses stateless **JSON Web Tokens (JWT)**.
- **Issuance**: Tokens are returned upon successful `POST /api/v1/auth/register` and `POST /api/v1/auth/login`.
- **Header Format**: Include the Bearer token in the `Authorization` header on all protected requests:
  ```http
  Authorization: Bearer <your_jwt_token>
  ```
- **Postman Automation**: The `Login` and `Register` requests in the Postman collection include automated test scripts that automatically extract `res.data.token` and store it in the collection variable `{{authToken}}`. Subsequent requests automatically inherit this variable.

### Recommended Flutter Integration Flow
```
                     APP START
                         │
                         ▼
             Has saved JWT in secure storage?
                 ├── Yes ──► GET /api/v1/auth/me (Verify session)
                 │               ├── 200 OK ──► Proceed to Dashboard
                 │               └── 401 ──► Token expired, prompt Login
                 │
                 └── No ───► Show Login / Register Screen
                                 │
                                 ▼
                     POST /api/v1/auth/login (or register)
                                 │
                                 ▼
                     Store JWT in FlutterSecureStorage
                                 │
                                 ▼
                         GET /api/v1/auth/me
                                 │
                                 ▼
                         GET /api/v1/plans (Display available tiers)
                                 │
                                 ▼
                         GET /api/v1/storage (Display quota progress bar)
                                 │
                                 ▼
                         GET /api/v1/storage/files (List user files)
                                 │
                                 ▼
                     POST /api/v1/purchases (Create pending purchase order)
                                 │
                                 ▼
                 [Payment integration will be added in Step 05]
                                 │
                                 ▼
                 [Automatic entitlement will be added in Step 06]
```

> [!IMPORTANT]
> **Payment Provider Notice**: No payment provider (UPI, Razorpay, Stripe, Cashfree, etc.) has been selected or implemented yet. Creating a purchase currently creates an order in `pending` status with an immutable plan snapshot. Do NOT write payment gateway logic in Flutter until Step 05 specifications are released.

---

## 3. Complete Backend Route Inventory

Every active route in the current backend codebase is organized logically into Postman folders:

| Method | Endpoint | Folder | Auth Required | Purpose |
|:---|:---|:---|:---:|:---|
| `GET` | `/health` | **Health** | No | Root server and MongoDB connectivity check |
| `GET` | `/api/v1/health` | **Health** | No | API v1 healthcheck endpoint |
| `POST` | `/api/v1/auth/register` | **Auth** | No | Register new user (assigns 50 MB Free tier) |
| `POST` | `/api/v1/auth/login` | **Auth** | No | Authenticate user & issue JWT token |
| `GET` | `/api/v1/auth/me` | **Auth** | **Yes** | Get current authenticated user profile |
| `POST` | `/api/v1/auth/forgot-password` | **Auth** | No | Request password reset token (valid 15m) |
| `POST` | `/api/v1/auth/reset-password` | **Auth** | No | Reset password using unhashed token |
| `PUT` | `/api/v1/auth/change-password` | **Auth** | **Yes** | Change password via PUT on auth router |
| `PATCH` | `/api/v1/auth/change-password` | **Auth** | **Yes** | Change password via PATCH on auth router |
| `PUT` | `/api/v1/auth/password` | **Auth** | **Yes** | Change password alias route (PUT) |
| `PATCH` | `/api/v1/auth/password` | **Auth** | **Yes** | Change password alias route (PATCH) |
| `POST` | `/api/v1/auth/logout` | **Auth** | No | Stateless client session logout |
| `GET` | `/api/v1/users/me` | **Users** | **Yes** | Retrieve user profile metadata via users router |
| `PATCH` | `/api/v1/users/me` | **Users** | **Yes** | Update user profile (`name`) |
| `PUT` | `/api/v1/users/me/password` | **Users** | **Yes** | Update password via users router (PUT) |
| `PATCH` | `/api/v1/users/me/password` | **Users** | **Yes** | Update password via users router (PATCH) |
| `GET` | `/api/v1/users/me/storage` | **Users** | **Yes** | Retrieve user storage quota consumption |
| `GET` | `/api/v1/storage` | **Storage** | **Yes** | Storage summary (used, allocated, percentage) |
| `POST` | `/api/v1/storage/files` | **Storage** | **Yes** | Upload file (multipart/form-data field `file`) |
| `GET` | `/api/v1/storage/files` | **Storage** | **Yes** | List user files with pagination (`page`, `limit`) |
| `GET` | `/api/v1/storage/files/:fileId` | **Storage** | **Yes** | Get metadata for a specific file (IDOR protected) |
| `GET` | `/api/v1/storage/files/:fileId/access` | **Storage** | **Yes** | Stream private physical file content |
| `DELETE` | `/api/v1/storage/files/:fileId` | **Storage** | **Yes** | Delete physical file and reclaim used quota |
| `GET` | `/api/v1/plans` | **Plans** | **Yes** | List all active plans sorted by `sortOrder` |
| `GET` | `/api/v1/plans/:planId` | **Plans** | **Yes** | Get single plan details by ObjectId |
| `POST` | `/api/v1/purchases` | **Purchases** | **Yes** | Create pending purchase order with plan snapshot |
| `GET` | `/api/v1/purchases` | **Purchases** | **Yes** | List user purchase history (`page`, `limit`) |
| `GET` | `/api/v1/purchases/:purchaseId` | **Purchases** | **Yes** | Get purchase record by ObjectId (IDOR protected) |

---

## 4. Key Request Details & Payloads

### A. Auth & Registration
- **`POST /api/v1/auth/register`**:
  ```json
  {
    "name": "Jane Doe",
    "email": "jane.doe@example.com",
    "password": "Password123",
    "acquisitionSource": "ORGANIC"
  }
  ```
  *Note*: `acquisitionSource` is optional (`ORGANIC` | `ADVERTISEMENT`). Defaults to `ORGANIC`.

- **`POST /api/v1/auth/login`**:
  ```json
  {
    "email": "jane.doe@example.com",
    "password": "Password123"
  }
  ```

- **`POST /api/v1/auth/forgot-password`**:
  ```json
  {
    "email": "jane.doe@example.com"
  }
  ```

- **`POST /api/v1/auth/reset-password`**:
  ```json
  {
    "token": "<token_from_forgot_password>",
    "newPassword": "NewSecurePassword123"
  }
  ```

- **`PUT` or `PATCH /api/v1/auth/change-password`**:
  ```json
  {
    "currentPassword": "Password123",
    "newPassword": "NewPassword123"
  }
  ```

---

### B. Storage & File Uploads
- **Upload Endpoint**: `POST /api/v1/storage/files`
- **Request Format**: `multipart/form-data`
- **Field Name**: **`file`** (type: `File`)
- **Single File Size Limit**: **50 MB** (`52,428,800` bytes).
- **Accepted File Categories**:
  - Images: `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/svg+xml`
  - Documents: `application/pdf`, `application/msword`, `.docx`, `.xls`, `.xlsx`, `.ppt`, `.pptx`, `text/plain`, `text/csv`
  - Audio/Video: `audio/mpeg`, `audio/wav`, `audio/ogg`, `audio/mp4`, `video/mp4`, `video/webm`, `video/quicktime`
  - Archives: `application/zip`, `.rar`, `.7z`
- **Quota Accounting**:
  - Automatically verifies available quota before saving.
  - Concurrency-safe: atomically reserves bytes in MongoDB before physical disk or Bunny.net storage write.
  - Rollback guarantee: if storage or database fails, reserved quota is refunded immediately.

### C. Private File Access / Streaming
- **Endpoint**: `GET /api/v1/storage/files/:fileId/access`
- **Headers**: Requires Bearer JWT.
- **Behavior**:
  - Verifies user ownership (`userId == req.user._id`).
  - Streams file bytes directly from the active physical storage provider (Local filesystem or Bunny.net Edge Storage).
  - Returns appropriate headers:
    - `Content-Type: <mimeType>`
    - `Content-Length: <sizeBytes>`
    - `Content-Disposition: attachment; filename="<originalName>"`
  - **Zero Credential Exposure**: Bunny.net Storage Zone credentials and internal storage keys are never exposed to Flutter.

---

### D. Plans Catalog (Database-Driven)
- **`GET /api/v1/plans`**:
  Returns all active storage plans stored in MongoDB:
  - Free: 50 MB (`52,428,800` bytes)
  - Basic: 300 MB (`314,572,800` bytes)
  - Premium: 500 MB (`524,288,000` bytes)
  - Pro: 900 MB (`943,718,400` bytes)
  *Note*: Prices, currencies, and durations currently return `null` because commercial pricing is configuration-driven and will be set in Phase 2.

---

### E. Purchases
- **`POST /api/v1/purchases`**:
  ```json
  {
    "planId": "{{planId}}"
  }
  ```
- **Security & Business Rules**:
  - **Immutable Plan Snapshotting**: The purchase subdocument freezes `{ planId, planCode, planName, storageBytes, price, currency, durationDays }` at purchase creation time. Future plan edits in MongoDB never alter historical purchases.
  - **Durable Acquisition Source**: `acquisitionSource` is strictly inherited from `req.user.acquisitionSource`. Client request payloads cannot override it.
  - **Duplicate Purchase Cooldown**: If a pending purchase already exists for the identical user and plan within the last 5 minutes, it is reused and returned (`200 OK`) instead of creating duplicate database records.
  - **Zero Storage Quota Mutation**: Creating a purchase order does **not** increase user storage (`allocatedBytes` remains 50 MB until Step 06 Entitlement).

---

## 5. Common Error Responses & Validation Failures

All errors return a structured JSON response envelope:
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation error message",
  "errors": null
}
```

### Common Status Codes:
- `400 Bad Request`: Validation failure (e.g., password too short, invalid email, file too large, unsupported MIME type, quota exceeded).
- `401 Unauthorized`: Missing or expired JWT Bearer token.
- `403 Forbidden`: Insufficient role permissions.
- `404 Not Found`: Resource does not exist OR resource belongs to another user (strict IDOR protection on files and purchases).
- `500 Internal Server Error`: Unhandled server exception.

---

## 6. Implementation Status & Scope Boundaries

### Currently Implemented (Phase 1):
- [x] Step 01: Foundation + Auth + User Management
- [x] Step 02: Storage + Files (Local Storage Provider)
- [x] Storage Provider Abstraction: Bunny.net Edge Storage HTTP Integration
- [x] Step 03: Database-Driven Plans Catalog
- [x] Step 04: Purchase Orders & Plan Snapshotting

### NOT Implemented Yet (Do Not Build in Frontend):
- [ ] Step 05: UPI / Payment Gateway Integration (Provider not decided yet)
- [ ] Step 06: Automatic Storage Access / Entitlement (allocatedBytes increase)
- [ ] Phase 2: Admin Backend & Frontend Management APIs
- [ ] Phase 2: Public File Sharing Links
- [ ] Phase 2: Premium Content & Advertisement Flows
