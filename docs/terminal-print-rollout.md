# Terminal Printing Rollout (Sunmi V1s / V2 Pro)

## Goal
Guarantee ticket printing in sales flow with 3 fallback paths:
1. Direct Bluetooth thermal (ESC/POS)
2. Native Android print manager
3. RawBT handoff

## Required on Device
- Betese APK (latest build with native print plugins)
- RawBT app installed (backup path)
- Bluetooth thermal printer paired in Android settings

## Setup Steps
1. Pair printer in Android Bluetooth settings.
2. Install RawBT from Play Store and complete first launch.
3. Install latest Betese APK.
4. Open Betese and place a test ticket.
5. Tap Print Ticket.

## Expected Print Order in App
1. BluetoothThermalPrint plugin (paired printer)
2. NativePrint plugin (Android print service)
3. RawBtPrint plugin (opens RawBT)
4. Last fallback: browser print path

## If Printing Fails
- Confirm app is APK install, not only website in browser.
- Confirm Bluetooth is ON and printer is paired.
- Confirm RawBT is installed.
- On browser mode, allow popups for site.

## Daily Shift Smoke Test (30 sec)
1. Place 1 small test bet.
2. Print one ticket.
3. Confirm text, numbers, and QR are visible.
4. Keep paper roll spare nearby.

## Notes
- PC print and terminal print use different pipelines.
- Terminal reliability is highest with installed APK + paired printer.
