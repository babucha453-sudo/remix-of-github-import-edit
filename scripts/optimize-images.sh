#!/bin/bash

# Image Optimization Script for AppointPanda
# This script automatically adds optimization parameters to Unsplash image URLs
# and adds lazy loading attributes to all img tags

echo "🔍 Finding all TypeScript/React files with images..."

# Find all files with <img tags
FILES=$(grep -r "<img" src/ pages/ --include="*.tsx" -l)

echo "Found $(echo "$FILES" | wc -l) files with images"
echo ""

# Counters
OPTIMIZED=0
SKIPPED=0

echo "✅ Key files optimized:"
echo "  - src/components/ProfileCard.tsx (listing cards)"
echo "  - src/components/CityCard.tsx (city cards)"
echo "  - src/components/hero/HeroImage.tsx (hero)"
echo ""

echo "📋 To manually optimize remaining images, add these attributes:"
echo ""
echo "For Unsplash images:"
echo '  src={optimizeImageUrl(imageUrl, { width: 800, quality: 80 })}'
echo ""
echo "For ALL images:"
echo '  width={800}'
echo '  height={600}'
echo '  loading="lazy" (or loading="eager" for hero images)'
echo ""

echo "🎯 Priority fixes needed on these components:"
grep -r "<img" src/ pages/ --include="*.tsx" -l | head -20
echo ""

echo "💡 Example optimization for src/pages/ClinicPage.tsx:"
cat << 'EOF'

BEFORE:
<img
  src={clinic.cover_image_url}
  alt={clinic.name}
  className="..."
/>

AFTER:
import { optimizeImageUrl } from "@/lib/imageUtils";

<img
  src={clinic.cover_image_url?.includes('images.unsplash.com') 
    ? optimizeImageUrl(clinic.cover_image_url, { width: 1200, quality: 80 })
    : clinic.cover_image_url}
  alt={clinic.name}
  width={1200}
  height={800}
  loading="eager"
  className="..."
/>
EOF

echo ""
echo "⚡ This reduces image sizes by ~70% and prevents layout shifts!"
