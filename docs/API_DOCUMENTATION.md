# Storify Backend API Documentation

## Overview
Storify is a secure, scalable cloud storage application backend. This document provides complete details for **Phase 1: Step 01 (Foundation + Auth + User)**, **Step 02 (Storage + Files)**, **Step 03 (Plans)**, and **Step 04 (Purchase)**.

---

## Base URL
- Development: `http://localhost:3000/api/v1`
- Healthcheck: `http://localhost:3000/health`

---

## Authentication
Storify uses JSON Web Tokens (JWT) for authentication. When accessing protected routes, include the JWT token in the `Authorization` HTTP header:
```http
Authorization: Bearer <your_jwt_token>
```

---

## Endpoints

### 1. Healthcheck

#### `GET /health` or `GET /api/v1/health`
Checks server and database connection status.
- **Authentication**: None
- **Response (200 OK or 503 Degraded)**:
```json
{
  "statusCode": 200,
  "data": {
    "service": "storify-backend",
    "status": "healthy",
    "uptime": "12.34s",
    "timestamp": "2026-10-08T14:15:00.000Z",
    "environment": "development",
    "database": {
      "status": "connected",
      "connected": true
    }
  },
  "message": "Health status check",
  "success": true
}
```

---

### 2. Authentication (`/api/v1/auth`)

