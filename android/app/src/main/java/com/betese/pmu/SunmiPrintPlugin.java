package com.betese.pmu;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.IBinder;
import android.os.RemoteException;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;

/**
 * SunmiPrintPlugin — connects to the Sunmi built-in printer via the Sunmi
 * internal AIDL print service. Works on all Sunmi T/V/P series devices.
 * Falls back gracefully when not on a Sunmi device.
 */
@CapacitorPlugin(name = "SunmiPrint")
public class SunmiPrintPlugin extends Plugin {

    // Sunmi internal print service component
    private static final String SUNMI_SERVICE_PKG  = "woyou.aidlservice.jiuiv5";
    private static final String SUNMI_SERVICE_CLASS = "woyou.aidlservice.jiuiv5.IWoyouService";

    private IBinder sunmiBinder = null;
    private boolean serviceBound = false;

    private final ServiceConnection connection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder service) {
            sunmiBinder = service;
            serviceBound = true;
        }
        @Override
        public void onServiceDisconnected(ComponentName name) {
            sunmiBinder = null;
            serviceBound = false;
        }
    };

    @Override
    public void load() {
        try {
            Intent intent = new Intent();
            intent.setPackage(SUNMI_SERVICE_PKG);
            intent.setAction(SUNMI_SERVICE_CLASS);
            getContext().bindService(intent, connection, Context.BIND_AUTO_CREATE);
        } catch (Exception e) {
            // Not a Sunmi device — silently ignore
        }
    }

    /**
     * Print plain text to the Sunmi built-in thermal printer.
     * Sends raw bytes over the AIDL transact channel (transaction code 11 = printText).
     */
    @PluginMethod
    public void printText(PluginCall call) {
        String text = call.getString("text", "");
        if (!serviceBound || sunmiBinder == null || text == null || text.isEmpty()) {
            call.reject("Sunmi printer not available");
            return;
        }
        try {
            android.os.Parcel data   = android.os.Parcel.obtain();
            android.os.Parcel reply  = android.os.Parcel.obtain();
            data.writeInterfaceToken(SUNMI_SERVICE_CLASS);
            data.writeString(text);
            data.writeStrongBinder(null); // callback = null
            // AIDL transaction 11 = printText(String, ICallback)
            sunmiBinder.transact(11, data, reply, 0);
            reply.recycle();
            data.recycle();
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (RemoteException e) {
            call.reject("Sunmi print failed: " + e.getMessage());
        }
    }

    /** Feed and cut paper (transaction code 19 = autoOutPaper). */
    @PluginMethod
    public void cutPaper(PluginCall call) {
        if (!serviceBound || sunmiBinder == null) {
            call.resolve(new JSObject()); // silent — not critical
            return;
        }
        try {
            android.os.Parcel data  = android.os.Parcel.obtain();
            android.os.Parcel reply = android.os.Parcel.obtain();
            data.writeInterfaceToken(SUNMI_SERVICE_CLASS);
            // transaction 19 = autoOutPaper(int lines, ICallback)
            data.writeInt(3);
            data.writeStrongBinder(null);
            sunmiBinder.transact(19, data, reply, 0);
            reply.recycle();
            data.recycle();
        } catch (Exception ignored) {}
        call.resolve(new JSObject());
    }

    /** Print a bitmap (base64 encoded, width in pixels). Transaction 26 = printBitmap. */
    @PluginMethod
    public void printBitmap(PluginCall call) {
        String base64 = call.getString("base64", "");
        int width = call.getInt("width", 384);
        if (!serviceBound || sunmiBinder == null || base64 == null || base64.isEmpty()) {
            call.reject("Sunmi printer not available");
            return;
        }
        try {
            byte[] bytes = android.util.Base64.decode(base64, android.util.Base64.DEFAULT);
            android.graphics.Bitmap bmp = android.graphics.BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            if (bmp == null) { call.reject("Invalid image"); return; }

            android.os.Parcel data  = android.os.Parcel.obtain();
            android.os.Parcel reply = android.os.Parcel.obtain();
            data.writeInterfaceToken(SUNMI_SERVICE_CLASS);
            bmp.writeToParcel(data, 0);
            data.writeStrongBinder(null);
            sunmiBinder.transact(26, data, reply, 0);
            reply.recycle();
            data.recycle();
            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Bitmap print failed: " + e.getMessage());
        }
    }

    @Override
    protected void handleOnDestroy() {
        try {
            if (serviceBound) getContext().unbindService(connection);
        } catch (Exception ignored) {}
        super.handleOnDestroy();
    }
}
