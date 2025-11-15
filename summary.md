# Project Summary: Activity Recommendation Platform

## Executive Overview
A location-based activity recommendation platform that suggests activities based on user preferences, available time slots, weather conditions, and proximity. Integrates with Google Calendar for intelligent scheduling.

---

## Tech Stack

### Frontend
- **Framework**: React 18.3.1 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS with custom design system (HSL-based semantic tokens)
- **UI Components**: shadcn-ui (Radix UI primitives)
- **State Management**: TanStack Query (React Query) v5.83.0
- **Routing**: React Router DOM v6.30.1
- **Forms**: React Hook Form + Zod validation
- **Icons**: Lucide React
- **Date Handling**: date-fns v3.6.0
- **Charts**: Recharts v2.15.4
- **Notifications**: Sonner (toast notifications)

### Backend (Lovable Cloud / Supabase)
- **Database**: PostgreSQL with PostGIS extension (spatial data)
- **Authentication**: Supabase Auth (email/password, auto-confirm enabled)
- **Edge Functions**: Deno-based serverless functions
- **Storage**: Supabase Storage (configured but not actively used)
- **Real-time**: Supabase Realtime capabilities (not yet implemented)

### External APIs & Services
- **Overpass API**: OpenStreetMap data for nearby POIs (restaurants, cafes, parks, libraries, etc.)
- **Google Calendar API**: OAuth2 integration for calendar sync
- **Weather Data**: Currently using mock data (needs real API integration)

---

## Current Functionalities

### ✅ Implemented Features

#### 1. **User Authentication & Profiles**
- Email/password authentication with auto-confirm
- User profile management (home address, wake/sleep times, budget preferences)
- Profile geocoding for location-based features

#### 2. **Onboarding Flow**
- Category preference selection (food, shopping, sports, studying)
- Location input with geocoding
- Budget range configuration
- Daily schedule setup (wake/sleep times)

#### 3. **Activity Discovery**
- Real-time fetching of nearby POIs from OpenStreetMap via Overpass API
- Category filtering (food, shopping, sports, studying)
- Distance-based recommendations (2km radius default)
- Activity metadata: name, description, address, price level, opening hours

