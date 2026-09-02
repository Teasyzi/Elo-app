package br.com.eloapp;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;

import androidx.core.app.RemoteInput;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

/**
 * Executa ações de notificação sem abrir a WebView.
 * O Worker valida um token assinado de curta duração antes de alterar o Firestore.
 */
public class EloNotificationActionReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        final PendingResult pendingResult = goAsync();
        final Context appContext = context.getApplicationContext();

        new Thread(() -> {
            try {
                String action = safe(intent.getStringExtra("elo_action"));
                String endpoint = safe(intent.getStringExtra("elo_action_endpoint"));
                String actionToken = safe(intent.getStringExtra("elo_action_token"));
                String conversationKey = safe(intent.getStringExtra("elo_conversation_key"));
                int notificationId = intent.getIntExtra("elo_android_notification_id", 0);

                if (action.isEmpty() || endpoint.isEmpty() || actionToken.isEmpty()) return;

                String text = "";
                if ("reply".equals(action)) {
                    Bundle results = RemoteInput.getResultsFromIntent(intent);
                    CharSequence reply = results == null ? null : results.getCharSequence(EloMessagingService.REMOTE_INPUT_KEY);
                    text = reply == null ? "" : reply.toString().trim();
                    if (text.isEmpty()) return;
                }

                JSONObject body = new JSONObject();
                body.put("action", action);
                body.put("actionToken", actionToken);
                if (!text.isEmpty()) body.put("text", text);

                boolean ok = postJson(endpoint, body.toString());
                if (ok) {
                    if (notificationId != 0) {
                        NotificationManager manager = (NotificationManager) appContext.getSystemService(Context.NOTIFICATION_SERVICE);
                        if (manager != null) manager.cancel(notificationId);
                    }
                    if (!conversationKey.isEmpty()) {
                        EloMessagingService.clearConversationHistory(appContext, conversationKey);
                    }
                } else {
                    persistFallback(appContext, action, text, intent);
                }
            } catch (Exception ignored) {
                persistFallback(appContext, safe(intent.getStringExtra("elo_action")), "", intent);
            } finally {
                pendingResult.finish();
            }
        }, "elo-notification-action").start();
    }

    private boolean postJson(String endpoint, String json) {
        HttpURLConnection connection = null;
        try {
            URL url = new URL(endpoint);
            connection = (HttpURLConnection) url.openConnection();
            connection.setConnectTimeout(7000);
            connection.setReadTimeout(10000);
            connection.setRequestMethod("POST");
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            connection.setDoOutput(true);
            byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
            connection.setFixedLengthStreamingMode(bytes.length);
            try (OutputStream out = connection.getOutputStream()) {
                out.write(bytes);
            }
            int code = connection.getResponseCode();
            return code >= 200 && code < 300;
        } catch (Exception ignored) {
            return false;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private void persistFallback(Context context, String action, String text, Intent intent) {
        try {
            JSONObject payload = new JSONObject();
            payload.put("action", action);
            payload.put("notificationId", safe(intent.getStringExtra("notificationId")));
            payload.put("coupleId", safe(intent.getStringExtra("coupleId")));
            payload.put("senderUid", safe(intent.getStringExtra("senderUid")));
            payload.put("type", safe(intent.getStringExtra("type")));
            payload.put("text", text);
            payload.put("savedAt", System.currentTimeMillis());
            SharedPreferences prefs = context.getSharedPreferences(EloNotificationActionsPlugin.PREFS, Context.MODE_PRIVATE);
            prefs.edit().putString(EloNotificationActionsPlugin.KEY_PENDING, payload.toString()).apply();
        } catch (Exception ignored) {}
    }

    private static String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
