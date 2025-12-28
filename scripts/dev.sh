#!/bin/bash
# Hot-reload development with Skaffold
# Watches for file changes and automatically rebuilds/redeploys to Kubernetes
#
# Usage:
#   ./scripts/dev.sh          # Normal dev mode
#   ./scripts/dev.sh --force  # Force rebuild without cache

set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Parse arguments
SKAFFOLD_ARGS=""
for arg in "$@"; do
    case $arg in
        --force|-f)
            SKAFFOLD_ARGS="--cache-artifacts=false"
            echo "🔄 Force rebuild enabled (no cache)"
            ;;
    esac
done

# Load environment variables from backend/.env
if [ -f backend/.env ]; then
    export $(grep -v '^#' backend/.env | xargs)
fi

echo "🚀 Starting Puppy Store Development Environment"
echo ""
echo "This will:"
echo "  - Watch for file changes in backend/"
echo "  - Automatically rebuild Docker images"
echo "  - Redeploy to Kubernetes"
echo "  - Port-forward all services"
echo ""

# Check if skaffold is installed
if ! command -v skaffold &> /dev/null; then
    echo "❌ Skaffold is not installed."
    echo ""
    echo "Install with:"
    echo "  brew install skaffold"
    echo ""
    exit 1
fi

# Check if database is running
if ! kubectl get pod puppy-store-postgresql-0 -n puppy-store &> /dev/null; then
    echo "⚠️  Database not found. Running initial setup first..."
    ./scripts/local-setup.sh
    echo ""
fi

# Create/update LangSmith secret if API key is set
if [ -n "$LANGCHAIN_API_KEY" ]; then
    kubectl create secret generic langsmith-secret \
        --from-literal=api-key="$LANGCHAIN_API_KEY" \
        -n puppy-store \
        --dry-run=client -o yaml | kubectl apply -f -
    echo "✅ LangSmith secret configured"
fi

# Kill any existing port-forwards
pkill -f "kubectl port-forward.*puppy-store" 2>/dev/null || true

echo "Starting Skaffold in dev mode..."
echo "Press Ctrl+C to stop"
echo ""

# Run skaffold dev with file sync
skaffold dev --port-forward --tail $SKAFFOLD_ARGS
