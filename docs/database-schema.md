# DynamoDB Schema — FileMetadata Table

## Table Design

**Table Name:** `cloud-file-storage-FileMetadata`
**Billing:** Provisioned (5 WCU / 5 RCU — within free tier forever)

---

## Primary Key

| Key | Type | Description |
|-----|------|-------------|
| `userId` (PK) | String | Cognito user sub — scopes all data per user |
| `fileId` (SK) | String | UUID for files, `folder_UUID` for folders |

---

## Global Secondary Indexes

### FolderIndex
Used for listing files in a folder (the main list view).

| Key | Type |
|-----|------|
| `userId` (PK) | String |
| `parentFolder` (SK) | String |

### CreatedAtIndex
Used for sorting by date.

| Key | Type |
|-----|------|
| `userId` (PK) | String |
| `createdAt` (SK) | String (ISO 8601) |

---

## Item Schema

### File record
```json
{
  "userId":        "cognito-sub-uuid",
  "fileId":        "550e8400-e29b-41d4-a716-446655440000",
  "fileName":      "quarterly-report.pdf",
  "originalName":  "quarterly-report.pdf",
  "s3Key":         "userId/root/fileId.pdf",
  "contentType":   "application/pdf",
  "fileSize":      1048576,
  "etag":          "d41d8cd98f00b204e9800998ecf8427e",
  "parentFolder":  "root",
  "description":   "Q3 2024 report",
  "tags":          ["finance", "quarterly"],
  "status":        "uploaded",
  "isDeleted":     false,
  "isShared":      false,
  "shareId":       null,
  "shareUrl":      null,
  "shareExpiresAt": null,
  "createdAt":     "2024-01-15T10:30:00.000Z",
  "updatedAt":     "2024-01-15T10:31:00.000Z",
  "uploadedAt":    "2024-01-15T10:31:00.000Z",
  "lastAccessedAt": "2024-01-15T12:00:00.000Z",
  "deletedAt":     null,
  "createdBy":     "user@example.com"
}
```

### Folder record
```json
{
  "userId":       "cognito-sub-uuid",
  "fileId":       "folder_550e8400-e29b-41d4-a716-446655440001",
  "fileName":     "Finance",
  "folderName":   "Finance",
  "type":         "folder",
  "parentFolder": "root",
  "isDeleted":    false,
  "createdAt":    "2024-01-10T09:00:00.000Z",
  "updatedAt":    "2024-01-10T09:00:00.000Z",
  "createdBy":    "user@example.com"
}
```

---

## Access Patterns

| Operation | Index Used | Query |
|-----------|------------|-------|
| List files in folder | FolderIndex | PK=userId, SK=parentFolder |
| Get single file | Primary | PK=userId, SK=fileId |
| List all folders | Primary (filter type=folder) | PK=userId |
| List recent files | CreatedAtIndex | PK=userId, SK begins_with date |
| Search by name | FolderIndex + FilterExpression | contains(fileName, keyword) |
| Trash bin | Primary (filter isDeleted=true) | PK=userId |

---

## Free Tier Limits

- **25 GB** storage — stores ~25 million file metadata records
- **25 WCU / 25 RCU** — handles ~25 writes/sec and ~25 reads/sec sustained
- **Point-in-time recovery** enabled (restores to any point in last 35 days)
- **Encryption at rest** enabled (SSE with AWS managed key — free)
