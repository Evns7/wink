# Timezone Integration Documentation

## Overview

This document describes the complete timezone detection system integrated into the application. The system automatically detects the user's timezone using their geolocation and displays real-time information in the UI.

## Architecture

### Components

1. **Edge Function**: `supabase/functions/timezone/index.ts`
   - Server-side function that fetches timezone data from external APIs
   - Handles coordinate-to-timezone conversion
   - No API key required (uses free WorldTimeAPI)

2. **Service Layer**: `src/services/timezoneService.ts`
   - Client-side TypeScript service for timezone operations
   - Provides caching and fallback mechanisms
   - Modular design for easy provider switching

3. **UI Component**: `src/components/Header.tsx`
   - Displays timezone and current time in the top-left corner
   - Auto-updates every minute
   - Responsive design with mobile considerations

## Features

### ✅ Automatic Detection
- Uses browser Geolocation API to get user coordinates
- Converts lat/lng to timezone information
- Caches results for 1 hour to reduce API calls

### ✅ Comprehensive Information
- Timezone name (e.g., "America/New_York")
- Current local time
- UTC offset (e.g., "-05:00")
- Timezone abbreviation (e.g., "EST")
- Unix timestamp

### ✅ Error Handling
- Graceful fallback to browser's timezone if geolocation fails
- Automatic retry mechanisms
- User-friendly error messages

### ✅ Performance Optimized
- Caches timezone data for 1 hour
- Uses browser's cached geolocation (5-minute cache)
- Minimal API calls

### ✅ Production Ready
- TypeScript for type safety
- Proper error logging
- CORS configured
- Modular and testable code

## API Providers

### Current: WorldTimeAPI (Free)
- **Base URL**: `https://worldtimeapi.org/api`
- **Rate Limit**: Reasonable for production use
- **Cost**: Free
- **Auth**: No API key required
- **Reliability**: High uptime

### Coordinate Detection: TimeAPI.io
- **Base URL**: `https://timeapi.io/api`
- **Purpose**: Convert coordinates to timezone name
- **Cost**: Free
- **Auth**: No API key required

### Alternative Providers (Easy to Switch)

The service is designed to easily switch providers. Here are some alternatives:

#### 1. TimezoneDB
```typescript
// Add to environment variables
TIMEZONEDB_API_KEY=your_key_here

// Update edge function to use TimezoneDB
const url = `https://api.timezonedb.com/v2.1/get-time-zone?key=${apiKey}&format=json&by=position&lat=${lat}&lng=${lng}`;
```

#### 2. Google Time Zone API
```typescript
// Requires Google Cloud API key
const url = `https://maps.googleapis.com/maps/api/timezone/json?location=${lat},${lng}&timestamp=${timestamp}&key=${apiKey}`;
```

#### 3. Abstract API
```typescript
const url = `https://timezone.abstractapi.com/v1/current_time/?api_key=${apiKey}&location=${lat},${lng}`;
```

## Usage Examples

### Basic Detection
```typescript
import { timezoneService } from '@/services/timezoneService';

const timezone = await timezoneService.detectTimezone();
console.log(timezone.timezone); // "America/New_York"
console.log(timezone.localTime); // Date object
```

### Specific Coordinates
```typescript
const nyTimezone = await timezoneService.getTimezoneFromCoordinates(40.7128, -74.0060);
console.log(nyTimezone.timezone); // "America/New_York"
```

### Format Time
```typescript
const formatted = timezoneService.formatTime(timezone, 'long');
console.log(formatted); // "02:30:45 PM EST"
```

### React Component
```typescript
import { useState, useEffect } from 'react';
import { timezoneService, TimezoneInfo } from '@/services/timezoneService';

export function MyComponent() {
  const [timezone, setTimezone] = useState<TimezoneInfo | null>(null);

  useEffect(() => {
    timezoneService.detectTimezone().then(setTimezone);
  }, []);

  return (
    <div>
      {timezone && (
        <p>{timezone.timezone}: {timezoneService.formatTime(timezone)}</p>
      )}
    </div>
  );
}
```

## UI Integration

### Header Display
The timezone and current time are displayed in the top-left corner of the header:

```tsx
<div className="flex items-center gap-2">
  <Clock className="h-4 w-4" />
  <div>
    <div className="text-sm font-medium">{currentTime}</div>
    <div className="text-xs text-muted-foreground">
      {timezone.timezone} ({timezone.abbreviation})
    </div>
  </div>
</div>
```

Features:
- Auto-updates every minute
- Responsive design (hidden on mobile)
- Semantic styling using design tokens
- Clock icon for visual clarity

## Configuration

### Edge Function Setup
The timezone function is configured in `supabase/config.toml`:

```toml
[functions.timezone]
verify_jwt = false
```

This makes it publicly accessible (no authentication required).

### No API Keys Required
The current implementation uses free APIs that don't require API keys. If you switch to a provider that requires an API key:

1. Add the key to Supabase secrets
2. Update the edge function to use `Deno.env.get('API_KEY_NAME')`
3. Update documentation with setup instructions

## Testing

### Manual Testing
1. Open the app in a browser
2. Allow geolocation when prompted
3. Check the top-left corner for timezone display
4. Verify the time updates every minute

### Console Testing
```typescript
// In browser console
import { runAllExamples } from '@/examples/timezoneServiceUsage';
await runAllExamples();
```

## Troubleshooting

### Geolocation Blocked
If geolocation is blocked, the service automatically falls back to the browser's timezone:
```typescript
const fallback = timezoneService.getFallbackTimezone();
```

### API Errors
Check the Edge Function logs:
```bash
# View logs in Lovable Cloud UI or via Supabase dashboard
```

### Cache Issues
Clear the cache manually if needed:
```typescript
timezoneService.clearCache();
```

## Performance Considerations

### Caching Strategy
- **Timezone Data**: Cached for 1 hour
- **Geolocation**: Browser cache for 5 minutes
- **Time Display**: Updated every minute (local calculation)

### API Call Optimization
- First load: 2 API calls (coordinate→timezone, timezone→time)
- Subsequent loads: 0 API calls (uses cache)
- Cache expiry: Automatic refresh after 1 hour

## Security

### CORS Configuration
The edge function includes proper CORS headers:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

### No Sensitive Data
- No API keys exposed to client
- Coordinates are only used for timezone detection
- No storage of user location data

## Future Enhancements

### Potential Improvements
1. **Manual Timezone Override**: Allow users to manually select their timezone
2. **Multiple Timezones**: Display multiple timezones simultaneously
3. **Schedule by Timezone**: Integrate with calendar for timezone-aware scheduling
4. **Timezone History**: Track timezone changes for travelers
5. **Smart Suggestions**: Suggest meeting times based on multiple users' timezones

## Migration Guide

### Switching Timezone Providers

If you need to switch from WorldTimeAPI to another provider:

1. Update the edge function (`supabase/functions/timezone/index.ts`)
2. Add any required API keys to secrets
3. Update the API endpoint URLs
4. Test thoroughly
5. Update this documentation

The service interface remains the same, so no client-side changes needed.

## Support

For issues or questions:
- Check the Edge Function logs
- Review the browser console for client-side errors
- Verify geolocation permissions
- Check network requests in DevTools

## Related Documentation
- [Weather Integration](./WEATHER_INTEGRATION.md)
- [Geolocation Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)
- [WorldTimeAPI Documentation](https://worldtimeapi.org/)
