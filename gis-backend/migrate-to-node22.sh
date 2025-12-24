#!/bin/bash
# Bash script to migrate to Node.js 22.17
# This script helps rebuild native dependencies for Node.js 22.17

echo "========================================="
echo "Node.js 22.17 Migration Script"
echo "========================================="
echo ""

# Check current Node version
CURRENT_VERSION=$(node --version)
echo "Current Node.js version: $CURRENT_VERSION"
echo "Target Node.js version: v22.17.0"
echo ""

# Check if we're on the correct version
if ! echo "$CURRENT_VERSION" | grep -qE "^v22\.(1[7-9]|2[0-9]|[3-9][0-9])\.[0-9]+|^v2[3-9]\.[0-9]+\.[0-9]+"; then
    echo "Warning: You are not on Node.js 22.17 or higher."
    echo "Please switch to Node.js 22.17.0 using one of these methods:"
    echo ""
    echo "Using nvm (if installed):"
    echo "  nvm install 22.17.0"
    echo "  nvm use 22.17.0"
    echo ""
    echo "Or download from: https://nodejs.org/"
    echo ""
    read -p "Do you want to continue anyway? (y/n) " continue
    if [ "$continue" != "y" ] && [ "$continue" != "Y" ]; then
        echo "Migration cancelled."
        exit 1
    fi
fi

echo "Step 1: Removing old node_modules and package-lock.json..."
if [ -d "node_modules" ]; then
    rm -rf node_modules
    echo "  ✓ Removed node_modules"
fi
if [ -f "package-lock.json" ]; then
    rm -f package-lock.json
    echo "  ✓ Removed package-lock.json"
fi

echo ""
echo "Step 2: Installing dependencies for Node.js 22.17..."
npm install

if [ $? -eq 0 ]; then
    echo ""
    echo "========================================="
    echo "Migration completed successfully!"
    echo "========================================="
    echo ""
    echo "You can now start the development server with:"
    echo "  npm run dev"
    echo ""
else
    echo ""
    echo "========================================="
    echo "Migration failed!"
    echo "========================================="
    echo ""
    echo "Please check the error messages above and ensure:"
    echo "  1. You are using Node.js 22.17.0 or higher"
    echo "  2. You have npm 10.0.0 or higher"
    echo "  3. Your system has build tools for native modules"
    echo ""
    exit 1
fi

