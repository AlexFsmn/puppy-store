#!/bin/bash

# Start llama-server with parallel processing support
# Two servers: Chat inference + Embeddings

# Load .env if exists
[ -f backend/.env ] && export $(grep -v '^#' backend/.env | xargs)

# Model selection - change this to switch models
# Options: qwen2.5-1.5b-instruct-q4_k_m.gguf, qwen2.5-3b-instruct-q4_k_m.gguf, qwen2.5-7b-instruct-q4_k_m.gguf
CHAT_MODEL="${1:-${LOCAL_LLM_MODEL:-$HOME/.llama-models/qwen2.5-3b-instruct-q4_k_m.gguf}}"
EMBEDDING_MODEL="${LOCAL_EMBEDDING_MODEL_PATH:-$HOME/.llama-models/nomic-embed-text-v1.5.Q4_K_M.gguf}"
HOST="127.0.0.1"
CHAT_PORT="11434"
EMBEDDING_PORT="8081"
PARALLEL_SLOTS=4
CONTEXT_SIZE=16384
GPU_LAYERS=99

echo "Starting llama.cpp servers..."
echo ""
echo "Chat Server ($(basename $CHAT_MODEL))"
echo "   Port: $CHAT_PORT"
echo "   Parallel slots: $PARALLEL_SLOTS"
echo "   Context size: $CONTEXT_SIZE"
echo ""
echo "Embedding Server ($(basename $EMBEDDING_MODEL))"
echo "   Port: $EMBEDDING_PORT"
echo "   Context size: 8192"
echo ""

# Kill existing servers if any
pkill -f "llama-server.*$CHAT_PORT" 2>/dev/null
pkill -f "llama-server.*$EMBEDDING_PORT" 2>/dev/null
sleep 1

# Start chat server (--jinja enables tool/function calling support)
llama-server \
  --model "$CHAT_MODEL" \
  --host "$HOST" \
  --port "$CHAT_PORT" \
  -np "$PARALLEL_SLOTS" \
  --ctx-size "$CONTEXT_SIZE" \
  --n-gpu-layers "$GPU_LAYERS" \
  --jinja \
  > /tmp/llama-chat-server.log 2>&1 &

CHAT_PID=$!
echo "Chat server started (PID: $CHAT_PID)"

# Start embedding server
llama-server \
  --model "$EMBEDDING_MODEL" \
  --host "$HOST" \
  --port "$EMBEDDING_PORT" \
  --embeddings \
  --ctx-size 8192 \
  --n-gpu-layers "$GPU_LAYERS" \
  --batch-size 2048 \
  --ubatch-size 2048 \
  > /tmp/llama-embedding-server.log 2>&1 &

EMBEDDING_PID=$!
echo "Embedding server started (PID: $EMBEDDING_PID)"
echo ""
echo "Logs:"
echo "   Chat: /tmp/llama-chat-server.log"
echo "   Embedding: /tmp/llama-embedding-server.log"
echo ""
echo "Stop: pkill llama-server"
echo "Test chat: curl http://localhost:$CHAT_PORT/v1/models"
echo "Test embed: curl http://localhost:$EMBEDDING_PORT/v1/models"
