#!/bin/sh

# Start Ollama server in the background
ollama serve &

# Wait for server to be ready
sleep 10

# Pull the chat/completion model
ollama pull gpt-oss:120b-cloud

# Pull the embedding model used by the RAG knowledge base (lib/ai/rag).
# nomic-embed-text produces 768-dimensional vectors and is ~270 MB on disk.
ollama pull nomic-embed-text

#ollama signin

# Keep the container running
wait
