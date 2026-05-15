# Mate Bluetooth Printer Setup Guide for Sunmi v2Pro

## Overview
The Betese PMU app now supports **Mate Technologies Bluetooth Printer** app for thermal ticket printing on Sunmi v2Pro terminals.

## Installation Steps

### 1. Install Mate Bluetooth Printer App
- **Option A (Recommended):** Download from Google Play Store
  - Search for "Mate Bluetooth Printer" or "Bluetooth Print - Thermal Printer"
  - Install on your Sunmi v2Pro terminal
  
- **Option B (Using APK):**
  - Copy `mate-technologies-bluetooth-print.apk` to your Sunmi device
  - Use a file manager to locate and tap the APK file
  - Follow the installation prompts
  - Allow "Unknown Sources" if prompted

### 2. Pair Your Thermal Printer
1. Open the **Mate Bluetooth Printer** app on your Sunmi v2Pro
2. Go to **Settings** → **Bluetooth Devices**
3. Enable Bluetooth on your thermal printer
4. Scan for devices and select your printer
5. Enter PIN (default is usually `0000` or `1234`)
6. Wait for "Paired" status

### 3. Run the Betese PMU App
- The app will automatically detect the Mate Bluetooth Printer
- Print chain: **Sunmi Built-in → Bluetooth Thermal → Mate BT → Fallback**

## How to Print Tickets

### From Betting Terminal
1. Complete your ticket sales for the day
2. Click **"PRINT SALES"** button to print daily summary
3. Click **"PRINT END OF SALE"** button to print end-of-day report
4. The app will automatically route to the **Mate Bluetooth Printer** if available

### Print Quality Settings (In Mate App)
- Open Mate Bluetooth Printer settings
- Adjust:
  - **Paper Width:** 58mm (standard thermal)
  - **Print Speed:** Medium/Normal
  - **Text Size:** Small/Normal
  - **Auto-cut:** ON (recommended)

## Troubleshooting

### Printer Not Detected
- Ensure Mate Bluetooth Printer app is **installed and running**
- Check Bluetooth is **enabled** on Sunmi v2Pro
- Verify printer **battery is charged**
- Try **force-stop** the Mate app and restart it
- Restart the Betese PMU app

### Blank Tickets / No Output
- **Solution 1:** Check printer **paper roll** (refill if needed)
- **Solution 2:** Clean printer **thermal head** with dry cloth
- **Solution 3:** In Mate app, try **test print** first
- **Solution 4:** Verify **Bluetooth pairing** is still active
- **Solution 5:** Re-install Mate app if issues persist

### Printer Disconnects
- In Mate app → **Re-pair the printer**
- Check printer **battery level**
- Move terminal closer to printer (Bluetooth range: ~10m)
- Disable WiFi interference if possible

### Wrong Printer Selected
- Mate app → **Select printer from available list**
- Can save default printer address in app settings
- The app will remember your printer for next sessions

## Advanced

### Using Sunmi Built-in Printer (Primary Method)
If your Sunmi v2Pro has a **built-in thermal printer module**, the app will use that first:
- No external Bluetooth printer needed
- Most reliable method
- Check Sunmi documentation for compatibility

### Setting Default Printer
The app saves your printer choice in app cache. To change:
1. Clear app cache: **Settings** → **Apps** → **Betese PMU** → **Clear Cache**
2. Restart the app
3. The next print will prompt for printer selection

## API Integration

### For Developers
The Betese app includes:
- **MateBTPrintPlugin** (Capacitor plugin)
- JavaScript support for `triggerPrint(elementId)`
- Automatic print chain with fallback

Print chain order:
1. Sunmi built-in printer
2. Bluetooth Thermal Print plugin
3. **Mate Bluetooth Printer** (NEW)
4. Native Android Print
5. RawBT print
6. Browser print (last resort)

## Support

### Common Issues
| Issue | Solution |
|-------|----------|
| App crashes when printing | Clear cache & reinstall Mate app |
| Very slow printing | Check printer connection; reduce print buffer |
| Paper jam | Open printer and remove paper bits |
| Faded output | Replace thermal paper; clean head |

### Get Help
- Download updated Betese PMU APK from GitHub releases
- Ensure both apps are on latest versions
- Test with Mate app's built-in test print first

## Requirements
- **Sunmi v2Pro** terminal with Bluetooth
- **Mate Bluetooth Printer app** v2.0+
- **58mm thermal printer** (ESC/POS compatible)
- **Bluetooth 4.0+** on printer
- **Paper:** 57×30mm rolls

Installed on: **May 15, 2026**
