#!/bin/bash
set -e

echo "=== Seeding database ==="

# Port-forward PostgreSQL
echo "Setting up port-forward to PostgreSQL..."
kubectl port-forward svc/puppy-store-postgresql 5432:5432 -n puppy-store &
PF_PID=$!
sleep 3

# Run seed from backend directory
cd backend
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/puppystore?schema=public" npm run seed

# Cleanup
kill $PF_PID 2>/dev/null || true

echo "Database seeded!"
