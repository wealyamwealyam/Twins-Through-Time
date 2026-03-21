# Civil War Sleuth — Image Ingestion Platform
## API Reference

> **Base URL:** `https://api.civilwarsleuth.dev/v1`
> **Authentication:** All protected routes require a Bearer JWT in the `Authorization` header.
> **Roles:** `admin` · `contributor` · `community_member`

---

## Table of Contents

1. [Auth API](#1-auth-api)
2. [Account API](#2-account-api)
3. [Account Change Request API](#3-account-change-request-api)
4. [Scrape Jobs API](#4-scrape-jobs-api)
5. [Photos API](#5-photos-api)
6. [Onboarding Requests API](#6-onboarding-requests-api)
7. [Onboarding Request Suggestions API](#7-onboarding-request-suggestions-api)
8. [Admin API](#8-admin-api)
9. [CWS Bridge API](#9-cws-bridge-api)

---

## Legend

| Symbol | Meaning |
|--------|---------|
| 🔓 | Public — no authentication required |
| 🔒 | Authenticated — any valid role |
| 🟡 | Contributor or Admin only |
| 🔴 | Admin only |
| ⭐ | Key endpoint |

---

## 1. Auth API

Handles registration, login (native and Google OAuth), token management, and admin invite link generation.

---

### `POST /auth/register` 🔓 ⭐

Register a new native account.

**Request Body**
```json
{
  "username": "jsmith",
  "email": "jsmith@example.com",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Smith",
  "age": 34,
  "gender": "male",
  "requestContributor": false
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `username` | string | ✅ | Unique, 3–30 chars |
| `email` | string | ✅ | Must be unique |
| `password` | string | ✅ | Min 8 chars |
| `firstName` | string | ✅ | |
| `lastName` | string | ✅ | |
| `age` | integer | ❌ | Optional |
| `gender` | string | ❌ | Optional |
| `requestContributor` | boolean | ❌ | If true, creates a pending `AccountChangeRequest` for contributor role |

**Response `201 Created`**
```json
{
  "user": {
    "id": "uuid",
    "username": "jsmith",
    "email": "jsmith@example.com",
    "accountType": "community_member"
  },
  "token": "eyJhbGci..."
}
```

---

### `POST /auth/register/admin-invite` 🔓

Register a new account via an admin-generated invite link. Automatically assigns the `admin` role.

**Request Body**
```json
{
  "inviteToken": "abc123xyz",
  "username": "adminuser",
  "email": "admin@example.com",
  "password": "SecurePassword123!",
  "firstName": "Jane",
  "lastName": "Doe"
}
```

**Response `201 Created`**
```json
{
  "user": {
    "id": "uuid",
    "username": "adminuser",
    "accountType": "admin"
  },
  "token": "eyJhbGci..."
}
```

---

### `POST /auth/login` 🔓 ⭐

Log in with a native account.

**Request Body**
```json
{
  "email": "jsmith@example.com",
  "password": "SecurePassword123!"
}
```

**Response `200 OK`**
```json
{
  "token": "eyJhbGci...",
  "refreshToken": "dGhpcyBp...",
  "user": {
    "id": "uuid",
    "username": "jsmith",
    "accountType": "community_member"
  }
}
```

---

### `POST /auth/login/google` 🔓 ⭐

Authenticate via Google OAuth. Creates a new account if the email does not exist.

**Request Body**
```json
{
  "googleIdToken": "ya29.A0ARrdaM..."
}
```

**Response `200 OK`**
```json
{
  "token": "eyJhbGci...",
  "refreshToken": "dGhpcyBp...",
  "user": {
    "id": "uuid",
    "username": "jsmith",
    "accountType": "community_member",
    "isNewUser": true
  }
}
```

---

### `POST /auth/refresh` 🔓

Exchange a refresh token for a new access token.

**Request Body**
```json
{
  "refreshToken": "dGhpcyBp..."
}
```

**Response `200 OK`**
```json
{
  "token": "eyJhbGci..."
}
```

---

### `POST /auth/forgot-password` 🔓

Send a password reset email.

**Request Body**
```json
{
  "email": "jsmith@example.com"
}
```

**Response `200 OK`**
```json
{
  "message": "Password reset email sent if account exists."
}
```

---

### `POST /auth/reset-password` 🔓

Reset password using a token from the reset email.

**Request Body**
```json
{
  "resetToken": "abc123",
  "newPassword": "NewSecurePassword123!"
}
```

**Response `200 OK`**
```json
{
  "message": "Password successfully reset."
}
```

---

### `POST /auth/logout` 🔒

Invalidate the current refresh token.

**Response `204 No Content`**

---

## 2. Account API

Manage user profile data.

---

### `GET /account/profile` 🔒 ⭐

Get the currently authenticated user's profile.

**Response `200 OK`**
```json
{
  "id": "uuid",
  "username": "jsmith",
  "email": "jsmith@example.com",
  "firstName": "John",
  "lastName": "Smith",
  "accountType": "community_member",
  "age": 34,
  "gender": "male",
  "isActive": true,
  "createdAt": "2025-01-15T10:00:00Z"
}
```

---

### `PATCH /account/profile` 🔒

Update the authenticated user's profile. Password and role are excluded — use dedicated endpoints for those.

**Request Body**
```json
{
  "username": "johnsmith",
  "firstName": "John",
  "lastName": "Smith",
  "age": 35,
  "gender": "male"
}
```

**Response `200 OK`** — returns the updated user object.

---

### `GET /account/users/:id` 🔴

Get any user's profile by ID. Admin only.

**Response `200 OK`** — returns full user object.

---

### `PATCH /account/users/:id/role` 🔴

Directly update a user's role. Admin only.

**Request Body**
```json
{
  "accountType": "contributor"
}
```

**Response `200 OK`** — returns updated user object.

---

## 3. Account Change Request API

Handles requests by users to change their account type (e.g. community member requesting contributor status).

---

### `POST /account-change-requests` 🔒 ⭐

Submit a request to change account type.

**Request Body**
```json
{
  "requestingAccount": "contributor",
  "reasonMessage": "I have been researching Civil War photographs for 5 years and would like to contribute directly."
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `requestingAccount` | string | ✅ | `contributor` or `admin` |
| `reasonMessage` | string | ✅ | Max 1000 chars |

**Response `201 Created`**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "currentAccount": "community_member",
  "requestingAccount": "contributor",
  "reasonMessage": "I have been researching...",
  "status": "pending",
  "createdAt": "2025-03-01T12:00:00Z"
}
```

---

### `GET /account-change-requests` 🔴

List all account change requests. Admin only.

**Query Parameters**

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter by `pending`, `approved`, `rejected` |
| `page` | integer | Page number (default: 1) |
| `limit` | integer | Results per page (default: 20, max: 100) |

**Response `200 OK`**
```json
{
  "data": [ /* array of AccountChangeRequest objects */ ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

---

### `GET /account-change-requests/:id` 🔴

Get a single account change request by ID. Admin only.

**Response `200 OK`** — returns full `AccountChangeRequest` object.

---

### `PATCH /account-change-requests/:id` 🔴

Approve or reject an account change request. Admin only. On approval, the user's `accountType` is automatically updated.

**Request Body**
```json
{
  "status": "approved"
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `status` | string | ✅ | `approved` or `rejected` |

**Response `200 OK`** — returns updated `AccountChangeRequest` object.

---

### `GET /account-change-requests/me` 🔒

Get the authenticated user's own change requests.

**Response `200 OK`** — returns array of the user's own `AccountChangeRequest` objects.

---

## 4. Scrape Jobs API

Initiate and monitor scrape jobs against target websites.

---

### `POST /scrape-jobs` 🔒 ⭐

Submit a URL to scrape. Creates a new `ScrapedResult` and queues the job.

**Request Body**
```json
{
  "url": "https://www.loc.gov/collections/civil-war-photographs/",
  "maxPhotos": 100
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `url` | string | ✅ | Must be a valid URI |
| `maxPhotos` | integer | ❌ | Cap on images to retrieve (default: 50, max: 500) |

**Response `201 Created`**
```json
{
  "id": "uuid",
  "url": "https://www.loc.gov/collections/civil-war-photographs/",
  "status": "queued",
  "submittedBy": "uuid",
  "createdAt": "2025-03-01T12:00:00Z"
}
```

---

### `GET /scrape-jobs` 🔒

List all scrape jobs belonging to the authenticated user. Admins see all jobs.

**Query Parameters**

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter by `queued`, `running`, `completed`, `failed` |
| `page` | integer | Page number |
| `limit` | integer | Results per page |

**Response `200 OK`**
```json
{
  "data": [ /* array of ScrapedResult objects */ ],
  "total": 12,
  "page": 1,
  "limit": 20
}
```

---

### `GET /scrape-jobs/:id` 🔒 ⭐

Get status and details of a specific scrape job.

**Response `200 OK`**
```json
{
  "id": "uuid",
  "url": "https://www.loc.gov/...",
  "status": "completed",
  "photoCount": 47,
  "startedAt": "2025-03-01T12:01:00Z",
  "completedAt": "2025-03-01T12:03:22Z",
  "createdAt": "2025-03-01T12:00:00Z"
}
```

---

### `DELETE /scrape-jobs/:id` 🔒

Cancel a queued or running scrape job. Only the submitter or an admin may cancel.

**Response `204 No Content`**

---

## 5. Photos API

Retrieve, review, and update metadata for scraped photos.

---

### `GET /photos` 🔒 ⭐

List all photos. Users see only photos from their own scrape jobs. Admins see all.

**Query Parameters**

| Param | Type | Description |
|-------|------|-------------|
| `scrapeJobId` | uuid | Filter by parent scrape job |
| `status` | string | Filter by photo status |
| `isDuplicate` | boolean | Filter duplicates |
| `tags` | string | Comma-separated tag filter |
| `page` | integer | Page number |
| `limit` | integer | Results per page (default: 20, max: 100) |

**Response `200 OK`**
```json
{
  "data": [ /* array of Photo objects */ ],
  "total": 47,
  "page": 1,
  "limit": 20
}
```

---

### `GET /photos/:id` 🔒

Get a single photo and its full metadata.

**Response `200 OK`** — returns full `Photo` object per the photo JSON schema.

---

### `PATCH /photos/:id` 🔒 ⭐

Update the editable metadata fields of a photo. Automatically sets `isAutoExtracted` to `false` and records `metadataEditedBy` and `metadataEditedAt`.

**Request Body**
```json
{
  "name": "Sergeant William H. Carney",
  "regiment": "54th Massachusetts Infantry",
  "age": "23",
  "dateTaken": "1863-07",
  "location": "Fort Wagner, South Carolina",
  "photographer": "Unknown",
  "collection": "Selected Civil War Photographs",
  "photoNotes": "Portrait of Sgt. Carney in uniform.",
  "tags": ["union", "54th massachusetts", "medal of honor", "portrait"],
  "license": "Public Domain"
}
```

**Response `200 OK`** — returns updated `Photo` object.

---

### `PATCH /photos/:id/status` 🔒

Update the status of a photo (e.g. mark as `reviewed` or `rejected`).

**Request Body**
```json
{
  "status": "reviewed"
}
```

**Response `200 OK`** — returns updated `Photo` object.

---

### `PATCH /photos/:id/duplicate` 🔒

Flag or unflag a photo as a duplicate.

**Request Body**
```json
{
  "isDuplicate": true,
  "duplicateOfId": "uuid-of-existing-photo"
}
```

**Response `200 OK`** — returns updated `Photo` object.

---

### `GET /photos/:id/download` 🔒

Get a pre-signed download URL for the photo's image file from object storage.

**Response `200 OK`**
```json
{
  "url": "https://storage.example.com/scraped/2025/03/abc123.jpg?token=...",
  "expiresAt": "2025-03-01T13:00:00Z"
}
```

---

## 6. Onboarding Requests API

Bundle reviewed photos into a request for admin approval and eventual onboarding to the Civil War Sleuth platform.

---

### `POST /onboarding-requests` 🔒 ⭐

Create a new onboarding request from a selection of reviewed photos.

**Request Body**
```json
{
  "onboardingRequestTitle": "LOC Civil War Photographs — Batch 1",
  "onboardingRequestNotes": "All photos verified as public domain. Metadata reviewed.",
  "photoIds": [
    "uuid-photo-1",
    "uuid-photo-2",
    "uuid-photo-3"
  ]
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `onboardingRequestTitle` | string | ✅ | Max 255 chars |
| `onboardingRequestNotes` | string | ❌ | Max 2000 chars |
| `photoIds` | uuid[] | ✅ | Min 1 photo. Must belong to the submitting user and have status `reviewed`. |

**Response `201 Created`**
```json
{
  "id": "uuid",
  "onboardingRequestTitle": "LOC Civil War Photographs — Batch 1",
  "status": "pending",
  "submittedBy": "uuid",
  "photoCount": 3,
  "createdAt": "2025-03-01T14:00:00Z"
}
```

---

### `GET /onboarding-requests` 🔒 ⭐

List onboarding requests. Community members see only their own. Contributors and admins see all.

**Query Parameters**

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter by `pending`, `under_review`, `approved`, `rejected`, `onboarded` |
| `submittedBy` | uuid | Filter by submitter (admin only) |
| `reviewerId` | uuid | Filter by assigned reviewer (admin only) |
| `page` | integer | Page number |
| `limit` | integer | Results per page |

**Response `200 OK`**
```json
{
  "data": [ /* array of OnboardingRequest objects */ ],
  "total": 8,
  "page": 1,
  "limit": 20
}
```

---

### `GET /onboarding-requests/:id` 🔒 ⭐

Get a single onboarding request with its full photo list and suggestion history.

**Response `200 OK`**
```json
{
  "id": "uuid",
  "onboardingRequestTitle": "LOC Civil War Photographs — Batch 1",
  "onboardingRequestNotes": "All photos verified.",
  "submittedBy": "uuid",
  "status": "under_review",
  "hasReceivedSuggestions": true,
  "reviewerId": "uuid",
  "photos": [ /* array of Photo objects */ ],
  "suggestions": [ /* array of OnboardingRequestSuggestion objects */ ],
  "createdAt": "2025-03-01T14:00:00Z",
  "updatedAt": "2025-03-01T15:30:00Z"
}
```

---

### `PATCH /onboarding-requests/:id` 🔒

Update the title or notes of a pending request. Only the submitter may edit, and only while `status` is `pending`.

**Request Body**
```json
{
  "onboardingRequestTitle": "LOC Civil War Photographs — Batch 1 (Revised)",
  "onboardingRequestNotes": "Updated notes after review."
}
```

**Response `200 OK`** — returns updated `OnboardingRequest` object.

---

### `POST /onboarding-requests/:id/photos` 🔒

Add photos to a pending onboarding request.

**Request Body**
```json
{
  "photoIds": ["uuid-photo-4", "uuid-photo-5"]
}
```

**Response `200 OK`** — returns updated `OnboardingRequest` object.

---

### `DELETE /onboarding-requests/:id/photos/:photoId` 🔒

Remove a specific photo from a pending onboarding request.

**Response `204 No Content`**

---

### `DELETE /onboarding-requests/:id` 🔒

Delete a pending onboarding request and unlink all associated photos. Only the submitter or an admin may delete.

**Response `204 No Content`**

---

### `POST /onboarding-requests/:id/submit` 🔒 ⭐

Formally submit a pending request for admin review. Changes status from `pending` → `under_review`.

**Response `200 OK`**
```json
{
  "id": "uuid",
  "status": "under_review",
  "updatedAt": "2025-03-01T14:05:00Z"
}
```

---

### `POST /onboarding-requests/:id/approve` 🔴 ⭐

Approve an onboarding request. Triggers the CWS Bridge to onboard all photos. Admin only.

**Request Body**
```json
{
  "adminNote": "Approved. All metadata verified and photos are high quality."
}
```

**Response `200 OK`**
```json
{
  "id": "uuid",
  "status": "approved",
  "reviewedBy": "uuid",
  "reviewedAt": "2025-03-01T16:00:00Z",
  "adminNote": "Approved. All metadata verified and photos are high quality."
}
```

---

### `POST /onboarding-requests/:id/reject` 🔴

Reject an onboarding request with a note explaining why. Admin only.

**Request Body**
```json
{
  "adminNote": "Several photos are missing regiment data. Please review and resubmit."
}
```

**Response `200 OK`** — returns updated `OnboardingRequest` with `status: rejected`.

---

### `PATCH /onboarding-requests/:id/assign` 🔴

Assign an admin reviewer to an onboarding request. Admin only.

**Request Body**
```json
{
  "reviewerId": "uuid-of-admin-user"
}
```

**Response `200 OK`** — returns updated `OnboardingRequest` object.

---

## 7. Onboarding Request Suggestions API

Admins can suggest edits to individual photos within a request rather than outright rejecting it. Submitters can then apply or respond to those suggestions.

---

### `POST /onboarding-requests/:id/suggestions` 🔴 ⭐

Create a suggestion for an onboarding request. May include an overall note and/or specific photo-level edits. Admin only.

**Request Body**
```json
{
  "onboardingRequestNote": "A few photos need metadata corrections before this can be approved.",
  "photoEdits": [
    {
      "originalPhotoId": "uuid-photo-1",
      "suggestedName": "Unidentified Confederate soldier",
      "suggestedRegiment": "Unknown",
      "suggestedTags": ["confederate", "portrait", "soldier"],
      "suggestedNotes": "Based on uniform buttons this appears to be a Confederate soldier, not Union."
    },
    {
      "originalPhotoId": "uuid-photo-2",
      "suggestedRegiment": "9th Indiana Infantry",
      "suggestedNotes": "Regiment identifiable from insignia on cap."
    }
  ]
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `onboardingRequestNote` | string | ❌ | Overall note for the request |
| `photoEdits` | array | ❌ | List of suggested photo-level changes |
| `photoEdits[].originalPhotoId` | uuid | ✅ | Must belong to this request |

**Response `201 Created`**
```json
{
  "id": "uuid",
  "onboardingRequestId": "uuid",
  "reviewerId": "uuid",
  "onboardingRequestNote": "A few photos need metadata corrections...",
  "photoEdits": [ /* array of SuggestedPhotoEdit objects */ ],
  "createdAt": "2025-03-01T15:00:00Z"
}
```

---

### `GET /onboarding-requests/:id/suggestions` 🔒

List all suggestions for an onboarding request. Visible to the request submitter and admins.

**Response `200 OK`** — returns array of `OnboardingRequestSuggestion` objects with nested `photoEdits`.

---

### `GET /onboarding-requests/:id/suggestions/:suggestionId` 🔒

Get a single suggestion with its full photo edit list.

**Response `200 OK`** — returns full `OnboardingRequestSuggestion` object.

---

### `POST /onboarding-requests/:id/suggestions/:suggestionId/photo-edits/:editId/apply` 🔒 ⭐

Apply a specific suggested photo edit, updating the photo's metadata fields. Sets `appliedAt` and `appliedBy` on the edit.

**Response `200 OK`**
```json
{
  "photoId": "uuid-photo-1",
  "appliedEdit": {
    "id": "uuid-edit",
    "appliedAt": "2025-03-01T15:45:00Z",
    "appliedBy": "uuid-submitter"
  },
  "updatedPhoto": { /* updated Photo object */ }
}
```

---

### `POST /onboarding-requests/:id/suggestions/:suggestionId/photo-edits/:editId/note` 🔒

Add a note responding to a specific suggested photo edit without applying it.

**Request Body**
```json
{
  "note": "I disagree with this classification — the uniform buttons are consistent with Union issue."
}
```

**Response `200 OK`** — returns updated `SuggestedPhotoEdit` with the added note.

---

## 8. Admin API

Admin-specific utility endpoints.

---

### `POST /admin/invite-link` 🔴 ⭐

Generate a one-time invite link that grants the `admin` role upon registration.

**Request Body**
```json
{
  "expiresInHours": 48
}
```

**Response `201 Created`**
```json
{
  "inviteToken": "abc123xyz789",
  "inviteUrl": "https://app.civilwarsleuth.dev/register?invite=abc123xyz789",
  "expiresAt": "2025-03-03T12:00:00Z"
}
```

---

### `GET /admin/users` 🔴

List all users with filtering and pagination.

**Query Parameters**

| Param | Type | Description |
|-------|------|-------------|
| `accountType` | string | Filter by role |
| `isActive` | boolean | Filter active/inactive |
| `search` | string | Search by username or email |
| `page` | integer | Page number |
| `limit` | integer | Results per page |

**Response `200 OK`**
```json
{
  "data": [ /* array of User objects */ ],
  "total": 120,
  "page": 1,
  "limit": 20
}
```

---

### `PATCH /admin/users/:id/deactivate` 🔴

Deactivate a user account (soft delete). Revokes all active tokens.

**Response `200 OK`**
```json
{
  "id": "uuid",
  "isActive": false
}
```

---

### `GET /admin/dashboard/stats` 🔴

Get summary statistics for the admin dashboard.

**Response `200 OK`**
```json
{
  "totalUsers": 120,
  "totalScrapeJobs": 340,
  "totalPhotos": 8420,
  "pendingRequests": 14,
  "approvedRequests": 62,
  "onboardedPhotos": 3210
}
```

---

## 9. CWS Bridge API

Internal service that communicates with the external Civil War Sleuth platform API. These endpoints are called internally (by the approval flow) and are not directly exposed to frontend users.

---

### `POST /cws-bridge/onboard/:requestId` 🔴

Trigger onboarding of an approved request to the Civil War Sleuth platform. Called automatically on approval but can be manually re-triggered by an admin.

**Response `200 OK`**
```json
{
  "requestId": "uuid",
  "cwsBatchId": "cws-batch-78234",
  "status": "onboarded",
  "onboardedAt": "2025-03-01T16:05:00Z",
  "photosOnboarded": 12
}
```

---

### `GET /cws-bridge/batch/:cwsBatchId/status` 🔴

Check the status of an onboarding batch on the Civil War Sleuth platform.

**Response `200 OK`**
```json
{
  "cwsBatchId": "cws-batch-78234",
  "status": "completed",
  "photosAccepted": 12,
  "photosRejected": 0
}
```

---

## Error Responses

All endpoints return standard error shapes.

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "You do not have permission to perform this action.",
    "details": null
  }
}
```

| HTTP Status | Code | Description |
|-------------|------|-------------|
| `400` | `VALIDATION_ERROR` | Request body failed validation |
| `401` | `UNAUTHORIZED` | Missing or invalid JWT |
| `403` | `FORBIDDEN` | Valid JWT but insufficient role |
| `404` | `NOT_FOUND` | Resource does not exist |
| `409` | `CONFLICT` | Duplicate resource (e.g. email already registered) |
| `422` | `UNPROCESSABLE` | Business rule violation (e.g. adding a non-reviewed photo to a request) |
| `500` | `INTERNAL_ERROR` | Unexpected server error |

---

## Summary Table

| # | Method | Endpoint | Auth | Description |
|---|--------|----------|------|-------------|
| **Auth** |
| 1 | POST | `/auth/register` | 🔓 | Register native account |
| 2 | POST | `/auth/register/admin-invite` | 🔓 | Register via admin invite link |
| 3 | POST | `/auth/login` | 🔓 | Native login |
| 4 | POST | `/auth/login/google` | 🔓 | Google OAuth login |
| 5 | POST | `/auth/refresh` | 🔓 | Refresh access token |
| 6 | POST | `/auth/forgot-password` | 🔓 | Send password reset email |
| 7 | POST | `/auth/reset-password` | 🔓 | Reset password with token |
| 8 | POST | `/auth/logout` | 🔒 | Invalidate refresh token |
| **Account** |
| 9 | GET | `/account/profile` | 🔒 | Get own profile |
| 10 | PATCH | `/account/profile` | 🔒 | Update own profile |
| 11 | GET | `/account/users/:id` | 🔴 | Get any user profile |
| 12 | PATCH | `/account/users/:id/role` | 🔴 | Update user role directly |
| **Account Change Requests** |
| 13 | POST | `/account-change-requests` | 🔒 | Submit role change request |
| 14 | GET | `/account-change-requests` | 🔴 | List all change requests |
| 15 | GET | `/account-change-requests/:id` | 🔴 | Get single change request |
| 16 | PATCH | `/account-change-requests/:id` | 🔴 | Approve or reject request |
| 17 | GET | `/account-change-requests/me` | 🔒 | Get own change requests |
| **Scrape Jobs** |
| 18 | POST | `/scrape-jobs` | 🔒 | Submit URL to scrape |
| 19 | GET | `/scrape-jobs` | 🔒 | List scrape jobs |
| 20 | GET | `/scrape-jobs/:id` | 🔒 | Get scrape job status |
| 21 | DELETE | `/scrape-jobs/:id` | 🔒 | Cancel scrape job |
| **Photos** |
| 22 | GET | `/photos` | 🔒 | List photos |
| 23 | GET | `/photos/:id` | 🔒 | Get single photo |
| 24 | PATCH | `/photos/:id` | 🔒 | Update photo metadata |
| 25 | PATCH | `/photos/:id/status` | 🔒 | Update photo status |
| 26 | PATCH | `/photos/:id/duplicate` | 🔒 | Flag/unflag as duplicate |
| 27 | GET | `/photos/:id/download` | 🔒 | Get download URL |
| **Onboarding Requests** |
| 28 | POST | `/onboarding-requests` | 🔒 | Create onboarding request |
| 29 | GET | `/onboarding-requests` | 🔒 | List onboarding requests |
| 30 | GET | `/onboarding-requests/:id` | 🔒 | Get single request |
| 31 | PATCH | `/onboarding-requests/:id` | 🔒 | Update request title/notes |
| 32 | POST | `/onboarding-requests/:id/photos` | 🔒 | Add photos to request |
| 33 | DELETE | `/onboarding-requests/:id/photos/:photoId` | 🔒 | Remove photo from request |
| 34 | DELETE | `/onboarding-requests/:id` | 🔒 | Delete pending request |
| 35 | POST | `/onboarding-requests/:id/submit` | 🔒 | Submit request for review |
| 36 | POST | `/onboarding-requests/:id/approve` | 🔴 | Approve request |
| 37 | POST | `/onboarding-requests/:id/reject` | 🔴 | Reject request |
| 38 | PATCH | `/onboarding-requests/:id/assign` | 🔴 | Assign admin reviewer |
| **Suggestions** |
| 39 | POST | `/onboarding-requests/:id/suggestions` | 🔴 | Create suggestion with photo edits |
| 40 | GET | `/onboarding-requests/:id/suggestions` | 🔒 | List suggestions |
| 41 | GET | `/onboarding-requests/:id/suggestions/:sid` | 🔒 | Get single suggestion |
| 42 | POST | `…/suggestions/:sid/photo-edits/:eid/apply` | 🔒 | Apply a suggested edit |
| 43 | POST | `…/suggestions/:sid/photo-edits/:eid/note` | 🔒 | Add note to a suggested edit |
| **Admin** |
| 44 | POST | `/admin/invite-link` | 🔴 | Generate admin invite link |
| 45 | GET | `/admin/users` | 🔴 | List all users |
| 46 | PATCH | `/admin/users/:id/deactivate` | 🔴 | Deactivate user |
| 47 | GET | `/admin/dashboard/stats` | 🔴 | Get dashboard statistics |
| **CWS Bridge** |
| 48 | POST | `/cws-bridge/onboard/:requestId` | 🔴 | Trigger onboarding to CWS |
| 49 | GET | `/cws-bridge/batch/:cwsBatchId/status` | 🔴 | Check CWS batch status |

---

*Civil War Sleuth Image Ingestion Platform · API Reference · Masters Capstone*