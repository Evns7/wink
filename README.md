# 🎯 Wink - Smart Social Planning

> Born from the spirit of Movember and its message about men's mental health and the silent epidemic of loneliness.

Wink is an AI-powered social planning app that helps you effortlessly discover when friends are free, find activities you can enjoy together, and turn good intentions into real moments. It's a small push—a wink—that helps people connect more often and with less friction.

![Wink Banner](https://img.shields.io/badge/Status-Active-success) ![Built with Lovable](https://img.shields.io/badge/Built%20with-Lovable-blueviolet) ![License](https://img.shields.io/badge/License-MIT-blue)

## ✨ Features

### 🤖 AI-Powered Activity Recommendations
- Smart activity suggestions based on your calendar, preferences, and location
- Personalized scoring system considering time fit, weather, budget, and proximity
- Insider tips and AI-powered reasoning for each suggestion

### 📅 Intelligent Calendar Integration
- Google Calendar sync to find mutual free time
- Automatic detection of when you and your friends are both available
- Respects sleep schedules and personal availability preferences

### 👥 Seamless Friend Coordination
- Select multiple friends to make group plans
- Send activity invitations directly through the app
- Real-time notifications for plan responses

### 🌤️ Context-Aware Suggestions
- Weather-aware recommendations
- Time-of-day appropriate activities
- Distance and budget-conscious suggestions

### 🎨 Beautiful, Modern UI
- Swipeable activity cards with intuitive controls
- Responsive design for mobile and desktop
- Real-time timezone display
- Smooth animations and transitions

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ or Bun
- Google Calendar API credentials (optional, for calendar sync)

### Installation

1. Clone the repository:
```bash
git clone <YOUR_GIT_URL>
cd wink
```

2. Install dependencies:
```bash
npm install
# or
bun install
```

3. Set up environment variables:
```bash
# The .env file is auto-configured by Lovable Cloud
# No manual setup needed for Supabase credentials
```

4. Start the development server:
```bash
npm run dev
# or
bun dev
```

5. Open [http://localhost:5173](http://localhost:5173) in your browser

## 🏗️ Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Framer Motion** - Animations
- **GSAP** - Advanced animations
- **Shadcn/ui** - UI components
- **React Router** - Navigation

### Backend (Lovable Cloud)
- **Supabase** - Database, authentication, and real-time subscriptions
- **Edge Functions** - Serverless API endpoints
- **PostgreSQL** - Relational database with PostGIS
- **Row Level Security (RLS)** - Data security

### External Integrations
- **Google Calendar API** - Calendar synchronization
- **OpenStreetMap** - Activity location data
- **Timezone APIs** - Automatic timezone detection

## 📂 Project Structure

```
wink/
├── src/
│   ├── components/       # Reusable UI components
│   │   ├── ui/          # Shadcn UI components
│   │   └── ...          # Custom components
│   ├── pages/           # Page components
│   ├── services/        # API and service integrations
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utility functions
│   └── integrations/    # Third-party integrations
├── supabase/
│   ├── functions/       # Edge functions
│   └── migrations/      # Database migrations
├── docs/                # Documentation
└── public/              # Static assets
```

## 🔧 Key Features Implementation

### Activity Recommendation System
The app uses a sophisticated scoring algorithm that considers:
- **Preference Match (30%)** - Based on your activity history
- **Time Fit (20%)** - How well the activity fits your schedule
- **Weather (15%)** - Current weather conditions
- **Budget (15%)** - Price level vs your budget preferences
- **Proximity (10%)** - Distance from your location
- **Duration (10%)** - Activity length vs available time

### Calendar Analysis
The `analyze-group-availability` edge function:
1. Fetches calendar events for all participants
2. Identifies mutual free time blocks
3. Filters out past time slots
4. Respects wake/sleep schedules
5. Returns only future availability

### Real-time Notifications
- Live updates when friends respond to invitations
- Notification badges in the header
- Supabase real-time subscriptions for instant updates

## 📊 Database Schema

Key tables:
- `profiles` - User profiles with preferences
- `friendships` - Friend connections
- `calendar_events` - Synced calendar data
- `activities` - Activity database with location data
- `activity_invitations` - Plan invitations
- `notifications` - User notifications
- `preferences` - Activity category preferences

## 🔐 Security

- Row Level Security (RLS) enabled on all tables
- JWT-based authentication
- Service role keys secured in environment variables
- API keys managed through Lovable Cloud secrets

## 🎨 Design System

The app uses a semantic color system defined in `src/index.css`:
- Consistent color tokens for light/dark mode
- Custom gradients and animations
- Responsive breakpoints
- Accessible contrast ratios

## 📱 Mobile Support

- Fully responsive design
- Touch-optimized interactions
- Mobile-first navigation
- Swipe gestures for activity cards

## 🧪 Development

### Available Scripts

```bash
# Development server
npm run dev

# Type checking
npm run type-check

# Linting
npm run lint

# Build for production
npm run build

# Preview production build
npm run preview
```

### Edge Functions

Edge functions are in `supabase/functions/`:
- `analyze-group-availability` - Find mutual free time
- `smart-activity-recommendations` - Generate suggestions
- `google-calendar-oauth` - Handle OAuth flow
- `sync-calendar-events` - Sync calendar data
- And more...

Functions deploy automatically when you push changes.

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Built with [Lovable](https://lovable.dev) - The AI-powered app builder
- Inspired by Movember and the mission to combat loneliness
- Icons from [Lucide](https://lucide.dev)
- UI components from [Shadcn/ui](https://ui.shadcn.com)

## 📞 Support

For detailed technical documentation, see the `/docs` folder.

## 🗺️ Roadmap

- [ ] iOS and Android native apps
- [ ] Apple Calendar integration
- [ ] Microsoft Outlook integration
- [ ] Activity reviews and ratings
- [ ] Recurring event suggestions
- [ ] Group chat for planned activities
- [ ] Photo sharing from completed activities
- [ ] Achievement badges and gamification

---

Made with ❤️ for better connections and less loneliness.

**Wink - Because life's too short to be lonely.**
