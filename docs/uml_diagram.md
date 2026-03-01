# Civil War Sleuth — Image Ingestion Platform
## UML Class Diagram · v2 · Updated from Brainstorm · Masters Capstone

---

## Table of Contents
- [Presentation Layer — UI Pages](#presentation-layer--ui-pages)
- [Application Layer — Services](#application-layer--services)
- [Domain Model — Entities](#domain-model--entities)
- [Enumerations](#enumerations)
- [External Systems](#external-systems)
- [Relationships](#relationships)

---

## Presentation Layer — UI Pages

---

### `RegisterPage` ⭐ NEW
> «UI Page»

| Section | Member |
|---------|--------|
| **Methods** | `+ submitForm(data): void` |
| | `+ loginWithGoogle(): void` |
| | `+ requestContributor(): void` |

---

### `LoginPage` ⭐ NEW
> «UI Page»

| Section | Member |
|---------|--------|
| **Methods** | `+ loginNative(email, pwd): void` |
| | `+ loginWithGoogle(): void` |
| | `+ forgotPassword(): void` |

---

### `ProfilePage` ⭐ NEW
> «UI Page»

| Section | Member |
|---------|--------|
| **Methods** | `+ displayProfile(): void` |
| | `+ requestRoleChange(): void` |

---

### `AccountUpdatePage` ⭐ NEW
> «UI Page»

| Section | Member |
|---------|--------|
| **Methods** | `+ submitChangeRequest(data): void` |

---

### `ScrapeInputPage`
> «UI Page»

| Section | Member |
|---------|--------|
| **Methods** | `+ submitURL(url): void` |
| | `+ viewJobStatus(jobId): void` |

---

### `ImageReviewPage`
> «UI Page»

| Section | Member |
|---------|--------|
| **Methods** | `+ showAlbumView(): void` |
| | `+ showScrollView(): void` |
| | `+ editMetadata(photoId): void` |
| | `+ markDuplicate(photoId): void` |
| | `+ selectForRequest(ids): void` |

---

### `OnboardingRequestPage`
> «UI Page»

| Section | Member |
|---------|--------|
| **Methods** | `+ createRequest(photoIds): void` |
| | `+ submitRequest(): void` |
| | `+ viewStatus(): void` |

---

### `UserRequestTab` ⭐ NEW
> «UI Page»

| Section | Member |
|---------|--------|
| **Methods** | `+ viewRequest(): void` |
| | `+ viewSuggestions(): void` |
| | `+ applySuggestion(id): void` |
| | `+ addNoteToRevision(id, note): void` |
| | `+ viewReviewer(): void` |

---

### `AdminDashboardPage`
> «UI Page · Admin Only»

| Section | Member |
|---------|--------|
| **Methods** | `+ viewAllRequests(): void` |
| | `+ viewAssignedRequests(): void` |
| | `+ assignRequest(reqId, adminId): void` |
| | `+ approveRequest(id): void` |
| | `+ rejectRequest(id): void` |
| | `+ suggestEdits(reqId, data): void` |
| | `+ generateAdminLink(): void` |
| | `+ updateUserRole(userId, role): void` |

---

## Application Layer — Services

---

### `AuthService`
> «Service»

| Section | Member |
|---------|--------|
| **Methods** | `+ registerNative(data): User` |
| | `+ loginNative(email, pwd): JWT` |
| | `+ loginGoogle(token): JWT` |
| | `+ validateToken(token): User` |
| | `+ refreshToken(token): JWT` |
| | `+ forgotPassword(email): void` |
| | `+ generateAdminInviteLink(): String` |

---

### `AccountService` ⭐ NEW
> «Service»

| Section | Member |
|---------|--------|
| **Methods** | `+ getProfile(userId): User` |
| | `+ updateProfile(userId, data): User` |
| | `+ submitChangeRequest(data): ACR` |
| | `+ listChangeRequests(): ACR[]` |
| | `+ approveChangeRequest(id): void` |
| | `+ rejectChangeRequest(id): void` |

---

### `ScraperService`
> «Service»

| Section | Member |
|---------|--------|
| **Methods** | `+ createJob(url): ScrapedResult` |
| | `+ runJob(job): void` |
| | `+ extractPhotos(html): Photo[]` |
| | `+ downloadPhoto(url): Photo` |
| | `+ detectDuplicate(photo): Boolean` |

---

### `PhotosAPI`
> «Service»

| Section | Member |
|---------|--------|
| **Methods** | `+ getPhotos(jobId): Photo[]` |
| | `+ getPhoto(id): Photo` |
| | `+ updateMetadata(id, data): Photo` |
| | `+ markDuplicate(id): void` |
| | `+ updateStatus(id, status): void` |

---

### `OnboardingRequestsAPI`
> «Service»

| Section | Member |
|---------|--------|
| **Methods** | `+ createRequest(data): OBR` |
| | `+ listRequests(filter): OBR[]` |
| | `+ getRequest(id): OBR` |
| | `+ assignReviewer(reqId, adminId): void` |
| | `+ approveRequest(id, admin): void` |
| | `+ rejectRequest(id, admin, note): void` |
| | `+ addSuggestion(reqId, data): OBS` |

---

### `CWSBridgeService`
> «Service»

| Section | Member |
|---------|--------|
| **Methods** | `+ onboardBatch(request): String` |
| | `+ formatPayload(photo): Object` |
| | `+ sendToCWS(payload): Response` |

---

## Domain Model — Entities

---

### `User`

| Section | Member |
|---------|--------|
| **Attributes** | `id: UUID` |
| | `username: String` |
| | `email: String` |
| | `passwordHash: String` |
| | `firstName: String` |
| | `lastName: String` |
| | `accountType: UserRole` |
| | `googleId: String?` |
| | `age: Integer?` |
| | `gender: String?` |
| | `isActive: Boolean` |
| | `createdAt: DateTime` |
| | `updatedAt: DateTime` |
| **Methods** | `+ requestRoleChange(role): void` |

---

### `AccountChangeRequest` ⭐ NEW

| Section | Member |
|---------|--------|
| **Attributes** | `id: UUID` |
| | `userId: UUID` |
| | `currentAccount: UserRole` |
| | `requestingAccount: UserRole` |
| | `reasonMessage: String` |
| | `status: ACRStatus` |
| | `reviewedBy: UUID?` |
| | `createdAt: DateTime` |
| | `updatedAt: DateTime` |
| **Methods** | `+ approve(admin): void` |
| | `+ reject(admin): void` |

---

### `ScrapedResult`

| Section | Member |
|---------|--------|
| **Attributes** | `id: UUID` |
| | `url: String` |
| | `status: JobStatus` |
| | `submittedBy: UUID` |
| | `photoCount: Integer` |
| | `errorMessage: String?` |
| | `startedAt: DateTime?` |
| | `completedAt: DateTime?` |
| | `createdAt: DateTime` |
| **Methods** | `+ submit(): void` |
| | `+ updateStatus(s): void` |

---

### `Photo`

| Section | Member |
|---------|--------|
| **Attributes** | `id: UUID` |
| | `scrappedResultId: UUID` |
| | `name: String?` |
| | `regiment: String?` |
| | `age: String?` |
| | `photoNotes: String?` |
| | `photoFileId: String` |
| | `source: String` |
| | `tags: String[]` |
| | `isDuplicate: Boolean` |
| | `status: ImageStatus` |
| | `onboardingRequestId: UUID?` |
| | `createdAt: DateTime` |
| **Methods** | *(no methods)* |

---

### `OnboardingRequest`

| Section | Member |
|---------|--------|
| **Attributes** | `id: UUID` |
| | `onboardingRequestTitle: String` |
| | `onboardingRequestNotes: String?` |
| | `submittedBy: UUID` |
| | `status: RequestStatus` |
| | `hasReceivedSuggestions: Boolean` |
| | `reviewerId: UUID?` |
| | `reviewedAt: DateTime?` |
| | `onboardedAt: DateTime?` |
| | `cwsBatchId: String?` |
| | `createdAt: DateTime` |
| | `updatedAt: DateTime` |
| **Methods** | `+ submit(): void` |
| | `+ approve(admin): void` |
| | `+ reject(admin, note): void` |

---

### `OnboardingRequestSuggestion` ⭐ NEW

| Section | Member |
|---------|--------|
| **Attributes** | `id: UUID` |
| | `onboardingRequestId: UUID` |
| | `reviewerId: UUID` |
| | `onboardingRequestNote: String?` |
| | `createdAt: DateTime` |
| **Methods** | *(no methods)* |

---

### `SuggestedPhotoEdit` ⭐ NEW

| Section | Member |
|---------|--------|
| **Attributes** | `id: UUID` |
| | `suggestionId: UUID` |
| | `originalPhotoId: UUID` |
| | `suggestedName: String?` |
| | `suggestedRegiment: String?` |
| | `suggestedTags: String[]?` |
| | `suggestedNotes: String?` |
| | `appliedAt: DateTime?` |
| | `appliedBy: UUID?` |
| **Methods** | `+ apply(user): void` |

---

## Enumerations

---

### `UserRole`
> «enumeration»

```
admin
contributor
community_member
```

---

### `ACRStatus` ⭐ NEW
> «enumeration»

```
pending
approved
rejected
```

---

### `JobStatus`
> «enumeration»

```
queued
running
completed
failed
```

---

### `ImageStatus`
> «enumeration»

```
pending_review
reviewed
included_in_request
onboarded
rejected
```

---

### `RequestStatus`
> «enumeration»

```
pending
under_review
approved
rejected
onboarded
```

---

## External Systems

---

### `GoogleOAuth` ⭐ NEW
> «external»

| Section | Member |
|---------|--------|
| **Methods** | `+ authenticate(token): Profile` |
| | `+ getProfile(): UserInfo` |

---

### `TargetWebsite`
> «external»

| Section | Member |
|---------|--------|
| **Methods** | `+ scrape(url): HTML` |

---

### `ObjectStorage`
> «external»

| Section | Member |
|---------|--------|
| **Methods** | `+ upload(file): String` |
| | `+ download(path): File` |

---

### `CWSPlatformAPI`
> «external»

| Section | Member |
|---------|--------|
| **Methods** | `+ onboardImage(payload): String` |
| | `+ getBatchStatus(id): Status` |

---

## Relationships

### Associations (solid line `——▷`)

| From | Multiplicity | To | Multiplicity | Label |
|------|-------------|-----|-------------|-------|
| `User` | `1` | `ScrapedResult` | `0..*` | submits |
| `User` | `1` | `AccountChangeRequest` | `0..*` | requests |
| `User` | `1` | `OnboardingRequest` | `0..*` | submittedBy |
| `User` | `1` | `OnboardingRequest` | `0..*` | reviewerId |
| `User` | `1` | `OnboardingRequestSuggestion` | `0..*` | reviewer |
| `OnboardingRequest` | `0..*` | `Photo` | `1..*` | contains |

### Compositions (filled diamond `◆——▷`)

| Whole | Multiplicity | Part | Multiplicity |
|-------|-------------|------|-------------|
| `ScrapedResult` | `1` | `Photo` | `0..*` |
| `OnboardingRequest` | `1` | `OnboardingRequestSuggestion` | `0..*` |
| `OnboardingRequestSuggestion` | `1` | `SuggestedPhotoEdit` | `1..*` |

### Dependencies — Enum Usage (dashed line `- - ▷`)

| Class | Enum | Label |
|-------|------|-------|
| `User` | `UserRole` | «uses» |
| `AccountChangeRequest` | `UserRole` | «uses» |
| `AccountChangeRequest` | `ACRStatus` | «uses» |
| `ScrapedResult` | `JobStatus` | «uses» |
| `Photo` | `ImageStatus` | «uses» |
| `OnboardingRequest` | `RequestStatus` | «uses» |

### Dependencies — Service → Entity / External (dashed line `- - ▷`)

| Service | Target | Label |
|---------|--------|-------|
| `AuthService` | `User` | «manages» |
| `AuthService` | `GoogleOAuth` | «calls» |
| `AccountService` | `User` | «manages» |
| `AccountService` | `AccountChangeRequest` | «manages» |
| `ScraperService` | `ScrapedResult` | «creates» |
| `ScraperService` | `TargetWebsite` | «scrapes» |
| `ScraperService` | `ObjectStorage` | «uploads» |
| `PhotosAPI` | `Photo` | «manages» |
| `OnboardingRequestsAPI` | `OnboardingRequest` | «manages» |
| `OnboardingRequestsAPI` | `OnboardingRequestSuggestion` | «creates» |
| `CWSBridgeService` | `OnboardingRequest` | «reads» |
| `CWSBridgeService` | `CWSPlatformAPI` | «calls» |

### Dependencies — Page → Service (dashed line `- - ▷`)

| Page | Service | Label |
|------|---------|-------|
| `RegisterPage` | `AuthService` | «uses» |
| `RegisterPage` | `AccountService` | «uses» |
| `LoginPage` | `AuthService` | «uses» |
| `ProfilePage` | `AccountService` | «uses» |
| `AccountUpdatePage` | `AccountService` | «uses» |
| `ScrapeInputPage` | `ScraperService` | «uses» |
| `ImageReviewPage` | `PhotosAPI` | «uses» |
| `OnboardingRequestPage` | `OnboardingRequestsAPI` | «uses» |
| `UserRequestTab` | `OnboardingRequestsAPI` | «uses» |
| `AdminDashboardPage` | `OnboardingRequestsAPI` | «uses» |
| `AdminDashboardPage` | `AccountService` | «uses» |

---

## Legend

| Symbol | Meaning |
|--------|---------|
| `——▷` | Association |
| `◆——▷` | Composition (whole owns part) |
| `- - ▷` | Dependency / Usage |
| `1`, `0..*`, `1..*` | Multiplicity |
| ⭐ **NEW** | Added in v2 from brainstorming doc |

---

*Civil War Sleuth Image Ingestion Platform · Masters Capstone · UML Class Diagram v2*
