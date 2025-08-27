#!/bin/bash

# Load environment variables from .env file
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
    echo "✅ Loaded configuration from .env"
else
    echo "❌ .env file not found. Please create one with your Unity LiteLLM settings."
    echo "💡 Example .env content:"
    echo "ANTHROPIC_BASE_URL=https://uai-litellm.internal.unity.com"
    echo "ANTHROPIC_AUTH_TOKEN=your-token-here"
    echo "ANTHROPIC_MODEL=anthropic.claude-sonnet-4-20250514-v1:0"
    exit 1
fi

# Optional: Set up project-specific settings
export CLAUDE_PROJECT_DIR="$(pwd)"

# Launch Claude Code with custom settings
echo "🚀 Starting Claude Code with Unity LiteLLM proxy..."
echo "📍 Working directory: $CLAUDE_PROJECT_DIR"
echo "🌐 API Base URL: $ANTHROPIC_BASE_URL"
echo "🤖 Model: $ANTHROPIC_MODEL"
echo ""

# Check if claude command is available
if ! command -v claude &> /dev/null; then
    echo "❌ Claude command not found. Please install Claude Code first."
    echo "💡 Try: npm install -g @anthropic/claude-code"
    exit 1
fi

# Start Claude Code
claude "$@"
