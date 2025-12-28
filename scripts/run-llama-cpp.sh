#!/bin/bash

# Start llama-server for local LLM inference
# Configure model via LOCAL_LLM_MODEL env var or pass as argument

# Load .env if exists
[ -f backend/.env ] && export $(grep -v '^#' backend/.env | xargs)

MODEL="${1:-${LOCAL_LLM_MODEL:-$HOME/.llama-models/qwen2.5-8b-instruct-q4_k_m.gguf}}"
HOST="127.0.0.1"
PORT="11434"
PARALLEL_SLOTS=4
CONTEXT_SIZE=16384
GPU_LAYERS=99

echo "Starting llama.cpp server..."
echo ""
echo "Model: $(basename $MODEL)"
echo "Port: $PORT"
echo "Parallel slots: $PARALLEL_SLOTS"
echo "Context size: $CONTEXT_SIZE"
echo ""

# Kill existing server if any
pkill -f "llama-server.*$PORT" 2>/dev/null
sleep 1

# Start server (--jinja enables tool/function calling support)
llama-server \
  --model "$MODEL" \
  --host "$HOST" \
  --port "$PORT" \
  -np "$PARALLEL_SLOTS" \
  --ctx-size "$CONTEXT_SIZE" \
  --n-gpu-layers "$GPU_LAYERS" \
  --jinja \
  > /tmp/llama-server.log 2>&1 &

PID=$!
echo "Server started (PID: $PID)"
echo ""
echo "Log: /tmp/llama-server.log"
echo "Stop: pkill llama-server"
echo "Test: curl http://localhost:$PORT/v1/models"
