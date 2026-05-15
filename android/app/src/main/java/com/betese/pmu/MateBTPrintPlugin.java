package com.betese.pmu;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "MateBTPrint")
public class MateBTPrintPlugin extends Plugin {

    private static final String MATE_PACKAGE = "com.mateglobal.hardwarelib";
    private static final String MATE_PRINT_RECEIVER = "com.mateglobal.hardwarelib.PrinterReceiver";

    /**
     * Check if Mate BT Printer app is installed
     */
    private boolean isMateBTPrinterInstalled() {
        try {
            getContext().getPackageManager().getPackageInfo(MATE_PACKAGE, PackageManager.GET_ACTIVITIES);
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }

    @PluginMethod
    public void printText(PluginCall call) {
        String text = call.getString("text");
        String address = call.getString("address");

        if (text == null || text.isEmpty()) {
            call.reject("Text content is required");
            return;
        }

        if (!isMateBTPrinterInstalled()) {
            call.reject("Mate Bluetooth Printer app is not installed. Please install it from Google Play Store.");
            return;
        }

        try {
            // Intent-based printing for Mate BT Printer app
            Intent intent = new Intent();
            intent.setAction("com.mateglobal.printer.PRINT_TEXT");
            intent.setPackage(MATE_PACKAGE);
            
            // Pass the text and optional printer address
            intent.putExtra("text", text);
            if (address != null && !address.isEmpty()) {
                intent.putExtra("address", address);
            }
            // Add cut paper instruction
            intent.putExtra("cut", true);
            
            // Try to start the intent
            try {
                getActivity().startService(intent);
                JSObject result = new JSObject();
                result.put("success", true);
                result.put("printerName", "Mate BT Printer");
                call.resolve(result);
            } catch (Exception e) {
                // Fallback: try sending broadcast instead
                getContext().sendBroadcast(intent, null);
                JSObject result = new JSObject();
                result.put("success", true);
                result.put("printerName", "Mate BT Printer (Broadcast)");
                call.resolve(result);
            }
        } catch (Exception e) {
            call.reject("Failed to send print job to Mate BT Printer: " + e.getMessage());
        }
    }

    @PluginMethod
    public void listPrinters(PluginCall call) {
        if (!isMateBTPrinterInstalled()) {
            call.reject("Mate Bluetooth Printer app is not installed");
            return;
        }

        try {
            // Mate app stores paired printers info; for now return empty as we use address parameter in printText
            JSObject result = new JSObject();
            JSArray printers = new JSArray();
            
            // You can add hardcoded printer detection here if needed
            // For now, the user passes address directly in printText
            result.put("printers", printers);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to list Mate BT printers: " + e.getMessage());
        }
    }

    @PluginMethod
    public void isInstalled(PluginCall call) {
        JSObject result = new JSObject();
        result.put("installed", isMateBTPrinterInstalled());
        call.resolve(result);
    }
}
