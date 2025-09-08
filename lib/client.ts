// API Client for Device Management
// Based on OpenAPI specification

export interface DeviceRegistrationRequest {
  deviceName: string;
  productID: string;
}

export interface DeviceUnRegistrationRequest {
  deviceUUID: string;
}


export interface DeviceRenameRequest {
  name: string;
}

export interface ListReturnItem {
  created_at: string;
  internal_uuid: string;
  product_id: string;
  name: string | null;
}
export interface eFlara {
  address: string;
  enabled: boolean;
}
export interface DeviceInfo {
  state: string;
  name?: string;
  eFlara?: eFlara;
}

export interface Event {
  name: string;
  timestamp?: string;
}

export interface PropertyReport {
  properties: Record<string, unknown>;
  timestamp?: string;
}

export interface DeviceEvents {
  events: Event[];
  properties: PropertyReport[];
}

interface DeviceApiValidationError {
  detail?: DeviceApiFieldError[];
}

interface DeviceApiFieldError {
  loc: (string | number)[];
  msg: string;
  type: string;
}

export class ApiError extends Error {
  public status: number;
  public response: unknown;

  constructor(message: string, status: number, response: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.response = response;
  }
}

export class DeviceApiClient {
  private baseUrl: string;
  private bearerToken: string;

  constructor(baseUrl: string, bearerToken: string) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    this.bearerToken = bearerToken;
  }

  /**
   * Update the bearer token for authentication
   */
  updateToken(newToken: string) {
    this.bearerToken = newToken;
  }

  /**
   * Make HTTP request with proper headers and error handling
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.bearerToken}`,
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      
      // Handle different response types
      let responseData: unknown;
      const contentType = response.headers.get('content-type');
      
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      if (!response.ok) {
        throw new ApiError(
          `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          responseData
        );
      }

      return responseData as T;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      
      // Network or other errors
      throw new ApiError(
        `Network error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        0,
        null
      );
    }
  }

  /**
   * Register a new device
   */
  async registerDevice(request: DeviceRegistrationRequest): Promise<{
    uuid: string;
    name: string;
    created_at: string;
  }> {
    return this.makeRequest('/register_device', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Unregister a device by product ID and device name
   */
  async unregisterDevice(request: DeviceRegistrationRequest): Promise<{
    status: string;
    detail: string;
  }> {
    return this.makeRequest('/unregister_device', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Unregister a device by UUID
   */
  async unregisterDeviceByUuid(request: DeviceUnRegistrationRequest): Promise<{
    status: string;
    detail: string;
  }> {
    return this.makeRequest('/unregister_device_by_uuid', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Get device information (state, name)
   */
  async getDeviceInfo(deviceUuid: string): Promise<DeviceInfo> {
    return this.makeRequest<DeviceInfo>(`/device/${deviceUuid}/info`, {
      method: 'GET',
    });
  }

  /**
   * Get device logs (events and properties)
   */
  async getDeviceLogs(deviceUuid: string): Promise<DeviceEvents> {
    return this.makeRequest<DeviceEvents>(`/device/${deviceUuid}/logs`, {
      method: 'GET',
    });
  }

  /**
   * List all registered devices for the authenticated user
   */
  async listDevices(): Promise<ListReturnItem[]> {
    return this.makeRequest<ListReturnItem[]>('/list', {
      method: 'GET',
    });
  }

  async deleteAccount(): Promise<{
    status: string;
    detail: string;
  }> {
    return this.makeRequest('/account/delete', {
      method: 'DELETE',
    });
  }

  async renameDevice(deviceUuid: string, request: DeviceRenameRequest): Promise<{
    status: string;
    detail: string;
  }> {
    return this.makeRequest(`/device/${deviceUuid}/rename`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async setEFlaraConfig(deviceUuid: string, config: eFlara): Promise<void> {
    return this.makeRequest(`/device/${deviceUuid}/eflara`, {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<{
    status: string;
    jwks_keys_count?: number;
    available_key_ids?: string[];
    timestamp: string;
    error?: string;
  }> {
    return this.makeRequest('/health', {
      method: 'GET',
    });
  }

  async registerNotificationToken(request: NotificationTokenRequest): Promise<void> {
    return this.makeRequest('/user/notification', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }
}
export interface NotificationTokenRequest {
  token: string;
}

// Add this method to your DeviceApiClient class:

/**
 * Register push notification token
 */

// Helper function to create client instance with Supabase integration
export const createApiClient = (baseUrl: string, supabaseSession: { access_token?: string } | null) => {
  if (!supabaseSession?.access_token) {
    console.error('No valid Supabase session provided');
    throw new Error('No valid Supabase session provided');
  }
  console.log('Creating API client with base URL:', baseUrl);
  
  return new DeviceApiClient(baseUrl, supabaseSession.access_token);
};



// Export types for use in components
export type {
  Event as DeviceEvent, DeviceInfo as DeviceInformation, ListReturnItem as DeviceListItem, DeviceEvents as DeviceLogs, DeviceRegistrationRequest as DeviceRegRequest,
  DeviceUnRegistrationRequest as DeviceUnRegRequest, PropertyReport as PropertyReportResponse
};
