package br.com.eloapp;

import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;

@CapacitorPlugin(name = "EloAppUpdater")
public class EloAppUpdaterPlugin extends Plugin {
    private long downloadId = -1L;
    private BroadcastReceiver receiver;

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url", "");
        String version = call.getString("version", "update");
        if (url == null || !url.startsWith("https://")) {
            call.reject("URL de atualização inválida.");
            return;
        }

        try {
            DownloadManager manager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
            if (manager == null) {
                call.reject("Gerenciador de downloads indisponível.");
                return;
            }

            File dir = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            if (dir == null) {
                call.reject("Diretório de atualização indisponível.");
                return;
            }
            File apk = new File(dir, "elo-update.apk");
            if (apk.exists()) apk.delete();

            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            request.setTitle("Atualização do Elo " + version);
            request.setDescription("Baixando nova versão do Elo…");
            request.setMimeType("application/vnd.android.package-archive");
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setAllowedOverMetered(true);
            request.setAllowedOverRoaming(false);
            request.setDestinationUri(Uri.fromFile(apk));

            unregisterReceiver();
            receiver = new BroadcastReceiver() {
                @Override public void onReceive(Context context, Intent intent) {
                    long completedId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L);
                    if (completedId != downloadId) return;
                    unregisterReceiver();
                    if (isSuccessful(manager, completedId)) {
                        notifyListeners("downloadComplete", new JSObject().put("success", true));
                        launchInstaller(apk);
                    } else {
                        notifyListeners("downloadComplete", new JSObject().put("success", false));
                    }
                }
            };
            IntentFilter filter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                getContext().registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED);
            } else {
                getContext().registerReceiver(receiver, filter);
            }

            downloadId = manager.enqueue(request);
            JSObject ret = new JSObject();
            ret.put("started", true);
            ret.put("downloadId", downloadId);
            call.resolve(ret);
        } catch (Exception error) {
            unregisterReceiver();
            call.reject("Não foi possível iniciar a atualização: " + error.getMessage());
        }
    }

    private boolean isSuccessful(DownloadManager manager, long id) {
        try (Cursor cursor = manager.query(new DownloadManager.Query().setFilterById(id))) {
            if (cursor != null && cursor.moveToFirst()) {
                int index = cursor.getColumnIndex(DownloadManager.COLUMN_STATUS);
                return index >= 0 && cursor.getInt(index) == DownloadManager.STATUS_SUCCESSFUL;
            }
        } catch (Exception ignored) {}
        return false;
    }

    private void launchInstaller(File apk) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !getContext().getPackageManager().canRequestPackageInstalls()) {
                Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
                settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(settings);
                return;
            }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
            Intent install = new Intent(Intent.ACTION_VIEW);
            install.setDataAndType(uri, "application/vnd.android.package-archive");
            install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(install);
        } catch (Exception error) {
            notifyListeners("installError", new JSObject().put("message", String.valueOf(error.getMessage())));
        }
    }

    @PluginMethod
    public void openInstaller(PluginCall call) {
        File dir = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        File apk = dir == null ? null : new File(dir, "elo-update.apk");
        if (apk == null || !apk.exists()) {
            call.reject("Atualização ainda não foi baixada.");
            return;
        }
        launchInstaller(apk);
        call.resolve();
    }

    private void unregisterReceiver() {
        if (receiver == null) return;
        try { getContext().unregisterReceiver(receiver); } catch (Exception ignored) {}
        receiver = null;
    }

    @Override
    protected void handleOnDestroy() {
        unregisterReceiver();
        super.handleOnDestroy();
    }
}
