# ☁️ Cloud-Based File Storage & Management System
### 100% AWS Free Tier — Production-Ready

---

## 🏗️ Architecture Overview

| Layer | Service | Free Tier Limit |
|---|---|---|
| Frontend Hosting | AWS Amplify | 1000 build mins/mo, 15 GB served |
| Authentication | AWS Cognito | 50,000 MAU free |
| REST API | AWS API Gateway | 1M API calls/mo |
| Business Logic | AWS Lambda (Node.js) | 1M requests, 400K GB-sec/mo |
| File Storage | AWS S3 | 5 GB, 20K GET, 2K PUT/mo |
| Database (Metadata) | AWS DynamoDB | 25 GB, 25 WCU/RCU |
| CDN | AWS CloudFront | 1 TB data transfer/mo |
| Notifications | AWS SNS + SES | 1M SNS publishes, 62K SES emails |
| CI/CD | GitHub Actions | Free for public repos |
| Monitoring | AWS CloudWatch | 5 GB logs, 10 metrics free |

---

## 📁 Project Structure

```
cloud-file-storage/
├── frontend/                  # React + Next.js app
│   └── src/
│       ├── components/        # UI components
│       ├── pages/             # Next.js pages
│       ├── hooks/             # Custom React hooks
│       └── utils/             # API & S3 helpers
├── backend/                   # Lambda functions
│   └── src/
│       ├── handlers/          # Lambda function handlers
│       ├── middleware/         # Auth, validation middleware
│       ├── models/            # DynamoDB data models
│       └── utils/             # S3, Cognito helpers
├── infrastructure/            # AWS CDK / CloudFormation
│   └── template.yaml          # SAM template
└── docs/                      # API & architecture docs
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- AWS CLI configured (`aws configure`)
- AWS SAM CLI (`brew install aws-sam-cli`)
- GitHub account

### 1. Clone & Install
```bash
git clone https://github.com/YOUR_USERNAME/cloud-file-storage.git
cd cloud-file-storage

# Install backend deps
cd backend && npm install

# Install frontend deps
cd ../frontend && npm install
```

### 2. Deploy Backend (AWS SAM — Free Tier)
```bash
cd infrastructure
sam build
sam deploy --guided
# Follow prompts — creates all AWS resources automatically
```

### 3. Configure Frontend
```bash
cd frontend
cp .env.example .env.local
# Fill in values from SAM deploy output
```

### 4. Run Locally
```bash
# Backend
cd backend && sam local start-api

# Frontend
cd frontend && npm run dev
```

### 5. Deploy Frontend to Amplify
```bash
# Push to GitHub, then connect repo in AWS Amplify Console
# Amplify auto-detects Next.js and deploys
```

---

## 🔐 Environment Variables

### Backend (Lambda — set via SAM template)
```
S3_BUCKET_NAME=your-files-bucket
DYNAMODB_TABLE=FileMetadata
COGNITO_USER_POOL_ID=us-east-1_xxxxxx
COGNITO_CLIENT_ID=xxxxxxxxxx
SNS_TOPIC_ARN=arn:aws:sns:...
SES_FROM_EMAIL=noreply@yourdomain.com
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=https://xxxxxx.execute-api.us-east-1.amazonaws.com/prod
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_xxxxxx
NEXT_PUBLIC_COGNITO_CLIENT_ID=xxxxxxxxxx
NEXT_PUBLIC_CLOUDFRONT_URL=https://xxxxxxxxx.cloudfront.net
NEXT_PUBLIC_AWS_REGION=us-east-1
```

---

## 📋 Features

- ✅ Upload files (up to 5 GB via presigned URLs — bypasses Lambda limits)
- ✅ Download files via CloudFront CDN
- ✅ Folder / directory management
- ✅ File sharing with expiring links
- ✅ File search & filtering
- ✅ User authentication (sign up, login, MFA)
- ✅ Upload progress tracking
- ✅ File preview (images, PDFs, text)
- ✅ Email notifications on upload complete
- ✅ Soft delete + trash bin
- ✅ File versioning (S3 versioning enabled)

---

## 🔒 Security

- JWT tokens validated on every request via Cognito
- S3 bucket is private — files served only via signed CloudFront URLs
- Presigned S3 URLs expire in 15 minutes
- CORS configured per-domain
- DynamoDB access scoped per user (userId partition key)
