package com.betese.pmu;

import android.content.Context;
import android.os.Build;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

@CapacitorPlugin(name = "NativePrint")
public class NativePrintPlugin extends Plugin {

    private static final Pattern PAPER_WIDTH_PATTERN = Pattern.compile("<meta[^>]*name=\"thermal-paper-width\"[^>]*content=\"([0-9.]+)mm\"", Pattern.CASE_INSENSITIVE);
    private static final Pattern PAPER_HEIGHT_PATTERN = Pattern.compile("<meta[^>]*name=\"thermal-paper-height\"[^>]*content=\"([0-9.]+)mm\"", Pattern.CASE_INSENSITIVE);

    private int mmToMils(double mm) {
        return Math.max(1, (int) Math.round(mm * 39.3701));
    }

    private PrintAttributes.MediaSize resolveMediaSize(String html) {
        double widthMm = 57.0;
        double heightMm = 40.0;

        try {
            Matcher widthMatcher = PAPER_WIDTH_PATTERN.matcher(html);
            if (widthMatcher.find()) {
                widthMm = Double.parseDouble(widthMatcher.group(1));
            }
            Matcher heightMatcher = PAPER_HEIGHT_PATTERN.matcher(html);
            if (heightMatcher.find()) {
                heightMm = Double.parseDouble(heightMatcher.group(1));
            }
        } catch (Exception ignored) {}

        return new PrintAttributes.MediaSize(
            "betese_receipt_" + (int) widthMm + "x" + (int) heightMm,
            "Betese Receipt " + (int) widthMm + "x" + (int) heightMm + "mm",
            mmToMils(widthMm),
            mmToMils(heightMm)
        );
    }

    @PluginMethod
    public void printHtml(PluginCall call) {
        String html = call.getString("html");
        String jobName = call.getString("jobName", "Betese Ticket");

        if (html == null || html.trim().isEmpty()) {
            call.reject("Missing html content");
            return;
        }

        getActivity().runOnUiThread(() -> {
            try {
                WebView printWebView = new WebView(getContext());
                printWebView.getSettings().setJavaScriptEnabled(false);

                printWebView.setWebViewClient(new WebViewClient() {
                    @Override
                    public void onPageFinished(WebView view, String url) {
                        Context context = getContext();
                        PrintManager printManager = (PrintManager) context.getSystemService(Context.PRINT_SERVICE);
                        if (printManager == null) {
                            call.reject("Print service unavailable");
                            view.destroy();
                            return;
                        }

                        PrintDocumentAdapter printAdapter;
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                            printAdapter = view.createPrintDocumentAdapter(jobName);
                        } else {
                            printAdapter = view.createPrintDocumentAdapter();
                        }

                        PrintAttributes.MediaSize mediaSize = resolveMediaSize(html);
                        PrintAttributes.Builder attrBuilder = new PrintAttributes.Builder()
                                .setColorMode(PrintAttributes.COLOR_MODE_MONOCHROME)
                                .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                                .setMediaSize(mediaSize)
                                .setResolution(new PrintAttributes.Resolution("thermal", "thermal", 203, 203));

                        printManager.print(jobName, printAdapter, attrBuilder.build());

                        JSObject result = new JSObject();
                        result.put("success", true);
                        call.resolve(result);
                    }
                });

                printWebView.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
            } catch (Exception ex) {
                call.reject("Native print failed: " + ex.getMessage());
            }
        });
    }
}
