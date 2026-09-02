package br.com.eloapp;

import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;

import androidx.core.app.RemoteInput;

import com.getcapacitor.BridgeActivity;

import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(EloAvatarPlugin.class);
        registerPlugin(EloNotificationActionsPlugin.class);
        captureNotificationAction(getIntent());
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        captureNotificationAction(intent);
    }

    private void captureNotificationAction(Intent intent) {
        if (intent == null) return;
        String action = intent.getStringExtra("elo_notification_action");
        if (action == null || action.trim().isEmpty()) return;

        try {
            JSONObject payload = new JSONObject();
            payload.put("action", action);
            payload.put("notificationId", safe(intent.getStringExtra("notificationId")));
            payload.put("coupleId", safe(intent.getStringExtra("coupleId")));
            payload.put("senderUid", safe(intent.getStringExtra("senderUid")));
            payload.put("type", safe(intent.getStringExtra("type")));
            payload.put("savedAt", System.currentTimeMillis());

            if ("reply".equals(action)) {
                Bundle results = RemoteInput.getResultsFromIntent(intent);
                CharSequence reply = results == null ? null : results.getCharSequence(EloMessagingService.REMOTE_INPUT_KEY);
                payload.put("text", reply == null ? "" : reply.toString().trim());
            }

            SharedPreferences prefs = getSharedPreferences(EloNotificationActionsPlugin.PREFS, MODE_PRIVATE);
            prefs.edit().putString(EloNotificationActionsPlugin.KEY_PENDING, payload.toString()).apply();
        } catch (Exception ignored) {}
    }

    private String safe(String value) {
        return value == null ? "" : value;
    }
}
