package com.betese.pmu;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
	@Override
	public void onCreate(Bundle savedInstanceState) {
		super.onCreate(savedInstanceState);
		registerPlugin(NativePrintPlugin.class);
		registerPlugin(BluetoothThermalPrintPlugin.class);
		registerPlugin(RawBtPrintPlugin.class);
		registerPlugin(SunmiPrintPlugin.class);
		registerPlugin(MateBTPrintPlugin.class);
	}
}
