#!/bin/bash
set -e

echo "=== Tearing down Puppy Store local deployment ==="

helm uninstall puppy-store -n puppy-store 2>/dev/null || true
helm uninstall puppy-store-postgresql -n puppy-store 2>/dev/null || true

echo "Deleting namespace..."
kubectl delete namespace puppy-store --ignore-not-found

echo "Done!"