#### 4. **Calendar Integration**
- Google Calendar OAuth2 flow
- Token management (access & refresh tokens)
- Calendar event synchronization (fetch user's events)
- Event storage in local database

#### 5. **Dashboard**
- Weather widget (mock data - needs real API)
- Activity recommendations based on user preferences
- Calendar connection status
- Activity cards with detailed information

#### 6. **Database Schema**
- `profiles`: User home location, budget, schedule
- `preferences`: Category-based user preferences (scores)
- `activities`: Cached POI data from Overpass API
- `calendar_connections`: OAuth tokens for Google Calendar
- `calendar_events`: Synced calendar events
- PostGIS spatial data support for location queries

#### 7. **Security**
- Row Level Security (RLS) enabled on all tables
- User-scoped data access policies
- Secure token storage for OAuth
- Search path configuration for trigger functions

---

## Missing Critical Features (Roadmap)

### 🔴 High Priority - Core Functionality

#### 1. **Intelligent Scheduling Algorithm**
- **Gap**: No algorithm to match activities with available time slots
- **Needed**: 
  - Parse calendar events to find free time blocks
  - Match activity duration + travel time with available slots
  - Respect wake/sleep times and existing commitments
  - Prioritize activities based on preference scores

#### 2. **Real Weather API Integration**
- **Gap**: Weather widget uses mock data
- **Needed**: 
  - Integrate OpenWeatherMap, WeatherAPI, or similar service
  - Weather-based activity filtering (e.g., outdoor activities when sunny)
  - Real-time weather updates

#### 3. **Travel Time Calculation**
- **Gap**: Travel times are not calculated
- **Needed**: 
  - Google Maps Distance Matrix API or similar
  - Calculate travel time from home to activity location
  - Factor travel time into scheduling recommendations

#### 4. **Add to Calendar Functionality**
- **Gap**: "Add to Calendar" button exists but doesn't work
- **Needed**: 
  - Create events in Google Calendar via API
  - Handle event creation errors
  - Refresh calendar data after adding events

#### 5. **Activity Recommendation Engine**
- **Gap**: Activities are fetched but not intelligently ranked
- **Needed**: 
  - ML-based or rule-based ranking system
  - Consider: preferences, past behavior, time of day, weather, budget
  - Personalized activity suggestions

### 🟡 Medium Priority - User Experience

#### 6. **Real-time Calendar Sync**
- **Gap**: Manual sync only
- **Needed**: 
  - Webhook support for Google Calendar updates
  - Supabase Realtime for live calendar updates
  - Background sync jobs

#### 7. **Activity Filtering & Search**
- **Gap**: Limited filtering options
- **Needed**: 
  - Advanced filters (price, distance, rating, opening hours)
  - Search by activity name or type
  - Save favorite activities

#### 8. **User Preference Learning**
- **Gap**: Static preferences from onboarding
- **Needed**: 
  - Track user interactions (clicks, bookings, dismissals)
  - Update preference scores based on behavior
  - A/B testing for recommendation improvements

#### 9. **Mobile Responsiveness**
- **Gap**: Design may not be fully optimized for mobile
- **Needed**: 
  - Test and optimize for mobile devices
  - Touch-friendly UI components
  - Mobile-specific navigation patterns

#### 10. **Error Handling & Loading States**
- **Gap**: Limited error handling in edge functions and UI
- **Needed**: 
  - Comprehensive error messages
  - Retry mechanisms for failed API calls
  - Better loading skeletons and feedback

### 🟢 Low Priority - Nice to Have

#### 11. **Multi-Calendar Support**
- Support for Outlook, Apple Calendar, etc.
- Calendar selection (primary calendar picker)

#### 12. **Social Features**
- Share activities with friends
- Group activity planning
- Reviews and ratings

#### 13. **Activity History & Analytics**
- Track completed activities
- User analytics dashboard
- Activity completion statistics

#### 14. **Push Notifications**
- Remind users about upcoming activities
- Notify about new recommendations

#### 15. **Dark Mode**
- Full dark mode support (theme system is ready)

---

## Technical Debt & Improvement Areas

### 🔧 Code Quality Issues

#### 1. **Edge Function Error Handling**
- Overpass API failures not gracefully handled
- Google OAuth errors could be more descriptive
- Need retry logic for external API calls

#### 2. **Type Safety**
- Some `any` types in edge functions (Overpass API response)
- Missing TypeScript interfaces for external API responses

#### 3. **Component Architecture**
- Dashboard component is large and monolithic (179 lines)
- Should extract: CalendarSync, ActivityList, WeatherSection components
- Better separation of concerns

#### 4. **State Management**
- Heavy reliance on TanStack Query
- Consider Zustand or Context for global state (user profile, preferences)

#### 5. **Testing**
- **Critical Gap**: No tests whatsoever
- Needed: Unit tests, integration tests, E2E tests
- Test coverage for edge functions, components, utilities

#### 6. **Performance Optimization**
- Activities are fetched on every Dashboard load
- Implement caching strategy (stale-while-revalidate)
- Optimize PostGIS queries with proper indexes

#### 7. **Security Enhancements**
- Validate all user inputs on backend
- Rate limiting for edge functions
- CORS configuration review
- Token refresh logic for Google Calendar

### 🗄️ Database Optimization

#### 1. **Indexes Missing**
- Add spatial indexes on `location` fields (activities, profiles)
- Index on `user_id` for faster queries
- Composite indexes for common query patterns

#### 2. **Data Validation**
- Add database constraints for data integrity
- Validate price_level, rating ranges
- Ensure lat/lng are within valid ranges

#### 3. **Data Retention Policy**
- Old calendar events should be archived/deleted
- Cached activities from Overpass should refresh periodically

---

## Scalability Concerns

### Current Limitations

#### 1. **Overpass API Rate Limits**
- Public Overpass API has strict rate limits
- Single point of failure for activity data
- **Solution**: 
  - Cache aggressively (activities table)
  - Consider paid OSM data provider
  - Implement fallback data sources

#### 2. **Edge Function Cold Starts**
- Deno edge functions can have cold start latency
- **Solution**: 
  - Keep functions warm with scheduled pings
  - Optimize function size and dependencies

#### 3. **Database Connection Pooling**
- Supabase has connection limits
- **Solution**: 
  - Use connection pooling (PgBouncer)
  - Optimize query patterns
  - Consider read replicas for heavy read operations

#### 4. **Geospatial Query Performance**
- PostGIS queries can be slow with large datasets
- **Solution**: 
  - Add proper spatial indexes (GiST)
  - Limit query radius
  - Pre-filter by bounding box before distance calculations

---

## Feasibility Assessment

### ✅ Achievable with Current Resources
- **MVP Features**: 80% complete
- **Infrastructure**: Supabase provides necessary backend capabilities
- **External APIs**: All required APIs are available and affordable
- **Development Time**: 2-4 weeks to complete core features

### 🟡 Requires Additional Planning
- **Machine Learning**: Recommendation engine needs data science expertise
- **Testing**: Requires dedicated QA time and testing infrastructure
- **Performance**: May need database optimization consultant

### 🔴 Potential Blockers
- **Overpass API Reliability**: Public API downtime could break app
- **Google Calendar API Quotas**: May hit limits with many users
- **Cost at Scale**: Supabase, Google API, weather API costs increase with users

---

## Business Model Considerations

### Current State: MVP with No Monetization

### Potential Revenue Streams
1. **Freemium Model**: 
   - Free: Limited recommendations per day
   - Premium: Unlimited recommendations, advanced filters, priority support

2. **Affiliate Commissions**:
   - Partner with restaurants, venues for referral fees
   - "Book Now" buttons with affiliate links

3. **B2B Licensing**:
   - White-label solution for tourism boards, cities
   - Corporate wellness programs

4. **Premium Features**:
   - Group planning ($X/month)
   - Advanced analytics ($X/month)
   - Multi-calendar support ($X/month)

---

## Recommendations for Production Readiness

### Phase 1: Core Completion (2-3 weeks)
1. Implement intelligent scheduling algorithm
2. Integrate real weather API
3. Add travel time calculation
4. Implement "Add to Calendar" functionality
5. Build activity recommendation engine

### Phase 2: Stability & Testing (2-3 weeks)
1. Add comprehensive error handling
2. Write unit and integration tests (>80% coverage)
3. Implement caching and performance optimizations
4. Add database indexes and constraints
5. Security audit and improvements

### Phase 3: UX Refinement (1-2 weeks)
1. Mobile responsiveness testing and fixes
2. Improved loading states and error messages
3. Onboarding flow optimization
4. Accessibility improvements (WCAG 2.1 AA)

### Phase 4: Scalability (2-3 weeks)
1. Set up monitoring and logging (Sentry, LogRocket)
2. Implement rate limiting and abuse prevention
3. Database query optimization
4. CDN for static assets
5. Load testing and capacity planning

### Phase 5: Business Features (3-4 weeks)
1. User feedback and rating system
2. Analytics dashboard
3. Admin panel for content moderation
4. Payment integration (Stripe)
5. Email notifications (SendGrid/Postmark)

---

## Critical Questions for Review

### Architecture
1. Is the current tech stack appropriate for the scale we're targeting?
2. Should we migrate to a monorepo structure (NX, Turborepo)?
3. Is Supabase sufficient or do we need a custom backend?

### Data & Algorithms
4. How should we weight different factors in activity recommendations?
5. What's the right caching strategy for activity data?
6. How do we handle users in areas with limited POI data?

### User Experience
7. Is the onboarding flow too long or just right?
8. Should we add social features from the start or later?
9. How do we prevent "recommendation fatigue"?

### Business
10. What's the minimum viable feature set for launch?
11. Should we focus on a specific niche first (students, remote workers)?
12. How do we acquire our first 100 users?

### Technical
13. How do we handle Google Calendar API rate limits?
14. Should we build our own activity database or rely on OSM?
15. What's our disaster recovery and backup strategy?

---

## Conclusion

**Current Status**: Functional MVP with 80% of core features implemented. The foundation is solid with proper authentication, database schema, and external API integrations.

**Key Strengths**:
- Clean React architecture with TypeScript
- Proper database design with RLS security
- Scalable backend infrastructure (Supabase)
- Real data sources (OSM, Google Calendar)

**Key Weaknesses**:
- Missing intelligent scheduling algorithm (core feature)
- No testing infrastructure
- Limited error handling and edge case coverage
- Performance not optimized for scale

**Sustainability Path**: With 8-12 weeks of focused development, this can evolve from an AI-made MVP to a production-ready application. Priority should be: completing core scheduling logic, adding comprehensive tests, and optimizing performance before launching to users.

**Investment Needed**: Estimated 200-300 hours of development time, plus ongoing maintenance. Consider hiring a full-stack developer familiar with React, TypeScript, and Supabase to bring this to production quality.
