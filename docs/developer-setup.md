# Developer Setup Guide

## Prerequisites

Install these tools before starting:

```bash
# Node.js 18+ (use nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18 && nvm use 18

# AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip && sudo ./aws/install

# AWS SAM CLI
pip install aws-sam-cli

# Git
sudo apt-get install git  # Linux
brew install git          # Mac
```

---

## Step 1 — AWS Account Setup (Free Tier)

1. Create AWS account at https://aws.amazon.com/free
2. Go to IAM → Create user → `cloud-file-storage-deploy`
3. Attach policy: `AdministratorAccess` (for initial setup)
4. Create access key → save `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`

```bash
aws configure
# AWS Access Key ID: <your key>
# AWS Secret Access Key: <your secret>
# Default region: us-east-1
# Default output format: json
```

---

## Step 2 — SES Email Verification (Required for Notifications)

SES is in sandbox mode by default — you must verify the sender email:

```bash
aws ses verify-email-identity --email-address noreply@yourdomain.com
# Check your inbox and click the verification link
```

---

## Step 3 — Generate CloudFront Key Pair (for signed URLs)

```bash
# Generate RSA key pair
openssl genrsa -out cloudfront-private.pem 2048
openssl rsa -pubout -in cloudfront-private.pem -out cloudfront-public.pem

# Base64 encode the private key (for Lambda env var)
base64 -w 0 cloudfront-private.pem > cloudfront-private.b64

# Copy the public key content into infrastructure/template.yaml
# under CloudFrontPublicKey → EncodedKey
cat cloudfront-public.pem
```

---

## Step 4 — Deploy Backend

```bash
cd infrastructure

# Build (packages Lambda functions)
sam build

# Deploy interactively (first time)
sam deploy --guided
# Stack name: cloud-file-storage
# Region: us-east-1
# Confirm changeset: Y
# Allow IAM role creation: Y
# SESFromEmail: noreply@yourdomain.com

# Save outputs — you'll need these for frontend config:
# ApiUrl, CloudFrontUrl, UserPoolId, UserPoolClientId, S3BucketName
```

---

## Step 5 — Add CloudFront Key to Lambda

After deploy, add the CloudFront signing key to Lambda environment:

```bash
# Get the CloudFront Key Group ID from AWS Console
# Then add to each Lambda function that generates download URLs:

aws lambda update-function-configuration \
  --function-name cloud-file-storage-get-file \
  --environment "Variables={
    CLOUDFRONT_KEY_PAIR_ID=K1234EXAMPLE,
    CLOUDFRONT_PRIVATE_KEY=$(cat cloudfront-private.b64)
  }"
```

---

## Step 6 — Configure Frontend

```bash
cd frontend
cp .env.example .env.local

# Fill in values from SAM deploy output:
nano .env.local
```

```env
NEXT_PUBLIC_API_URL=https://xxxxxxxxxx.execute-api.us-east-1.amazonaws.com/prod
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
NEXT_PUBLIC_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_CLOUDFRONT_URL=https://xxxxxxxxxxxxxxxxxx.cloudfront.net
NEXT_PUBLIC_AWS_REGION=us-east-1
```

---

## Step 7 — Run Locally

```bash
# Terminal 1: Start backend (SAM Local API)
cd infrastructure
sam local start-api --port 3001 --warm-containers EAGER

# Terminal 2: Start frontend
cd frontend
npm run dev
# Open http://localhost:3000
```

---

## Step 8 — Deploy Frontend to AWS Amplify

1. Push your code to GitHub
2. Open [AWS Amplify Console](https://console.aws.amazon.com/amplify)
3. Click **New app → Host web app**
4. Connect GitHub repo → select `main` branch
5. In **Build settings**, add environment variables from `.env.local`
6. Click **Save and deploy**

Amplify auto-detects Next.js and deploys on every push to `main`. **Free Tier includes 1000 build minutes/month and 15 GB bandwidth.**

---

## Step 9 — GitHub Actions Secrets

Add these secrets in GitHub → Settings → Secrets:

| Secret | Value |
|--------|-------|
| `AWS_ACCESS_KEY_ID` | Your IAM access key |
| `AWS_SECRET_ACCESS_KEY` | Your IAM secret key |
| `SES_FROM_EMAIL` | Your verified SES email |
| `COGNITO_USER_POOL_ID` | From SAM output |
| `COGNITO_CLIENT_ID` | From SAM output |

---

## Local Testing with SAM

```bash
# Test individual Lambda functions
sam local invoke GetUploadUrlFunction \
  --event events/upload-url.json

# Generate test events
sam local generate-event apigateway aws-proxy > events/api-event.json
sam local generate-event s3 put > events/s3-event.json
```

Create `backend/events/upload-url.json`:
```json
{
  "httpMethod": "POST",
  "path": "/files/upload-url",
  "headers": {
    "Authorization": "Bearer YOUR_COGNITO_JWT_TOKEN"
  },
  "body": "{\"fileName\":\"test.pdf\",\"fileSize\":1024,\"mimeType\":\"application/pdf\"}"
}
```

---

## Troubleshooting

**SAM deploy fails:**
```bash
# Check CloudFormation events for error details
aws cloudformation describe-stack-events \
  --stack-name cloud-file-storage \
  --query 'StackEvents[?ResourceStatus==`CREATE_FAILED`]'
```

**CORS errors in browser:**
Check API Gateway CORS settings and ensure Lambda returns `Access-Control-Allow-Origin: *` header.

**Upload fails silently:**
Check S3 bucket CORS configuration and ensure presigned URL hasn't expired (15 min limit).

**Cognito login fails:**
Verify `NEXT_PUBLIC_COGNITO_USER_POOL_ID` and `NEXT_PUBLIC_COGNITO_CLIENT_ID` match exactly.
