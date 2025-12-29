#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== Puppy Store Local Kubernetes Setup ==="

# Check prerequisites
command -v kubectl >/dev/null 2>&1 || { echo "kubectl is required but not installed."; exit 1; }
command -v helm >/dev/null 2>&1 || { echo "helm is required but not installed."; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "docker is required but not installed."; exit 1; }

# Load environment variables
ENV_FILE="$ROOT_DIR/helm/.env.local"
if [ -f "$ENV_FILE" ]; then
    echo "Loading config from $ENV_FILE"
    set -a
    source "$ENV_FILE"
    set +a
else
    echo "Error: $ENV_FILE not found"
    exit 1
fi

# Verify Kubernetes is running
if ! kubectl cluster-info >/dev/null 2>&1; then
    echo "Kubernetes cluster is not running. Please start Docker Desktop Kubernetes."
    exit 1
fi

echo ""
echo "Building Docker images..."

# Build all service images (context is backend root, Dockerfile in each package)
cd "$ROOT_DIR/backend"

echo "  Building auth service..."
docker build -f packages/auth/Dockerfile -t puppy-store-auth:local .

echo "  Building puppies service..."
docker build -f packages/puppies/Dockerfile -t puppy-store-puppies:local .

echo "  Building chat service..."
docker build -f packages/chat/Dockerfile -t puppy-store-chat:local .

echo "  Building expert service..."
docker build -f packages/expert/Dockerfile -t puppy-store-expert:local .

cd "$ROOT_DIR"

echo ""
echo "Creating namespace..."
kubectl create namespace puppy-store --dry-run=client -o yaml | kubectl apply -f -

echo "Deploying Puppy Store services (includes PostgreSQL with pgvector)..."
helm upgrade --install puppy-store "$ROOT_DIR/helm/puppy-store" \
    --namespace puppy-store \
    -f "$ROOT_DIR/helm/puppy-store/values-local.yaml" \
    --set database.name="$DATABASE_NAME" \
    --set database.password="$DATABASE_PASSWORD" \
    --set database.port="$DATABASE_PORT" \
    --wait --timeout 5m

echo "Waiting for PostgreSQL to be ready..."
kubectl wait --for=condition=ready pod/puppy-store-postgresql-0 -n puppy-store --timeout=120s

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Starting port-forwarding..."

# Kill any existing port-forwards
pkill -f "kubectl port-forward.*puppy-store" 2>/dev/null || true

# Kill any processes using our ports
for port in 3001 3002 3003 3004; do
    pid=$(lsof -ti :$port 2>/dev/null)
    if [ -n "$pid" ]; then
        echo "  Killing process on port $port (PID: $pid)"
        kill -9 $pid 2>/dev/null || true
    fi
done
sleep 1

# Start port-forwarding in background (nohup to survive script exit)
nohup kubectl port-forward svc/puppy-store-auth 3001:80 -n puppy-store &>/dev/null &
nohup kubectl port-forward svc/puppy-store-puppies 3002:80 -n puppy-store &>/dev/null &
nohup kubectl port-forward svc/puppy-store-expert 3003:80 -n puppy-store &>/dev/null &
nohup kubectl port-forward svc/puppy-store-chat 3004:80 -n puppy-store &>/dev/null &

sleep 2

echo ""
echo "Services available at:"
echo "  - Auth:    http://localhost:3001"
echo "  - Puppies: http://localhost:3002"
echo "  - Expert:  http://localhost:3003"
echo "  - Chat:    ws://localhost:3004"
echo ""
echo "Test with: curl http://localhost:3002/puppies"
echo ""
echo "To stop port-forwarding: pkill -f 'kubectl port-forward.*puppy-store'"
echo ""
