#!/usr/bin/env python3
"""Test Ollama API endpoints"""

import requests
import json

OLLAMA_URL = "http://localhost:11434"
MODEL = "gpt-oss:120b-cloud"

def test_native_api():
    """Test Ollama native /api/generate endpoint"""
    print("Testing native Ollama API (/api/generate)...")
    
    response = requests.post(
        f"{OLLAMA_URL}/api/generate",
        json={
            "model": MODEL,
            "prompt": "Hello! Say hi in one sentence.",
            "stream": False
        }
    )
    
    print(f"Status: {response.status_code}")
    if response.ok:
        print(f"Response: {response.json()}")
    else:
        print(f"Error: {response.text}")
    print("-" * 60)

def test_openai_compatible():
    """Test OpenAI-compatible /v1/chat/completions endpoint"""
    print("Testing OpenAI-compatible API (/v1/chat/completions)...")
    
    # Test without Authorization header
    print("\n1. Without Authorization header:")
    response = requests.post(
        f"{OLLAMA_URL}/v1/chat/completions",
        json={
            "model": MODEL,
            "messages": [
                {"role": "user", "content": "Hello! Say hi in one sentence."}
            ],
            "stream": False
        }
    )
    print(f"Status: {response.status_code}")
    if response.ok:
        print(f"Response: {response.json()}")
    else:
        print(f"Error: {response.text}")
    
    # Test with Authorization header
    print("\n2. With Authorization: Bearer token:")
    response = requests.post(
        f"{OLLAMA_URL}/v1/chat/completions",
        headers={"Authorization": "Bearer ollama"},
        json={
            "model": MODEL,
            "messages": [
                {"role": "user", "content": "Hello! Say hi in one sentence."}
            ],
            "stream": False
        }
    )
    print(f"Status: {response.status_code}")
    if response.ok:
        print(f"Response: {response.json()}")
    else:
        print(f"Error: {response.text}")
    print("-" * 60)

def test_models_endpoint():
    """Test /v1/models endpoint"""
    print("Testing /v1/models endpoint...")
    
    response = requests.get(f"{OLLAMA_URL}/v1/models")
    
    print(f"Status: {response.status_code}")
    if response.ok:
        models = response.json()
        print(f"Available models: {json.dumps(models, indent=2)}")
    else:
        print(f"Error: {response.text}")
    print("-" * 60)

if __name__ == "__main__":
    print(f"Testing Ollama at {OLLAMA_URL} with model {MODEL}\n")
    print("=" * 60)
    
    test_models_endpoint()
    test_native_api()
    test_openai_compatible()
    
    print("\nDone!")
