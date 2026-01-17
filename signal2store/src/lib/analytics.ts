// Analytics helper for Amplitude and local logging

interface AnalyticsEvent {
  ts: number;
  eventName: string;
  properties?: Record<string, any>;
}

const STORAGE_KEY = 's2s_events_v1';

// Always log to localStorage
function logToLocalStorage(eventName: string, properties?: Record<string, any>) {
  if (typeof window === 'undefined') return; // Server-side check
  
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    const events: AnalyticsEvent[] = existing ? JSON.parse(existing) : [];
    
    events.push({
      ts: Date.now(),
      eventName,
      properties,
    });
    
    // Keep only last 1000 events
    const trimmed = events.slice(-1000);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (err) {
    console.error('Error logging to localStorage:', err);
  }
}

// Send to Amplitude HTTP API if key exists
async function sendToAmplitude(eventName: string, properties?: Record<string, any>) {
  const apiKey = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
  
  if (!apiKey) {
    return; // No API key, skip
  }

  try {
    const response = await fetch('https://api2.amplitude.com/2/httpapi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        events: [
          {
            event_type: eventName,
            user_id: 'demo_user', // In production, use actual user ID
            event_properties: properties || {},
            time: Date.now(),
          },
        ],
      }),
    });

    if (!response.ok) {
      console.warn('Amplitude API error:', response.status);
    }
  } catch (err) {
    // Silently fail - don't break the app if Amplitude is down
    console.warn('Amplitude send failed:', err);
  }
}

// Main track function
export async function track(eventName: string, properties?: Record<string, any>) {
  // Always log locally
  logToLocalStorage(eventName, properties);
  
  // Try to send to Amplitude (non-blocking)
  sendToAmplitude(eventName, properties).catch(() => {
    // Already handled in sendToAmplitude
  });
}

// Check if Amplitude is enabled
export function isAmplitudeEnabled(): boolean {
  if (typeof window === 'undefined') return false; // Server-side check
  return !!process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;
}
