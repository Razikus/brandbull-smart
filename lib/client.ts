// API Client for Device Management
// Based on OpenAPI specification

export interface DeviceRegistrationRequest {
  deviceName: string;
  productID: string;
}

export interface DeviceUnRegistrationRequest {
  deviceUUID: string;
}

export interface ListReturnItem {
  created_at: string;
  internal_uuid: string;
  product_id: string;
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
  public response: any;

  constructor(message: string, status: number, response: any) {
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
      let responseData: any;
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
  async registerDevice(request: DeviceRegistrationRequest): Promise<any> {
    return this.makeRequest('/register_device', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Unregister a device by product ID and device name
   */
  async unregisterDevice(request: DeviceRegistrationRequest): Promise<any> {
    return this.makeRequest('/unregister_device', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Unregister a device by UUID
   */
  async unregisterDeviceByUuid(request: DeviceUnRegistrationRequest): Promise<any> {
    return this.makeRequest('/unregister_device_by_uuid', {
      method: 'POST',
      body: JSON.stringify(request),
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

  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<any> {
    return this.makeRequest('/health', {
      method: 'GET',
    });
  }
}

// Helper function to create client instance with Supabase integration
export const createApiClient = (baseUrl: string, supabaseSession: any) => {
  if (!supabaseSession?.access_token) {
    throw new Error('No valid Supabase session provided');
  }
  
  return new DeviceApiClient(baseUrl, supabaseSession.access_token);
};

// Export types for use in components
export type {
  ListReturnItem as DeviceListItem, DeviceRegistrationRequest as DeviceRegRequest,
  DeviceUnRegistrationRequest as DeviceUnRegRequest
};
