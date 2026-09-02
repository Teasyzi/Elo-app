package br.com.eloapp;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;
import androidx.core.app.RemoteInput;
import androidx.core.content.LocusIdCompat;
import androidx.core.content.pm.ShortcutInfoCompat;
import androidx.core.content.pm.ShortcutManagerCompat;
import androidx.core.graphics.drawable.IconCompat;

import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class EloMessagingService extends FirebaseMessagingService {
    private static final String DEFAULT_CHANNEL = "elo_general";
    private static final String HISTORY_PREFS = "elo_conversation_history";
    private static final int MAX_HISTORY = 6;
    public static final String REMOTE_INPUT_KEY = "elo_quick_reply";

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        // Mantém o evento registration do plugin Capacitor funcionando.
        PushNotificationsPlugin.onNewToken(token);
    }

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        Map<String, String> data = remoteMessage.getData();
        if (data == null || data.isEmpty()) return;

        String title = clean(data.get("title"), "Elo 💕");
        String body = clean(data.get("body"), "Você recebeu uma novidade no Elo.");
        String senderName = clean(data.get("senderName"), title);
        String senderUid = clean(data.get("senderUid"), senderName);
        String senderPhotoUrl = clean(data.get("senderPhotoUrl"), "");
        String type = clean(data.get("type"), "system");
        String channelId = clean(data.get("channelId"), channelFor(type));
        String notificationId = clean(data.get("notificationId"), remoteMessage.getMessageId());
        String coupleId = clean(data.get("coupleId"), "");
        long timestamp = parseLong(data.get("sentAt"), System.currentTimeMillis());

        boolean isConversation = isConversationType(type);
        Bitmap avatar = loadCachedAvatar(senderUid);
        if (avatar == null) avatar = loadHttpsBitmap(senderPhotoUrl);

        if (isConversation) {
            showConversationNotification(
                data,
                remoteMessage,
                channelId,
                notificationId,
                coupleId,
                senderUid,
                senderName,
                body,
                timestamp,
                avatar
            );
        } else {
            showStandardNotification(data, remoteMessage, channelId, notificationId, coupleId, title, body, type, avatar);
        }
    }

    private void showConversationNotification(
        Map<String, String> data,
        RemoteMessage remoteMessage,
        String channelId,
        String notificationId,
        String coupleId,
        String senderUid,
        String senderName,
        String body,
        long timestamp,
        Bitmap avatar
    ) {
        String conversationKey = conversationKey(coupleId, senderUid);
        String shortcutId = "elo-chat-" + Integer.toHexString(conversationKey.hashCode());
        LocusIdCompat locusId = new LocusIdCompat(shortcutId);

        Person.Builder senderBuilder = new Person.Builder()
            .setName(senderName)
            .setKey(senderUid)
            .setUri("elo://user/" + Uri.encode(senderUid));
        if (avatar != null) senderBuilder.setIcon(IconCompat.createWithBitmap(avatar));
        Person sender = senderBuilder.build();

        Person me = new Person.Builder()
            .setName("Você")
            .setKey("elo-current-user")
            .setUri("elo://self")
            .build();

        Intent shortcutIntent = buildOpenIntent(data, remoteMessage, notificationId, "open_chat");
        shortcutIntent.setAction(Intent.ACTION_VIEW);
        ShortcutInfoCompat.Builder shortcutBuilder = new ShortcutInfoCompat.Builder(this, shortcutId)
            .setShortLabel(senderName)
            .setLongLabel("Conversa com " + senderName)
            .setIntent(shortcutIntent)
            .setPerson(sender)
            .setLocusId(locusId)
            .setIsConversation()
            .setLongLived(true);
        if (avatar != null) shortcutBuilder.setIcon(IconCompat.createWithBitmap(avatar));
        ShortcutInfoCompat shortcut = shortcutBuilder.build();
        try {
            ShortcutManagerCompat.pushDynamicShortcut(this, shortcut);
        } catch (Exception ignored) {
            // A notificação continua funcional mesmo se o launcher limitar shortcuts.
        }

        List<StoredMessage> messages = appendConversationHistory(conversationKey, body, timestamp, senderName, senderUid);
        NotificationCompat.MessagingStyle style = new NotificationCompat.MessagingStyle(me)
            .setGroupConversation(false);
        for (StoredMessage item : messages) {
            Person person = sender;
            style.addMessage(new NotificationCompat.MessagingStyle.Message(item.body, item.timestamp, person));
        }

        PendingIntent contentIntent = PendingIntent.getActivity(
            this,
            stableId(conversationKey + ":open"),
            buildOpenIntent(data, remoteMessage, notificationId, "open_chat"),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(contentIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setDefaults(NotificationCompat.DEFAULT_SOUND | NotificationCompat.DEFAULT_VIBRATE)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setStyle(style)
            .addPerson(sender)
            .setShortcutInfo(shortcut)
            .setShortcutId(shortcutId)
            .setLocusId(locusId)
            .setWhen(timestamp)
            .setShowWhen(true)
            .setNumber(messages.size());

        // Android/launchers podem usar o avatar como fallback quando o shortcut ainda não foi indexado.
        if (avatar != null) builder.setLargeIcon(avatar);

        addConversationActions(builder, data, remoteMessage, notificationId, coupleId, senderUid, conversationKey);

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        // Um ID estável por conversa faz novas mensagens atualizarem o mesmo cartão,
        // em vez de criar várias notificações separadas do mesmo parceiro.
        manager.notify(stableId(conversationKey), builder.build());
    }

    private void showStandardNotification(
        Map<String, String> data,
        RemoteMessage remoteMessage,
        String channelId,
        String notificationId,
        String coupleId,
        String title,
        String body,
        String type,
        Bitmap avatar
    ) {
        Intent openIntent = buildOpenIntent(data, remoteMessage, notificationId, "open");
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            stableId(notificationId),
            openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_SOCIAL)
            .setDefaults(NotificationCompat.DEFAULT_SOUND | NotificationCompat.DEFAULT_VIBRATE)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setContentTitle(title)
            .setContentText(body);

        if (avatar != null) builder.setLargeIcon(avatar);
        if (!coupleId.isEmpty()) builder.setGroup("elo-couple-" + coupleId);

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        manager.notify(stableId(notificationId), builder.build());
    }

    private void addConversationActions(
        NotificationCompat.Builder builder,
        Map<String, String> data,
        RemoteMessage remoteMessage,
        String notificationId,
        String coupleId,
        String senderUid,
        String conversationKey
    ) {
        RemoteInput remoteInput = new RemoteInput.Builder(REMOTE_INPUT_KEY)
            .setLabel("Responder")
            .build();

        Intent replyIntent = buildOpenIntent(data, remoteMessage, notificationId, "reply");
        replyIntent.putExtra("coupleId", coupleId);
        replyIntent.putExtra("senderUid", senderUid);
        PendingIntent replyPendingIntent = PendingIntent.getActivity(
            this,
            stableId(conversationKey + ":reply"),
            replyIntent,
            mutableUpdateFlags()
        );
        NotificationCompat.Action replyAction = new NotificationCompat.Action.Builder(
            0,
            "Responder",
            replyPendingIntent
        ).addRemoteInput(remoteInput).setAllowGeneratedReplies(true).build();

        Intent readIntent = buildOpenIntent(data, remoteMessage, notificationId, "mark_read");
        readIntent.putExtra("coupleId", coupleId);
        readIntent.putExtra("senderUid", senderUid);
        PendingIntent readPendingIntent = PendingIntent.getActivity(
            this,
            stableId(conversationKey + ":read"),
            readIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        NotificationCompat.Action readAction = new NotificationCompat.Action.Builder(
            0,
            "Marcar como lida",
            readPendingIntent
        ).build();

        builder.addAction(replyAction).addAction(readAction);
    }

    private Intent buildOpenIntent(Map<String, String> data, RemoteMessage remoteMessage, String notificationId, String action) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        intent.putExtra("google.message_id", clean(remoteMessage.getMessageId(), notificationId));
        intent.putExtra("elo_notification_action", action);
        for (Map.Entry<String, String> entry : data.entrySet()) {
            intent.putExtra(entry.getKey(), entry.getValue());
        }
        return intent;
    }

    private List<StoredMessage> appendConversationHistory(String conversationKey, String body, long timestamp, String senderName, String senderUid) {
        SharedPreferences prefs = getSharedPreferences(HISTORY_PREFS, MODE_PRIVATE);
        String prefKey = "history_" + Integer.toHexString(conversationKey.hashCode());
        List<StoredMessage> result = new ArrayList<>();
        try {
            JSONArray array = new JSONArray(prefs.getString(prefKey, "[]"));
            for (int i = Math.max(0, array.length() - (MAX_HISTORY - 1)); i < array.length(); i++) {
                JSONObject obj = array.optJSONObject(i);
                if (obj == null) continue;
                result.add(new StoredMessage(
                    obj.optString("body", ""),
                    obj.optLong("timestamp", System.currentTimeMillis()),
                    obj.optString("senderName", senderName),
                    obj.optString("senderUid", senderUid)
                ));
            }
        } catch (Exception ignored) {}

        result.add(new StoredMessage(body, timestamp, senderName, senderUid));
        while (result.size() > MAX_HISTORY) result.remove(0);

        try {
            JSONArray out = new JSONArray();
            for (StoredMessage item : result) {
                JSONObject obj = new JSONObject();
                obj.put("body", item.body);
                obj.put("timestamp", item.timestamp);
                obj.put("senderName", item.senderName);
                obj.put("senderUid", item.senderUid);
                out.put(obj);
            }
            prefs.edit().putString(prefKey, out.toString()).apply();
        } catch (Exception ignored) {}
        return result;
    }

    private boolean isConversationType(String type) {
        return "chat".equals(type) || "chat_image".equals(type) || "chat_audio".equals(type) || "messages".equals(type);
    }

    private String channelFor(String type) {
        if (isConversationType(type)) return "elo_messages";
        if ("gift".equals(type) || "gifts".equals(type) || "vouchers".equals(type)) return "elo_gifts";
        if ("checkin".equals(type) || "streak".equals(type)) return "elo_streak";
        return DEFAULT_CHANNEL;
    }

    private String conversationKey(String coupleId, String senderUid) {
        String couple = clean(coupleId, "solo");
        String sender = clean(senderUid, "partner");
        return "elo-conversation:" + couple + ":" + sender;
    }

    private Bitmap loadCachedAvatar(String senderUid) {
        if (senderUid == null || senderUid.trim().isEmpty()) return null;
        try {
            File file = EloAvatarPlugin.avatarFile(this, senderUid.trim());
            if (!file.exists() || file.length() <= 0) return null;
            return BitmapFactory.decodeFile(file.getAbsolutePath());
        } catch (Exception ignored) {
            return null;
        }
    }

    private Bitmap loadHttpsBitmap(String value) {
        if (value == null || !value.startsWith("https://")) return null;
        HttpURLConnection connection = null;
        try {
            URL url = new URL(value);
            connection = (HttpURLConnection) url.openConnection();
            connection.setConnectTimeout(3500);
            connection.setReadTimeout(3500);
            connection.setInstanceFollowRedirects(true);
            connection.connect();
            if (connection.getResponseCode() < 200 || connection.getResponseCode() >= 300) return null;
            String contentType = connection.getContentType();
            if (contentType != null && !contentType.toLowerCase().startsWith("image/")) return null;
            try (InputStream stream = connection.getInputStream()) {
                return BitmapFactory.decodeStream(stream);
            }
        } catch (Exception ignored) {
            return null;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private static String clean(String value, String fallback) {
        if (value == null) return fallback == null ? "" : fallback;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? (fallback == null ? "" : fallback) : trimmed;
    }

    private static int stableId(String value) {
        return value == null ? (int) (System.currentTimeMillis() & 0x7fffffff) : value.hashCode() & 0x7fffffff;
    }

    private static long parseLong(String value, long fallback) {
        try { return Long.parseLong(value); } catch (Exception ignored) { return fallback; }
    }

    private static int mutableUpdateFlags() {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags |= PendingIntent.FLAG_MUTABLE;
        return flags;
    }

    private static class StoredMessage {
        final String body;
        final long timestamp;
        final String senderName;
        final String senderUid;

        StoredMessage(String body, long timestamp, String senderName, String senderUid) {
            this.body = body;
            this.timestamp = timestamp;
            this.senderName = senderName;
            this.senderUid = senderUid;
        }
    }
}
