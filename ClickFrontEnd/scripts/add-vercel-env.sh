#!/bin/bash

# Get Vercel token
VERCEL_TOKEN=$(vercel whoami 2>&1 | grep -o "token.*" | cut -d' ' -f2)

if [ -z "$VERCEL_TOKEN" ]; then
  echo "❌ Not logged in to Vercel CLI. Please run: vercel login"
  exit 1
fi

PROJECT_NAME="click-create-projects-dx9s"
TEAM="h4shkids-projects"

echo "🔑 Adding environment variables to Vercel..."

# Add DATABASE_TYPE
echo "📝 Adding DATABASE_TYPE=postgres"
vercel env add DATABASE_TYPE <<EOF
postgres
production
preview
development
EOF

# Add POSTGRES_URL
echo "📝 Adding POSTGRES_URL"
vercel env add POSTGRES_URL <<EOF
postgres://4a19748bd89c5611c016aaa027d3ac32d517833ab46e1c08f23b5f8a710b0a56:sk_-hLlPVbV73iiRW67YAwC1@db.prisma.io:5432/postgres?sslmode=require
production
preview
development
EOF

echo "✅ Environment variables added successfully!"
echo ""
echo "Next step: Redeploy on Vercel dashboard or run: vercel --prod"
