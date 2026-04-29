# React + GSAP + Tailwind 4 + Firebase Boilerplate

A premium, SEO-optimized, and secure PWA boilerplate for building high-performance websites quickly.

## Features
- **React 19 & Vite 6**: The latest and fastest frontend framework.
- **Tailwind CSS 4**: Modern, CSS-first styling.
- **GSAP & @gsap/react**: Professional animations with safe React integration.
- **PWA Support**: Offline capabilities and manifest included.
- **SEO Optimized**: Reusable `Meta` component with OpenGraph and Twitter support.
- **Firebase Security**: Environment-variable-driven configuration (No hardcoded keys).
- **Backend Ready**: Firebase Cloud Functions structure included.

## Quick Start

### 1. Setup Environment
Rename `.env.example` to `.env` and add your Firebase credentials.
```bash
cp .env.example .env
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Deploy to Firebase
Ensure you have the Firebase CLI installed, then initialize your project:
```bash
firebase init
npm run build
firebase deploy
```

## Project Structure
- `src/components/common/Meta.tsx`: SEO management.
- `src/components/layout/Navbar.tsx` & `Layout.tsx`: Premium layout system.
- `src/components/sections/Hero.tsx`: High-impact GSAP animations.
- `src/firebase/config.ts`: Secure Firebase initialization.
- `functions/`: Cloud functions for backend logic.

## Developing with GSAP
This project uses the `@gsap/react` hook. Always use `useGSAP()` for animations to ensure proper cleanup and performance within the React component lifecycle.

```tsx
useGSAP(() => {
  gsap.from('.element', { opacity: 0 });
}, { scope: containerRef });
```

---
Built by Antigravity.
