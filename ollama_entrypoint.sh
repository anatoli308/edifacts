#!/bin/sh

# Start Ollama server in the background
ollama serve &

# Wait for server to be ready
sleep 10

# Pull the specified model
ollama pull gpt-oss:120b-cloud

#ollama signin

# Keep the container running
wait
