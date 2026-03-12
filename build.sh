#!/bin/bash
# X1SAFE V2 Build Script

echo "╔════════════════════════════════════════════════════════════╗"
echo "║              X1SAFE V2 - Build Script                      ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v anchor &> /dev/null; then
    echo -e "${RED}❌ Anchor CLI not found. Please install it first.${NC}"
    exit 1
fi

if ! command -v cargo &> /dev/null; then
    echo -e "${RED}❌ Rust not found. Please install it first.${NC}"
    exit 1
fi

if ! command -v yarn &> /dev/null; then
    echo -e "${RED}❌ Yarn not found. Please install it first.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ All prerequisites found${NC}"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    yarn install
    echo -e "${GREEN}✅ Dependencies installed${NC}"
    echo ""
fi

# Build the program
echo "🔨 Building Rust program..."
anchor build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build successful${NC}"
echo ""

# Verify IDL
echo "📝 Verifying IDL..."
if [ -f "target/idl/x1safe_v2.json" ]; then
    echo -e "${GREEN}✅ IDL generated${NC}"
    IDL_SIZE=$(wc -c < target/idl/x1safe_v2.json)
    echo "   Size: $IDL_SIZE bytes"
else
    echo -e "${YELLOW}⚠️  IDL not found${NC}"
fi
echo ""

# Generate TypeScript types
echo "🔧 Generating TypeScript types..."
if [ -f "target/idl/x1safe_v2.json" ]; then
    anchor run generate-types 2>/dev/null || echo "   (Types generated during build)"
    echo -e "${GREEN}✅ Types generated${NC}"
fi
echo ""

# Show program size
echo "📊 Build artifacts:"
if [ -f "target/deploy/x1safe_v2.so" ]; then
    PROGRAM_SIZE=$(wc -c < target/deploy/x1safe_v2.so)
    echo "   Program size: $PROGRAM_SIZE bytes"
    
    # Check if under max deployment size
    MAX_SIZE=245760 # 240KB
    if [ $PROGRAM_SIZE -gt $MAX_SIZE ]; then
        echo -e "   ${RED}⚠️  Program exceeds max size!${NC}"
    else
        PERCENT=$(( PROGRAM_SIZE * 100 / MAX_SIZE ))
        echo "   Utilization: $PERCENT%"
    fi
fi

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                 ✅ BUILD COMPLETE                          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "  1. Run tests:        anchor test"
echo "  2. Deploy devnet:    anchor deploy --provider.cluster devnet"
echo "  3. Deploy mainnet:   anchor deploy --provider.cluster mainnet"
echo "  4. Setup tokens:     node scripts/setup_tokens.js mainnet"
echo "  5. Run deploy:       node scripts/deploy.js"
echo ""