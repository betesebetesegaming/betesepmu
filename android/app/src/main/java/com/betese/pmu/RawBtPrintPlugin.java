package com.betese.pmu;

import android.content.Intent;
import android.content.pm.PackageManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "RawBtPrint")
public class RawBtPrintPlugin extends Plugin {

    private static final String RAWBT_PACKAGE = "ru.a402d.rawbtprinter";

    @PluginMethod
    public void isInstalled(PluginCall call) {
        JSObject result = new JSObject();
        result.put("installed", isRawBtInstalled());
        call.resolve(result);
    }

    @PluginMethod
    public void printText(PluginCall call) {
        String text = call.getString("text", "");
        if (text.trim().isEmpty()) {
            call.reject("Missing text to print");
            return;
        }

        if (!isRawBtInstalled()) {
            call.reject("RawBT is not installed");
            return;
        }

        try {
            Intent shareIntent = new Intent(Intent.ACTION_SEND);
            shareIntent.setType("text/plain");
            shareIntent.putExtra(Intent.EXTRA_TEXT, text);
            shareIntent.setPackage(RAWBT_PACKAGE);
            shareIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            getContext().startActivity(shareIntent);

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("launched", true);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Failed to open RawBT: " + e.getMessage());
        }
    }

    private boolean isRawBtInstalled() {
        try {
            PackageManager pm = getContext().getPackageManager();
            pm.getPackageInfo(RAWBT_PACKAGE, 0);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
