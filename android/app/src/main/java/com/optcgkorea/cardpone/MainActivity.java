package com.optcgkorea.cardpone;

import android.Manifest;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.GeolocationPermissions;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import java.util.Objects;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        bridge.getWebView().setWebChromeClient(new BridgeWebChromeClient(bridge) {
            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                Uri requested = Uri.parse(origin);
                Uri local = Uri.parse(bridge.getLocalUrl());
                boolean isAppOrigin = Objects.equals(requested.getScheme(), local.getScheme())
                    && Objects.equals(requested.getHost(), local.getHost())
                    && requested.getPort() == local.getPort();
                if (!isAppOrigin) {
                    callback.invoke(origin, false, false);
                    return;
                }
                // Nearby sorting must respect an existing approximate-location grant.
                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.ACCESS_COARSE_LOCATION)
                    == PackageManager.PERMISSION_GRANTED) {
                    callback.invoke(origin, true, false);
                    return;
                }
                super.onGeolocationPermissionsShowPrompt(origin, callback);
            }
        });
    }
}
