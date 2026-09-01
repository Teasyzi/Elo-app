package br.com.eloapp;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;

import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;
import androidx.core.graphics.drawable.IconCompat;

import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.io.InputStream;
import java.io.File;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Map;

public class EloMessagingService extends FirebaseMessagingService {
    private static final String DEFAULT_CHANNEL = "elo_general";

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
        String senderPhotoUrl = clean(data.get("senderPhotoUrl"), "");
        String type = clean(data.get("type"), "system");
        String channelId = clean(data.get("channelId"), channelFor(type));
        String notificationId = clean(data.get("notificationId"), remoteMessage.getMessageId());
        String coupleId = clean(data.get("coupleId"), "");

        boolean isConversation = isConversationType(type);
        // A foto personalizada do perfil é cacheada pelo app no aparelho do parceiro.
        // Ela tem prioridade sobre a URL remota (ex.: foto Google).
        Bitmap avatar = loadCachedAvatar(data.get("senderUid"));
        if (avatar == null) avatar = loadHttpsBitmap(senderPhotoUrl);

        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        openIntent.putExtra("google.message_id", clean(remoteMessage.getMessageId(), notificationId));
        for (Map.Entry<String, String> entry : data.entrySet()) {
            openIntent.putExtra(entry.getKey(), entry.getValue());
        }
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
            .setCategory(isConversation ? NotificationCompat.CATEGORY_MESSAGE : NotificationCompat.CATEGORY_SOCIAL)
            .setDefaults(NotificationCompat.DEFAULT_SOUND | NotificationCompat.DEFAULT_VIBRATE)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setContentTitle(title)
            .setContentText(body);

        if (isConversation) {
            Person.Builder senderBuilder = new Person.Builder()
                .setName(senderName)
                .setKey(clean(data.get("senderUid"), senderName));
            if (avatar != null) senderBuilder.setIcon(IconCompat.createWithBitmap(avatar));
            Person sender = senderBuilder.build();
            Person me = new Person.Builder().setName("Você").setKey("elo-current-user").build();

            long timestamp = parseLong(data.get("sentAt"), System.currentTimeMillis());
            NotificationCompat.MessagingStyle style = new NotificationCompat.MessagingStyle(me)
                .setGroupConversation(false)
                .addMessage(new NotificationCompat.MessagingStyle.Message(body, timestamp, sender));
            builder.setStyle(style).addPerson(sender);
            // Alguns fabricantes só mostram Person.icon ao expandir. O large icon aumenta
            // a chance do avatar aparecer também no layout compacto sem substituir o small icon do Elo.
            if (avatar != null) builder.setLargeIcon(avatar);
        } else if (avatar != null) {
            // Presentes e demais eventos ainda podem exibir o avatar como large icon.
            builder.setLargeIcon(avatar);
        }

        if (!coupleId.isEmpty()) builder.setGroup("elo-couple-" + coupleId);

        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        manager.notify(stableId(notificationId), builder.build());
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
}