#### `POST /api/v1/auth/register`
Creates a new user account with default storage allocation (exactly 50 MB Free tier).
- **Authentication**: None
- **Request Body**:
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "Password123",
  "acquisitionSource": "ORGANIC"
}
```
*Note: `acquisitionSource` is optional (`ORGANIC` | `ADVERTISEMENT`). Defaults to `ORGANIC` if omitted.*
- **Response (201 Created)**:
```json
{
  "statusCode": 201,
  "data": {
    "user": {
      "_id": "64e8b9281a8b123456789abc",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "role": "user",
      "status": "active",
      "plan": "free",
      "acquisitionSource": "ORGANIC",
      "storage": {
        "usedBytes": 0,
        "allocatedBytes": 52428800
      },
      "isVerified": true,
      "createdAt": "2026-10-08T14:15:00.000Z",
      "updatedAt": "2026-10-08T14:15:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "User registered successfully",
  "success": true
}
```

#### `POST /api/v1/auth/login`
Authenticates an existing user and returns a signed JWT.
- **Authentication**: None
- **Request Body**:
```json
{
  "email": "jane@example.com",
  "password": "Password123"
}
```
- **Response (200 OK)**:
```json
{
  "statusCode": 200,
  "data": {
    "user": {
      "_id": "64e8b9281a8b123456789abc",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "role": "user",
      "status": "active",
      "plan": "free"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "Login successful",
  "success": true
}
```

#### `GET /api/v1/auth/me`
Fetches the currently authenticated user profile.
- **Authentication**: Bearer Token
- **Response (200 OK)**:
```json
{
  "statusCode": 200,
  "data": {
    "_id": "64e8b9281a8b123456789abc",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "role": "user",
    "status": "active",
    "plan": "free",
    "storage": {
      "usedBytes": 0,
      "allocatedBytes": 52428800
    }
  },
  "message": "Current user profile retrieved",
  "success": true
}
```

#### `POST /api/v1/auth/forgot-password`
Requests a secure 15-minute password reset token.
- **Authentication**: None
- **Request Body**:
```json
{
  "email": "jane@example.com"
}
```
- **Response (200 OK)**:
```json
{
  "statusCode": 200,
  "data": {
    "resetToken": "a3f5c71d9e...",
    "message": "Password reset token generated successfully. Valid for 15 minutes."
  },
  "message": "Password reset token generated successfully. Valid for 15 minutes.",
  "success": true
}
```

#### `POST /api/v1/auth/reset-password`
Resets account password using a valid reset token.
- **Authentication**: None
- **Request Body**:
```json
{
  "token": "a3f5c71d9e...",
  "newPassword": "NewPassword123"
}
```
- **Response (200 OK)**:
```json
{
  "statusCode": 200,
  "data": null,
  "message": "Password has been reset successfully. You can now login.",
  "success": true
}
```

#### `PUT` or `PATCH /api/v1/auth/change-password` (also `/api/v1/users/me/password`)
Updates user password after verifying current credentials.
- **Authentication**: Bearer Token
- **Request Body**:
```json
{
  "currentPassword": "Password123",
  "newPassword": "NewPassword456"
}
```
- **Response (200 OK)**:
```json
{
  "statusCode": 200,
  "data": null,
  "message": "Password changed successfully.",
  "success": true
}
```

#### `POST /api/v1/auth/logout`
Logs out the current session.
- **Authentication**: None
- **Response (200 OK)**:
```json
{
  "statusCode": 200,
  "data": null,
  "message": "Logged out successfully",
  "success": true
}
```

---

### 3. User Management (`/api/v1/users`)

#### `GET /api/v1/users/me`
Retrieves full user account information.
- **Authentication**: Bearer Token
- **Response (200 OK)**:
```json
{
  "statusCode": 200,
  "data": {
    "_id": "64e8b9281a8b123456789abc",
    "name": "Jane Doe",
    "email": "jane@example.com",
    "role": "user",
    "status": "active",
    "plan": "free",
    "storage": {
      "usedBytes": 10485760,
      "allocatedBytes": 52428800
    }
  },
  "message": "User profile retrieved successfully",
  "success": true
}
```

#### `PATCH /api/v1/users/me`
Updates user profile information (such as display name).
- **Authentication**: Bearer Token
- **Request Body**:
```json
{
  "name": "Jane Smith"
}
```
- **Response (200 OK)**:
```json
{
  "statusCode": 200,
  "data": {
    "_id": "64e8b9281a8b123456789abc",
    "name": "Jane Smith",
    "email": "jane@example.com"
  },
  "message": "Profile updated successfully",
  "success": true
}
```

---

### 4. Storage & Files (`/api/v1/storage`)

#### `GET /api/v1/storage`
Returns authenticated user's current storage usage, quota, and formatted display values.
- **Authentication**: Bearer Token
- **Response (200 OK)**:
```json
{
  "statusCode": 200,
  "data": {
    "plan": "free",
    "usedBytes": 10485760,
    "allocatedBytes": 52428800,
    "remainingBytes": 41943040,
    "usagePercentage": 20,
    "usedFormatted": "10 MB",
    "allocatedFormatted": "50 MB",
    "remainingFormatted": "40 MB"
  },
  "message": "Storage summary retrieved successfully",
  "success": true
}
```

#### `POST /api/v1/storage/files`
Uploads a single file for the authenticated user with server-side size validation and atomic quota reservation.
- **Authentication**: Bearer Token
- **Content-Type**: `multipart/form-data`
- **Body Field**: `file` (Binary file)
- **Response (201 Created)**:
```json
{
  "statusCode": 201,
  "data": {
    "_id": "64e8b9281a8b123456789abc",
    "userId": "64e8b9281a8b123456789001",
    "originalName": "document.pdf",
    "storageKey": "d8e37e58-6c8a-49fe-a5f1-3ec752496a40.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 204800,
    "extension": "pdf",
    "status": "active",
    "createdAt": "2026-10-08T14:40:00.000Z",
    "updatedAt": "2026-10-08T14:40:00.000Z"
  },
  "message": "File uploaded successfully",
  "success": true
}
```

#### `GET /api/v1/storage/files`
Lists uploaded files belonging strictly to the authenticated user with pagination.
- **Authentication**: Bearer Token
- **Query Parameters**:
  - `page` (optional, default: `1`): Positive integer
  - `limit` (optional, default: `20`, max: `100`): Positive integer
- **Response (200 OK)**:
```json
{
  "statusCode": 200,
  "data": {
    "files": [
      {
        "_id": "64e8b9281a8b123456789abc",
        "userId": "64e8b9281a8b123456789001",
        "originalName": "document.pdf",
        "storageKey": "d8e37e58-6c8a-49fe-a5f1-3ec752496a40.pdf",
        "mimeType": "application/pdf",
        "sizeBytes": 204800,
        "extension": "pdf",
        "status": "active",
        "createdAt": "2026-10-08T14:40:00.000Z"
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  },
  "message": "Files retrieved successfully",
  "success": true
}
```

#### `GET /api/v1/storage/files/:fileId`
Retrieves metadata and status for one file belonging to the user.
- **Authentication**: Bearer Token
- **Response (200 OK)**:
```json
{
  "statusCode": 200,
  "data": {
    "_id": "64e8b9281a8b123456789abc",
    "userId": "64e8b9281a8b123456789001",
    "originalName": "document.pdf",
    "storageKey": "d8e37e58-6c8a-49fe-a5f1-3ec752496a40.pdf",
    "mimeType": "application/pdf",
    "sizeBytes": 204800,
    "extension": "pdf",
    "status": "active",
    "createdAt": "2026-10-08T14:40:00.000Z"
  },
  "message": "File details retrieved successfully",
  "success": true
}
```

#### `GET /api/v1/storage/files/:fileId/access`
Provides authenticated streaming download access for the owner's file.
- **Authentication**: Bearer Token
- **Response**: Binary stream with headers:
  - `Content-Type`: file's MIME type
  - `Content-Length`: file's byte count
  - `Content-Disposition`: `attachment; filename="<originalName>"`

#### `DELETE /api/v1/storage/files/:fileId`
Deletes the file record, deletes physical storage via the abstraction layer, and automatically reclaims used quota (`usedBytes`).
- **Authentication**: Bearer Token
- **Response (200 OK)**:
```json
{
  "statusCode": 200,
  "data": null,
  "message": "File deleted successfully.",
  "success": true
}
```

---

### 5. Plans (`/api/v1/plans`)

> **MongoDB Plan documents are the runtime source of truth**:
> - Plan configuration is read dynamically from the MongoDB `Plan` collection on every request.
> - Plan values are **never** calculated or sourced from `.env`.
> - Plan storage quotas are **never** hardcoded into controllers or services.
> - Direct updates in MongoDB (or via Phase 2 Admin panel) are reflected immediately in API responses without code changes or restarts.
> - In Phase 1 — Step 03, the Plans module operates strictly as a catalog and configuration layer. Fetching or viewing plans produces **NO payment, purchase, or storage quota entitlement side effects**.

#### `GET /api/v1/plans`
Retrieves all currently active subscription plans directly from MongoDB, sorted ascending by `sortOrder`.
- **Authentication**: Bearer Token
- **Filtering**: Only plans with `status: "active"` are returned.
- **Runtime Source**: MongoDB database document values.
- **Response (200 OK)**:
```json
{
  "statusCode": 200,
  "data": {
    "plans": [
      {
        "_id": "64e8b9281a8b123456789001",
        "name": "Free Plan",
        "code": "free",
        "description": "Free tier with 50 MB storage allocation.",
        "storageBytes": 52428800,
        "price": null,
        "currency": null,
        "durationDays": null,
        "status": "active",
        "sortOrder": 0,
        "createdAt": "2026-10-08T15:00:00.000Z",
        "updatedAt": "2026-10-08T15:00:00.000Z"
      },
      {
        "_id": "64e8b9281a8b123456789002",
        "name": "Basic Plan",
        "code": "basic",
        "description": "Basic tier with 300 MB storage allocation.",
        "storageBytes": 314572800,
        "price": null,
        "currency": null,
        "durationDays": null,
        "status": "active",
        "sortOrder": 1,
        "createdAt": "2026-10-08T15:00:00.000Z",
        "updatedAt": "2026-10-08T15:00:00.000Z"
      },
      {
        "_id": "64e8b9281a8b123456789003",
        "name": "Premium Plan",
        "code": "premium",
        "description": "Premium tier with 500 MB storage allocation.",
        "storageBytes": 524288000,
        "price": null,
        "currency": null,
        "durationDays": null,
        "status": "active",
        "sortOrder": 2,
        "createdAt": "2026-10-08T15:00:00.000Z",
        "updatedAt": "2026-10-08T15:00:00.000Z"
      },
      {
        "_id": "64e8b9281a8b123456789004",
        "name": "Pro Plan",
        "code": "pro",
        "description": "Pro tier with 900 MB storage allocation.",
        "storageBytes": 943718400,
        "price": null,
        "currency": null,
        "durationDays": null,
        "status": "active",
        "sortOrder": 3,
        "createdAt": "2026-10-08T15:00:00.000Z",
        "updatedAt": "2026-10-08T15:00:00.000Z"
      }
    ]
  },
  "message": "Plans fetched successfully",
  "success": true
}
```

#### `GET /api/v1/plans/:planId`
Retrieves details for a single active plan directly from MongoDB.
- **Authentication**: Bearer Token
- **Parameters**: `planId` (must be a valid 24-character hexadecimal MongoDB ObjectId)
- **Status Guards**: Returns `404 Not Found` if the plan does not exist or has `status: "inactive"`.
- **Response (200 OK)**:
```json
{
  "statusCode": 200,
  "data": {
    "_id": "64e8b9281a8b123456789002",
    "name": "Basic Plan",
    "code": "basic",
    "description": "Basic tier with 300 MB storage allocation.",
    "storageBytes": 314572800,
    "price": null,
    "currency": null,
    "durationDays": null,
    "status": "active",
    "sortOrder": 1,
    "createdAt": "2026-10-08T15:00:00.000Z",
    "updatedAt": "2026-10-08T15:00:00.000Z"
  },
  "message": "Plan details retrieved successfully",
  "success": true
}
```

---

### 6. Purchases (`/api/v1/purchases`)

All purchase operations require Bearer JWT authentication and operate under strict user isolation and phase boundaries.

> [!NOTE]
> **Step 04 Boundaries**: Creating a purchase creates a record with `status: "pending"`. It does **not** process payment, verify UPI transactions, or modify the user's storage quota (`allocatedBytes` and `usedBytes` remain untouched). Payment verification and storage access/entitlement are reserved for Step 05 and Step 06.

#### `POST /api/v1/purchases`
Selects an active plan and creates a pending purchase order.
- **Authentication**: Bearer Token
- **Request Body**:
```json
{
  "planId": "64e8b9281a8b123456789002"
}
```
- **Guards & Business Rules**:
  - `planId` must be a valid 24-character hexadecimal MongoDB ObjectId referring to an active plan (`status: "active"`).
  - **Plan Snapshot Immutability**: The purchase stores an immutable `planSnapshot` containing `planId`, `planCode`, `planName`, `storageBytes`, `price`, `currency`, and `durationDays` taken from MongoDB at the exact moment of purchase creation. Future edits to the plan document will not alter historical purchase snapshots.
  - **Durable Acquisition Source**: The purchase automatically inherits the user's durable `acquisitionSource` (`ORGANIC` or `ADVERTISEMENT`) established at registration. Client requests cannot override or manipulate this value.
  - **Duplicate Purchase Protection (Idempotency)**: If an active pending purchase already exists for the identical user and plan created within the last 5 minutes (cooldown window), the existing pending purchase is reused and returned (`200 OK`) instead of generating duplicate database records.
  - **Zero Storage Quota Mutation**: Neither `user.storage.allocatedBytes` nor `user.storage.usedBytes` is modified upon purchase creation.
- **Response (201 Created)**:
```json
{
  "statusCode": 201,
  "data": {
    "_id": "64e8b9281a8b123456789010",
    "userId": "64e8b9281a8b123456789abc",
    "planId": "64e8b9281a8b123456789002",
    "planSnapshot": {
      "planId": "64e8b9281a8b123456789002",
      "planCode": "basic",
      "planName": "Basic Plan",
      "storageBytes": 314572800,
      "price": null,
      "currency": null,
      "durationDays": null
    },
    "status": "pending",
    "acquisitionSource": "ORGANIC",
    "paymentReference": null,
    "createdAt": "2026-10-11T12:00:00.000Z",
    "updatedAt": "2026-10-11T12:00:00.000Z"
  },
  "message": "Purchase created successfully",
  "success": true
}
```

#### `GET /api/v1/purchases`
Retrieves a paginated list of purchases belonging exclusively to the authenticated user.
- **Authentication**: Bearer Token
- **Query Parameters**:
  - `page` (optional integer, min: 1, default: 1)
  - `limit` (optional integer, min: 1, max: 100, default: 10)
  - `status` (optional string: `pending`, `paid`, `failed`, `cancelled`)
- **Response (200 OK)**:
```json
{
  "statusCode": 200,
  "data": {
    "purchases": [
      {
        "_id": "64e8b9281a8b123456789010",
        "userId": "64e8b9281a8b123456789abc",
        "planId": "64e8b9281a8b123456789002",
        "planSnapshot": {
          "planId": "64e8b9281a8b123456789002",
          "planCode": "basic",
          "planName": "Basic Plan",
          "storageBytes": 314572800,
          "price": null,
          "currency": null,
          "durationDays": null
        },
        "status": "pending",
        "acquisitionSource": "ORGANIC",
        "paymentReference": null,
        "createdAt": "2026-10-11T12:00:00.000Z",
        "updatedAt": "2026-10-11T12:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "limit": 10,
      "totalRecords": 1,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  },
  "message": "Purchases retrieved successfully",
  "success": true
}
```

#### `GET /api/v1/purchases/:purchaseId`
Retrieves a single purchase by ID with strict ownership validation.
- **Authentication**: Bearer Token
- **Parameters**: `purchaseId` (24-character hexadecimal MongoDB ObjectId)
- **Security Check**: Queries `{ _id: purchaseId, userId: req.user._id }`. If the purchase does not exist or belongs to another user, returns `404 Not Found` (zero IDOR vulnerability).
- **Response (200 OK)**:
```json
{
  "statusCode": 200,
  "data": {
    "_id": "64e8b9281a8b123456789010",
    "userId": "64e8b9281a8b123456789abc",
    "planId": "64e8b9281a8b123456789002",
    "planSnapshot": {
      "planId": "64e8b9281a8b123456789002",
      "planCode": "basic",
      "planName": "Basic Plan",
      "storageBytes": 314572800,
      "price": null,
      "currency": null,
      "durationDays": null
    },
    "status": "pending",
    "acquisitionSource": "ORGANIC",
    "paymentReference": null,
    "createdAt": "2026-10-11T12:00:00.000Z",
    "updatedAt": "2026-10-11T12:00:00.000Z"
  },
  "message": "Purchase retrieved successfully",
  "success": true
}
```

---

### Plan Seeding & Idempotency
Initial plan records (Free: 50 MB, Basic: 300 MB, Premium: 500 MB, Pro: 900 MB) are seeded idempotently:
```bash
npm run seed:plans
# Or directly via Node:
node src/seeds/plan.seed.js
```
- **Idempotency Guarantee**: If run again, the seed script checks existing plan codes and **never overwrites** modified values. For instance, if an administrator or developer updates `basic.storageBytes = 367001600` (350 MB) in MongoDB, subsequent executions of `seed:plans` will keep the updated 350 MB value intact.

---

## Storage Provider Configuration (Local vs Bunny.net)

Storify features a decoupled storage provider abstraction (`StorageProvider`) supporting both local filesystem storage and Bunny.net Edge Storage.

### Provider Selection
The active storage provider is controlled via centralized environment configuration:
```env
# Choose active provider: 'local' (default) or 'bunny'
APP_STG_DRIVER=bunny

# Required when APP_STG_DRIVER=bunny
APP_STG_ZN=my-storage-zone
APP_STG_AK=my-storage-zone-password
APP_STG_REG=de
APP_STG_TIMEOUT=30000
```

### Regional Hostname Support
Bunny Storage regions are automatically mapped to their official endpoints:
- `de` / `falkenstein` / `default`: `storage.bunnycdn.com`
- `uk` / `london`: `uk.storage.bunnycdn.com`
- `ny` / `us-east`: `ny.storage.bunnycdn.com`
- `la` / `us-west`: `la.storage.bunnycdn.com`
- `sg` / `singapore`: `sg.storage.bunnycdn.com`
- `syd` / `sydney`: `syd.storage.bunnycdn.com`
- `se` / `stockholm`: `se.storage.bunnycdn.com`
- `br` / `saopaulo`: `br.storage.bunnycdn.com`
- `jh` / `johannesburg`: `jh.storage.bunnycdn.com`
- Custom hostnames or IP:port configurations are supported directly.

### Security & Private File Access
1. **Zero Credential Leakage**: Storage Zone passwords (`AccessKey`) are strictly used server-to-server and are never returned to client apps, logged, or exposed in error messages.
2. **Private File Delivery**: All file downloads are mediated through `GET /api/v1/storage/files/:fileId/access`. The backend authenticates the client JWT, validates file ownership, streams bytes directly from the Bunny Storage API, and pipes them to the client.
3. **No Direct Public URLs**: Files are kept private by default. No public CDN URLs bypass authenticated ownership checks.
4. **Zero Silent Fallback**: If `APP_STG_DRIVER=bunny` is selected in production but credentials are missing, the server throws an explicit configuration error and will not silently fall back to local disk storage.
5. **Testing Without Real Credentials**: Unit and integration tests run entirely against isolated mock HTTP servers. Real Bunny credentials are never required to execute `npm test`.

---

## Allowed File Formats & Limits
* **Maximum File Size**: 50 MB (`52,428,800` bytes)
* **Accepted Categories**:
  - Images: `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/svg+xml`
  - Documents: `application/pdf`, `application/msword`, `.docx`, `.xls`, `.xlsx`, `.ppt`, `.pptx`, `text/plain`, `text/csv`
  - Audio/Video: `audio/mpeg`, `audio/wav`, `audio/ogg`, `audio/mp4`, `video/mp4`, `video/webm`, `video/quicktime`
  - Archives: `application/zip`, `.rar`, `.7z`

---

## Error Response Format
All errors return a structured JSON response:
```json
{
  "success": false,
  "statusCode": 400,
  "message": "Storage quota exceeded. Insufficient space to complete this upload.",
  "errors": null
}
```
