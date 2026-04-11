# URGENT: Performance Fix Action Plan

## ⚠️ PROBLEM: Performance Got WORSE

**Current State:**
- Mobile LCP: 34.9s (was 7.5s) - **5x worse!**
- Desktop LCP: 5.6s (was 2.0s) - **3x worse!**
- Performance score: 49-54 (no improvement)

## 🔧 WHAT I BROKE (Now Fixed)

I added overhead that hurt performance:
1. ❌ Complex font loading with `media="print"` - caused render blocking
2. ❌ Inline critical CSS - added weight
3. ❌ Service worker in head - blocked rendering
4. ❌ Webpack optimizations - may have caused issues

**FIXED:** Reverted `_document.tsx` and `next.config.mjs` to cleaner versions

---

## 🎯 ACTUAL PROBLEMS (From PageSpeed Report)

### 1. Images (17,741 KiB waste) - #1 Priority
**The Real Issue:**
- You're loading full-size images (~20MB total)
- No lazy loading (all images load immediately)
- No modern formats (WebP/AVIF)
- No responsive sizing

**Evidence:**
```
Improve image delivery Est savings of 17,741 KiB
```

### 2. JavaScript (416 KiB unused) - #2 Priority
**The Real Issue:**
- Large bundles blocking main thread
- Unused code not tree-shaken
- No code splitting

**Evidence:**
```
Reduce unused JavaScript Est savings of 416 KiB
Avoid enormous network payloads Total size was 20,293 KiB
```

### 3. Caching (15,187 KiB) - #3 Priority
**The Real Issue:**
- Static assets not cached properly
- No CDN optimization

---

## ✅ IMMEDIATE FIXES (Do These Now)

### Fix 1: Images - Replace ALL Image Tags (2 hours)

**Why this matters:** 17MB of image bloat = 85% of your performance problem

**Files to edit:**

Find all image usage:
```bash
grep -r "<img" src/ pages/ --include="*.tsx" -l
```

**Replace each `<img>` with this pattern:**

```tsx
// BEFORE (BAD - loads full size immediately)
<img 
  src="https://images.unsplash.com/photo-xxx" 
  alt="Dentist"
/>

// AFTER (GOOD - lazy loads, smaller size)
<img 
  src="https://images.unsplash.com/photo-xxx?w=800&q=80&fm=webp" 
  alt="Dentist"
  width={800}
  height={600}
  loading="lazy"
/>
```

**Key changes:**
- Add `?w=800&q=80&fm=webp` to Unsplash URLs (reduces size 70%)
- Add `width` and `height` (prevents layout shift)
- Add `loading="lazy"` (defers loading)

**Priority order:**
1. Hero images on homepage
2. Clinic listing images
3. Blog post images
4. All other images

---

### Fix 2: Homepage - Remove/Defer Heavy Content (1 hour)

**Check your homepage for:**
- Large hero images (use smaller mobile version)
- Heavy animations (remove or simplify)
- Third-party widgets (defer loading)

**Example mobile optimization:**
```tsx
// Add responsive image component
const HeroImage = () => {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
  }, []);
  
  return (
    <img 
      src={isMobile 
        ? "hero-mobile.jpg?w=600&q=80" 
        : "hero-desktop.jpg?w=1200&q=80"
      }
      width={isMobile ? 600 : 1200}
      height={isMobile ? 400 : 800}
      loading="eager" // Only hero loads immediately
    />
  );
};
```

---

### Fix 3: Defer Non-Critical JavaScript (30 min)

**In your `_app.tsx`:**

```tsx
import Script from 'next/script';

// Defer analytics and non-critical scripts
<Script
  src="https://analytics.com/script.js"
  strategy="lazyOnload" // Loads after page is interactive
/>
```

---

## 📊 EXPECTED IMPROVEMENTS

After implementing image fixes:

| Metric | Current | Expected | Improvement |
|--------|---------|----------|-------------|
| **Mobile LCP** | 34.9s | 4-6s | **-85%** |
| **Desktop LCP** | 5.6s | 1.5-2s | **-70%** |
| **Network Payload** | 20MB | 5-6MB | **-75%** |
| **Performance Score** | 49-54 | 70-80 | **+40%** |

---

## 🔍 HOW TO VERIFY

1. **Test one page at a time:**
   ```
   https://pagespeed.web.dev/
   ```

2. **Check what actually changed:**
   - Open DevTools → Network tab
   - Look for image sizes (should see ?w=800&fm=webp)
   - Check total page weight (should be < 5MB)

3. **Monitor LCP:**
   - Chrome DevTools → Performance → Record
   - Look for LCP marker
   - Should happen within first 2-3 seconds

---

## ⚠️ WHAT NOT TO DO

❌ Don't add more overhead (service workers, complex configs)
❌ Don't lazy load above-fold images (hurts LCP)
❌ Don't use `media="print"` font loading (causes delays)
❌ Don't inline large CSS (adds weight)

✅ DO: Fix the actual problems (images, unused JS)

---

## 🚀 QUICK WIN SCRIPT

If you want me to automatically fix images on specific pages, tell me:
1. Which page has the worst LCP?
2. What images are on that page?

I'll provide exact code to fix those images.

---

## Summary

**The infrastructure I built is good, but it's not being used.** 

The performance issues are:
1. **Images not optimized** (20MB payload) - Fix by adding query params
2. **No lazy loading** - Fix by adding `loading="lazy"`
3. **No responsive sizes** - Fix by adding width/height attributes

**No amount of webpack config will fix 20MB of unoptimized images.**

Focus on image optimization first - that's 85% of the problem.

---

**Ready to fix images? Tell me which page to start with.**
