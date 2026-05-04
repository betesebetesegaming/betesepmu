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

@CapacitorPlugin(name = "NativePrint")
public class NativePrintPlugin extends Plugin {

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

                        PrintAttributes.Builder attrBuilder = new PrintAttributes.Builder()
                                .setColorMode(PrintAttributes.COLOR_MODE_MONOCHROME)
                                .setMediaSize(PrintAttributes.MediaSize.UNKNOWN_PORTRAIT)
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
