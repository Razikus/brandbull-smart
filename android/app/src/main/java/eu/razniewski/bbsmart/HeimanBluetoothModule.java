package eu.razniewski.bbsmart;

import android.app.Activity;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.modules.core.DeviceEventManagerModule;

// Importy z biblioteki Heiman
import com.heiman.hmLink.BluetoothSmartLink;
import com.heiman.hmLink.OnDiscoverListener;
import com.heiman.hmLink.ConfigCallback;
import com.heiman.hmLink.Constant;
import com.heiman.utilslibrary.LogUtil;

import org.json.JSONObject;
import org.json.JSONArray;

public class HeimanBluetoothModule extends ReactContextBaseJavaModule implements OnDiscoverListener, ConfigCallback {
    
    private BluetoothSmartLink bluetoothSmartLink;
    private ReactApplicationContext reactContext;
    private Promise currentConfigPromise;
    
    public HeimanBluetoothModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        LogUtil.setIsLogAble(true);
        this.bluetoothSmartLink = new BluetoothSmartLink();
    }

    @Override
    public String getName() {
        return "HeimanBluetooth";
    }

    @ReactMethod
    public void startDiscovery(Promise promise) {
        try {
            LogUtil.d("HeimanBluetoothModule startDiscovery() called from React Native");
            
            Activity currentActivity = getCurrentActivity();
            if (currentActivity == null) {
                promise.reject("NO_ACTIVITY", "No current activity available");
                return;
            }

            if (bluetoothSmartLink != null) {
                try {
                    bluetoothSmartLink.stopConfig();
                    bluetoothSmartLink.release();
                } catch (Exception e) {
                    LogUtil.w("Error stopping previous instance: " + e.getMessage());
                }
            }
            
            bluetoothSmartLink.setActivity(currentActivity);
            bluetoothSmartLink.setOnDiscoverListener(this);
            
            JSONObject jsonParams = new JSONObject();
            jsonParams.put(Constant.DISCOVER_MODE, true);
            
            bluetoothSmartLink.startConfig(jsonParams.toString());
            promise.resolve("Discovery started successfully");
            
        } catch (Exception e) {
            LogUtil.e("Failed to start discovery: " + e.getMessage());
            promise.reject("DISCOVERY_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void stopDiscovery(Promise promise) {
        try {
            LogUtil.d("HeimanBluetoothModule stopDiscovery() called from React Native");
            
            if (bluetoothSmartLink != null) {
                bluetoothSmartLink.stopConfig();
                bluetoothSmartLink.release();
            }
            
            promise.resolve("Discovery stopped successfully");
            
        } catch (Exception e) {
            LogUtil.e("Failed to stop discovery: " + e.getMessage());
            promise.reject("STOP_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void configureDevice(ReadableMap configData, Promise promise) {
        try {
            LogUtil.d("HeimanBluetoothModule configureDevice() called from React Native");
            
            Activity currentActivity = getCurrentActivity();
            if (currentActivity == null) {
                promise.reject("NO_ACTIVITY", "No current activity available");
                return;
            }
            
            currentConfigPromise = promise;
            
            bluetoothSmartLink.setActivity(currentActivity);
            bluetoothSmartLink.setConfigCallback(this);
            
            JSONObject jsonParams = new JSONObject();
            
            // Required parameters
            jsonParams.put(Constant.PRODUCT_ID, configData.getString("productId"));
            jsonParams.put(Constant.SSID, configData.getString("ssid"));
            jsonParams.put(Constant.PASSWORD, configData.getString("password"));
            jsonParams.put(Constant.HOST_URL, configData.getString("hostUrl"));
            jsonParams.put(Constant.MQTT_URL, configData.getString("mqttUrl"));
            
            // Optional parameters
            if (configData.hasKey("deviceMac") && !configData.isNull("deviceMac")) {
                jsonParams.put(Constant.ADD_DEVICE_MAC, configData.getString("deviceMac"));
            }
            
            if (configData.hasKey("productIds") && !configData.isNull("productIds")) {
                JSONArray productIdsArray = new JSONArray();
                com.facebook.react.bridge.ReadableArray ids = configData.getArray("productIds");
                for (int i = 0; i < ids.size(); i++) {
                    productIdsArray.put(ids.getString(i));
                }
                jsonParams.put(Constant.PRODUCT_IDS, productIdsArray);
            }
            
            LogUtil.d("Starting device configuration with params: " + jsonParams.toString());
            bluetoothSmartLink.startConfig(jsonParams.toString());
            
        } catch (Exception e) {
            LogUtil.e("Failed to configure device: " + e.getMessage());
            promise.reject("CONFIG_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void stopConfiguration(Promise promise) {
        try {
            LogUtil.d("HeimanBluetoothModule stopConfiguration() called from React Native");
            
            if (bluetoothSmartLink != null) {
                bluetoothSmartLink.stopConfig();
                bluetoothSmartLink.release();
            }
            
            if (currentConfigPromise != null) {
                currentConfigPromise.reject("CONFIG_CANCELLED", "Configuration was cancelled");
                currentConfigPromise = null;
            }
            
            promise.resolve("Configuration stopped successfully");
            
        } catch (Exception e) {
            LogUtil.e("Failed to stop configuration: " + e.getMessage());
            promise.reject("STOP_CONFIG_ERROR", e.getMessage());
        }
    }

    // OnDiscoverListener implementation
    @Override
    public boolean onDiscoverDevice(String productId, String mac) {
        LogUtil.d("Device discovered - productId: " + productId + ", mac: " + mac);
        
        WritableMap device = Arguments.createMap();
        device.putString("productId", productId);
        device.putString("mac", mac);
        
        // Wyślij event do React Native
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit("onDeviceDiscovered", device);
            
        return false; // Continue discovery
    }

    // ConfigCallback implementation
    @Override
    public void onFindDevice() {
        LogUtil.d("Device found during configuration");
        
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit("onDeviceFound", null);
    }

    @Override
    public void onStep(int step) {
        LogUtil.d("Configuration step changed to: " + step);
        
        WritableMap stepData = Arguments.createMap();
        stepData.putInt("step", step);
        
        String stepName = getStepName(step);
        stepData.putString("stepName", stepName);
        
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit("onConfigStep", stepData);
    }

    @Override
    public void onConfigSucceed(String jsonResult) {
        LogUtil.d("Configuration succeeded: " + jsonResult);
        
        if (currentConfigPromise != null) {
            try {
                WritableMap result = Arguments.createMap();
                result.putString("result", jsonResult);
                
                // Parse JSON result for easier access in React Native
                JSONObject resultObj = new JSONObject(jsonResult);
                if (resultObj.has("mac")) {
                    result.putString("mac", resultObj.getString("mac"));
                }
                if (resultObj.has(Constant.PRODUCT_ID)) {
                    result.putString("productId", resultObj.getString(Constant.PRODUCT_ID));
                }
                
                currentConfigPromise.resolve(result);
                currentConfigPromise = null;
                
            } catch (Exception e) {
                LogUtil.e("Failed to parse config result: " + e.getMessage());
                currentConfigPromise.reject("PARSE_ERROR", e.getMessage());
                currentConfigPromise = null;
            }
        }
    }

    @Override
    public void onError(String error) {
        LogUtil.e("Configuration error: " + error);
        
        if (currentConfigPromise != null) {
            try {
                JSONObject errorObj = new JSONObject(error);
                int code = errorObj.optInt("code", -1);
                String message = errorObj.optString("message", error);
                
                WritableMap errorData = Arguments.createMap();
                errorData.putInt("code", code);
                errorData.putString("message", message);
                
                // Emit error event as well
                reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                    .emit("onConfigError", errorData);
                
                currentConfigPromise.reject("CONFIG_FAILED", message);
                currentConfigPromise = null;
                
            } catch (Exception e) {
                LogUtil.e("Failed to parse error: " + e.getMessage());
                currentConfigPromise.reject("CONFIG_FAILED", error);
                currentConfigPromise = null;
            }
        }
    }

    private String getStepName(int step) {
        switch (step) {
            case Constant.SmartLinkStep.STEP_SEARCH_DEVICE:
                return "SEARCH_DEVICE";
            case Constant.SmartLinkStep.STEP_CONNECT_DEVICE:
                return "CONNECT_DEVICE";
            case Constant.SmartLinkStep.STEP_SEND_DATA:
                return "SEND_DATA";
            case Constant.SmartLinkStep.STEP_WAITE_DEVICE_CONNECT_NET:
                return "WAIT_DEVICE_CONNECT_NET";
            case Constant.SmartLinkStep.STEP_DEVICE_CONNECT_NET_SUCCEED:
                return "DEVICE_CONNECT_NET_SUCCEED";
            default:
                return "UNKNOWN_STEP";
        }
    }
}