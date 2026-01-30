#!/bin/bash

# Load environment variables
if [ -f .env ]; then
  set -a
  source .env
  set +a
else
  echo ".env file not found"
  exit 1
fi

DOCKER_USERNAME="krishnavamshi933"
WEB_IMAGE_NAME="calcom-web"
API_IMAGE_NAME="calcom-api"
SYNC_IMAGE_NAME="calcom-sync"
TAG="latest"

echo "Building Cal.com Web Image..."
docker build --platform linux/amd64 \
  --build-arg NEXT_PUBLIC_LICENSE_CONSENT="$NEXT_PUBLIC_LICENSE_CONSENT" \
  --build-arg NEXT_PUBLIC_WEBSITE_TERMS_URL="$NEXT_PUBLIC_WEBSITE_TERMS_URL" \
  --build-arg NEXT_PUBLIC_WEBSITE_PRIVACY_POLICY_URL="$NEXT_PUBLIC_WEBSITE_PRIVACY_POLICY_URL" \
  --build-arg CALCOM_TELEMETRY_DISABLED="$CALCOM_TELEMETRY_DISABLED" \
  --build-arg DATABASE_URL="$DATABASE_URL" \
  --build-arg NEXTAUTH_SECRET="$NEXTAUTH_SECRET" \
  --build-arg CALENDSO_ENCRYPTION_KEY="$CALENDSO_ENCRYPTION_KEY" \
  --build-arg NEXT_PUBLIC_API_V2_URL="$NEXT_PUBLIC_API_V2_URL" \
  --build-arg CSP_POLICY="$CSP_POLICY" \
  --build-arg NEXT_PUBLIC_SINGLE_ORG_SLUG="$NEXT_PUBLIC_SINGLE_ORG_SLUG" \
  --build-arg ORGANIZATIONS_ENABLED="$ORGANIZATIONS_ENABLED" \
  -t $DOCKER_USERNAME/$WEB_IMAGE_NAME:$TAG \
  -f Dockerfile.web .

echo "Building Cal.com API V2 Image..."
docker build --platform linux/amd64 \
  --build-arg DATABASE_URL="$DATABASE_URL" \
  --build-arg DATABASE_DIRECT_URL="$DATABASE_DIRECT_URL" \
  -t $DOCKER_USERNAME/$API_IMAGE_NAME:$TAG \
  -f Dockerfile.api .

echo "Building Cal.com Sync API Image..."
docker build --platform linux/amd64 \
  --build-arg DATABASE_URL="$DATABASE_URL" \
  --build-arg DATABASE_DIRECT_URL="$DATABASE_DIRECT_URL" \
  -t $DOCKER_USERNAME/$SYNC_IMAGE_NAME:$TAG \
  -f Dockerfile.sync .

echo "Pushing images to Docker Hub..."
docker push $DOCKER_USERNAME/$WEB_IMAGE_NAME:$TAG
docker push $DOCKER_USERNAME/$API_IMAGE_NAME:$TAG
docker push $DOCKER_USERNAME/$SYNC_IMAGE_NAME:$TAG

echo "Done! Images pushed to:"
echo "  - $DOCKER_USERNAME/$WEB_IMAGE_NAME:$TAG"
echo "  - $DOCKER_USERNAME/$API_IMAGE_NAME:$TAG"
echo "  - $DOCKER_USERNAME/$SYNC_IMAGE_NAME:$TAG"
