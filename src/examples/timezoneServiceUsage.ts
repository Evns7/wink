/**
 * Example usage of the TimezoneService
 * 
 * This file demonstrates how to use the timezone service in your components
 */

import { timezoneService, TimezoneInfo } from "@/services/timezoneService";

// Example 1: Basic timezone detection
export async function exampleBasicDetection() {
  console.log('=== Example 1: Basic Timezone Detection ===');
  
  const timezone = await timezoneService.detectTimezone();
  
  if (timezone) {
    console.log('Timezone:', timezone.timezone);
    console.log('Local Time:', timezone.localTime);
    console.log('UTC Offset:', timezone.utcOffset);
    console.log('Abbreviation:', timezone.abbreviation);
  } else {
    console.log('Failed to detect timezone');
  }
}

// Example 2: Get timezone from specific coordinates
export async function exampleCoordinateBasedDetection() {
  console.log('=== Example 2: Coordinate-Based Detection ===');
  
  // New York coordinates
  const nyTimezone = await timezoneService.getTimezoneFromCoordinates(40.7128, -74.0060);
  
  if (nyTimezone) {
    console.log('New York Timezone:', nyTimezone.timezone);
    console.log('New York Time:', timezoneService.formatTime(nyTimezone, 'long'));
  }
  
  // London coordinates
  const londonTimezone = await timezoneService.getTimezoneFromCoordinates(51.5074, -0.1278);
  
  if (londonTimezone) {
    console.log('London Timezone:', londonTimezone.timezone);
    console.log('London Time:', timezoneService.formatTime(londonTimezone, 'long'));
  }
}

// Example 3: Format time in different ways
export async function exampleTimeFormatting() {
  console.log('=== Example 3: Time Formatting ===');
  
  const timezone = await timezoneService.detectTimezone();
  
  if (timezone) {
    console.log('Short format:', timezoneService.formatTime(timezone, 'short'));
    console.log('Medium format:', timezoneService.formatTime(timezone, 'medium'));
    console.log('Long format:', timezoneService.formatTime(timezone, 'long'));
  }
}

// Example 4: Using in a React component
export function exampleReactComponent() {
  return `
import React, { useEffect, useState } from 'react';
import { timezoneService, TimezoneInfo } from '@/services/timezoneService';

export function TimezoneDisplay() {
  const [timezone, setTimezone] = useState<TimezoneInfo | null>(null);
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    // Detect timezone on mount
    const detectTz = async () => {
      const tz = await timezoneService.detectTimezone();
      setTimezone(tz);
    };
    detectTz();
  }, []);

  useEffect(() => {
    if (!timezone) return;

    // Update time every minute
    const updateTime = () => {
      setCurrentTime(timezoneService.formatTime(timezone, 'medium'));
    };

    updateTime(); // Initial update
    const interval = setInterval(updateTime, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [timezone]);

  if (!timezone) {
    return <div>Loading timezone...</div>;
  }

  return (
    <div>
      <p>{timezone.timezone}</p>
      <p>{currentTime}</p>
      <p>UTC {timezone.utcOffset}</p>
    </div>
  );
}
  `;
}

// Example 5: Clear cache if needed
export function exampleClearCache() {
  console.log('=== Example 5: Clear Cache ===');
  
  timezoneService.clearCache();
  console.log('Timezone cache cleared. Next detection will fetch fresh data.');
}

// Run all examples (for testing purposes)
export async function runAllExamples() {
  await exampleBasicDetection();
  console.log('\n');
  
  await exampleCoordinateBasedDetection();
  console.log('\n');
  
  await exampleTimeFormatting();
  console.log('\n');
  
  console.log(exampleReactComponent());
  console.log('\n');
  
  exampleClearCache();
}
