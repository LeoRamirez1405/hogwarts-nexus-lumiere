package com.nexus.app;

import android.os.Bundle;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Keep the status bar visible (clock, battery, notifications) instead
        // of letting the WebView draw under it. WindowCompat is a no-op-safe
        // wrapper across API levels.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
    }
}