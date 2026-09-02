package br.com.eloapp;

import android.content.SharedPreferences;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "EloNotificationActions")
public class EloNotificationActionsPlugin extends Plugin {
    static final String PREFS = "elo_notification_actions";
    static final String KEY_PENDING = "pending_action";

    @PluginMethod
    public void consumePendingAction(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS, android.content.Context.MODE_PRIVATE);
        String raw = prefs.getString(KEY_PENDING, "");
        if (raw == null || raw.isEmpty()) {
            JSObject empty = new JSObject();
            empty.put("action", "");
            call.resolve(empty);
            return;
        }
        prefs.edit().remove(KEY_PENDING).apply();
        try {
            org.json.JSONObject json = new org.json.JSONObject(raw);
            JSObject result = new JSObject();
            result.put("action", json.optString("action", ""));
            result.put("notificationId", json.optString("notificationId", ""));
            result.put("coupleId", json.optString("coupleId", ""));
            result.put("senderUid", json.optString("senderUid", ""));
            result.put("type", json.optString("type", ""));
            result.put("text", json.optString("text", ""));
            result.put("savedAt", json.optLong("savedAt", 0));
            call.resolve(result);
        } catch (Exception e) {
            JSObject empty = new JSObject();
            empty.put("action", "");
            call.resolve(empty);
        }
    }
}
