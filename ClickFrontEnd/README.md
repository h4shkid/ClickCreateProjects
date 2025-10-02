# ClickCreate Frontend

A modern, responsive NFT analytics platform built with Next.js 14, TypeScript, and Tailwind CSS. Features a stunning dark theme with black and orange accent colors, glassmorphism effects, and mobile-first responsive design.

## Features

- 🎨 **Modern Dark UI** - Black/orange theme with glassmorphism effects
- 📱 **Mobile-First Responsive** - Optimized for all devices
- ⚡ **High Performance** - Next.js 14 with optimized components
- 🌊 **Smooth Animations** - Micro-interactions and transitions
- 🔍 **SEO Optimized** - Full metadata and semantic HTML
- ♿ **Accessible** - WCAG compliant with proper contrast ratios

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS v3
- **Font:** Inter (Google Fonts)
- **Icons:** Inline SVGs
- **Deployment:** Vercel-ready

## Getting Started

### Prerequisites

- Node.js 18.0 or higher
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
cd ClickFrontEnd
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
ClickFrontEnd/
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout with navigation
│   ├── page.tsx           # Home page
│   ├── globals.css        # Global styles and Tailwind
│   ├── snapshot/          # Snapshot page
│   ├── analytics/         # Analytics page
│   ├── gallery/           # Gallery page
│   └── monitor/           # Monitor page
├── components/
│   ├── layout/
│   │   ├── Navigation.tsx # Main navigation component
│   │   └── Footer.tsx     # Footer component
│   └── ui/
│       ├── HeroSection.tsx    # Hero with animations
│       ├── FeatureCard.tsx    # Feature cards
│       ├── StatsCard.tsx      # Statistics cards
│       └── CTASection.tsx     # Call-to-action section
├── public/                # Static assets
├── tailwind.config.ts     # Tailwind configuration
├── tsconfig.json          # TypeScript configuration
└── package.json           # Dependencies

```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

## Design System

### Colors

- **Background:** #0A0A0A (Rich Black)
- **Foreground:** #FAFAFA (White)
- **Primary:** #FF6B35 (Orange)
- **Accent:** #FFA500 (Amber)
- **Card:** #1A1A1A (Elevated Black)
- **Border:** #2A2A2A (Subtle Gray)

### Components

- **Glassmorphism Cards** - Backdrop blur with transparency
- **Gradient Text** - Orange to amber gradients
- **Animated Buttons** - Hover effects and transitions
- **Responsive Grid** - Mobile-first breakpoints

## Performance Optimizations

- Lazy loading for below-fold content
- Optimized animations (GPU-accelerated)
- Minimal glassmorphism usage (2-3 elements per view)
- Efficient Tailwind CSS with PurgeCSS
- Next.js Image optimization ready

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome)

## Contributing

Feel free to submit issues and enhancement requests!

## License

MIT License - feel free to use this in your projects!