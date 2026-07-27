#!/bin/bash
# Build script for Render.com

# Exit on any error
set -e

echo "Starting build process..."

# Install Python dependencies
echo "Installing Python dependencies..."
pip install --no-cache-dir -r requirements.txt

# Check if we need to create uploads directory (for backward compatibility)
if [ ! -d "uploads" ]; then
    echo "Creating uploads directory..."
    mkdir -p uploads
fi

echo "Build completed successfully!"