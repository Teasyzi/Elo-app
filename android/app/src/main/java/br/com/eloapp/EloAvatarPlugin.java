package br.com.eloapp;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

@CapacitorPlugin(name = "EloAvatar")
public class EloAvatarPlugin extends Plugin {
    @PluginMethod
    public void cacheAvatar(PluginCall call) {
        String rawUserId = call.getString("userId");
        String rawPhoto = call.getString("photo");
        final String userId = rawUserId == null ? "" : rawUserId;
        final String photo = rawPhoto == null ? "" : rawPhoto;
        if (userId.isEmpty() || photo.isEmpty()) {
            call.reject("userId e photo são obrigatórios");
            return;
        }

        new Thread(() -> {
            try {
                Bitmap bitmap = decodePhoto(photo);
                if (bitmap == null) {
                    call.reject("Não foi possível decodificar o avatar");
                    return;
                }
                Bitmap resized = resize(bitmap, 192);
                File dir = new File(getContext().getFilesDir(), "elo_avatars");
                if (!dir.exists() && !dir.mkdirs()) {
                    call.reject("Não foi possível criar o cache de avatar");
                    return;
                }
                File target = new File(dir, safeName(userId) + ".png");
                try (FileOutputStream out = new FileOutputStream(target)) {
                    resized.compress(Bitmap.CompressFormat.PNG, 92, out);
                }
                if (resized != bitmap) resized.recycle();
                bitmap.recycle();
                JSObject result = new JSObject();
                result.put("cached", true);
                call.resolve(result);
            } catch (Exception e) {
                call.reject("Falha ao cachear avatar", e);
            }
        }).start();
    }

    private Bitmap decodePhoto(String photo) throws Exception {
        if (photo.startsWith("data:image/")) {
            int comma = photo.indexOf(',');
            if (comma < 0) return null;
            byte[] bytes = Base64.decode(photo.substring(comma + 1), Base64.DEFAULT);
            return BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
        }
        if (photo.startsWith("https://")) {
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(photo).openConnection();
                connection.setConnectTimeout(4000);
                connection.setReadTimeout(4000);
                connection.setInstanceFollowRedirects(true);
                connection.connect();
                int code = connection.getResponseCode();
                if (code < 200 || code >= 300) return null;
                try (InputStream input = connection.getInputStream()) {
                    return BitmapFactory.decodeStream(input);
                }
            } finally {
                if (connection != null) connection.disconnect();
            }
        }
        return null;
    }

    private Bitmap resize(Bitmap bitmap, int maxSize) {
        int width = bitmap.getWidth();
        int height = bitmap.getHeight();
        if (width <= maxSize && height <= maxSize) return bitmap;
        float scale = Math.min((float) maxSize / width, (float) maxSize / height);
        return Bitmap.createScaledBitmap(bitmap, Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)), true);
    }

    public static File avatarFile(android.content.Context context, String userId) {
        return new File(new File(context.getFilesDir(), "elo_avatars"), safeName(userId) + ".png");
    }

    private static String safeName(String value) {
        return value == null ? "unknown" : value.replaceAll("[^A-Za-z0-9_-]", "_");
    }
}
