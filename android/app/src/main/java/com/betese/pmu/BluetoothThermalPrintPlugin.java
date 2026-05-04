package com.betese.pmu;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.os.Build;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.UUID;

@CapacitorPlugin(
    name = "BluetoothThermalPrint",
    permissions = {
        @Permission(alias = "legacyBluetooth", strings = {
            Manifest.permission.BLUETOOTH,
            Manifest.permission.BLUETOOTH_ADMIN
        }),
        @Permission(alias = "bluetoothConnect", strings = {
            Manifest.permission.BLUETOOTH_CONNECT
        })
    }
)
public class BluetoothThermalPrintPlugin extends Plugin {

    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");
    private PluginCall pendingPermissionCall;

    @PluginMethod
    public void listPairedPrinters(PluginCall call) {
        if (!ensurePermissions(call, "listPairedPrintersPermissionCallback")) return;

        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null) {
            call.reject("Bluetooth not supported on this device");
            return;
        }

        Set<BluetoothDevice> bonded = adapter.getBondedDevices();
        JSArray printers = new JSArray();
        if (bonded != null) {
            for (BluetoothDevice d : bonded) {
                JSObject p = new JSObject();
                p.put("name", d.getName());
                p.put("address", d.getAddress());
                printers.put(p);
            }
        }

        JSObject result = new JSObject();
        result.put("printers", printers);
        call.resolve(result);
    }

    @PluginMethod
    public void printText(PluginCall call) {
        if (!ensurePermissions(call, "printTextPermissionCallback")) return;

        String text = call.getString("text", "");
        String address = call.getString("address", "");
        boolean cut = call.getBoolean("cut", true);

        if (text.trim().isEmpty()) {
            call.reject("Missing print text");
            return;
        }

        BluetoothAdapter adapter = BluetoothAdapter.getDefaultAdapter();
        if (adapter == null) {
            call.reject("Bluetooth not supported on this device");
            return;
        }
        if (!adapter.isEnabled()) {
            call.reject("Bluetooth is disabled");
            return;
        }

        BluetoothDevice target = null;
        Set<BluetoothDevice> bonded = adapter.getBondedDevices();
        if (bonded != null) {
            if (address != null && !address.trim().isEmpty()) {
                for (BluetoothDevice d : bonded) {
                    if (address.equalsIgnoreCase(d.getAddress())) {
                        target = d;
                        break;
                    }
                }
            }
            if (target == null) {
                for (BluetoothDevice d : bonded) {
                    target = d;
                    break;
                }
            }
        }

        if (target == null) {
            call.reject("No paired Bluetooth printer found");
            return;
        }

        BluetoothDevice printer = target;
        new Thread(() -> {
            BluetoothSocket socket = null;
            try {
                socket = printer.createRfcommSocketToServiceRecord(SPP_UUID);
                adapter.cancelDiscovery();
                socket.connect();

                OutputStream os = socket.getOutputStream();

                os.write(new byte[]{0x1B, 0x40}); // ESC @ init
                os.write(new byte[]{0x1B, 0x61, 0x00}); // left align
                os.write(text.getBytes(StandardCharsets.UTF_8));
                os.write("\n\n\n".getBytes(StandardCharsets.UTF_8));

                if (cut) {
                    os.write(new byte[]{0x1D, 0x56, 0x42, 0x00}); // partial cut
                }

                os.flush();
                os.close();

                JSObject result = new JSObject();
                result.put("success", true);
                result.put("printerName", printer.getName());
                result.put("printerAddress", printer.getAddress());
                call.resolve(result);
            } catch (Exception e) {
                call.reject("Bluetooth print failed: " + e.getMessage());
            } finally {
                if (socket != null) {
                    try { socket.close(); } catch (Exception ignored) {}
                }
            }
        }).start();
    }

    private boolean ensurePermissions(PluginCall call, String callbackName) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            if (getPermissionState("bluetoothConnect") != PermissionState.GRANTED) {
                pendingPermissionCall = call;
                requestPermissionForAlias("bluetoothConnect", call, callbackName);
                return false;
            }
            return true;
        }

        if (getPermissionState("legacyBluetooth") != PermissionState.GRANTED) {
            pendingPermissionCall = call;
            requestPermissionForAlias("legacyBluetooth", call, callbackName);
            return false;
        }
        return true;
    }

    @PermissionCallback
    private void listPairedPrintersPermissionCallback(PluginCall call) {
        PluginCall target = pendingPermissionCall != null ? pendingPermissionCall : call;
        pendingPermissionCall = null;
        if (target == null) return;
        if (!ensurePermissions(target, "listPairedPrintersPermissionCallback")) return;
        listPairedPrinters(target);
    }

    @PermissionCallback
    private void printTextPermissionCallback(PluginCall call) {
        PluginCall target = pendingPermissionCall != null ? pendingPermissionCall : call;
        pendingPermissionCall = null;
        if (target == null) return;
        if (!ensurePermissions(target, "printTextPermissionCallback")) return;
        printText(target);
    }
}
