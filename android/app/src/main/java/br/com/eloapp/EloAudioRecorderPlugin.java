package br.com.eloapp;

import android.Manifest;
import android.content.pm.PackageManager;
import android.media.MediaRecorder;
import android.os.Build;
import android.util.Base64;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.ByteArrayOutputStream;
import java.io.FileInputStream;

/**
 * Gravador de voz nativo do Elo.
 *
 * O Android WebView varia bastante no suporte a MediaRecorder/getUserMedia.
 * Este plugin grava AAC/M4A diretamente pelo Android e devolve o arquivo ao JS,
 * que mantém o mesmo fluxo de upload privado no R2 + Firestore usado pelo site.
 */
@CapacitorPlugin(name = "EloAudioRecorder")
public class EloAudioRecorderPlugin extends Plugin {
    private MediaRecorder recorder;
    private File outputFile;
    private long startedAt;

    @PluginMethod
    public void startRecording(PluginCall call) {
        if (recorder != null) {
            call.reject("Já existe uma gravação em andamento.");
            return;
        }
        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            call.reject("Permissão de microfone não concedida.");
            return;
        }

        try {
            outputFile = new File(getContext().getCacheDir(), "elo_voice_" + System.currentTimeMillis() + ".m4a");
            recorder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                ? new MediaRecorder(getContext())
                : new MediaRecorder();

            recorder.setAudioSource(MediaRecorder.AudioSource.MIC);
            recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            recorder.setAudioChannels(1);
            recorder.setAudioSamplingRate(44100);
            recorder.setAudioEncodingBitRate(32000);
            recorder.setOutputFile(outputFile.getAbsolutePath());
            recorder.prepare();
            recorder.start();
            startedAt = System.currentTimeMillis();

            JSObject result = new JSObject();
            result.put("started", true);
            call.resolve(result);
        } catch (Exception e) {
            cleanupRecorder(true);
            call.reject("Falha ao iniciar gravador nativo: " + safeMessage(e), e);
        }
    }

    @PluginMethod
    public void stopRecording(PluginCall call) {
        if (recorder == null || outputFile == null) {
            call.reject("Nenhuma gravação em andamento.");
            return;
        }

        long durationMs = Math.max(0L, System.currentTimeMillis() - startedAt);
        File finishedFile = outputFile;
        try {
            recorder.stop();
            recorder.release();
            recorder = null;
            outputFile = null;

            byte[] bytes;
            try (FileInputStream input = new FileInputStream(finishedFile); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[8192];
                int read;
                while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
                bytes = output.toByteArray();
            }
            if (bytes.length == 0) throw new IllegalStateException("arquivo de áudio vazio");

            JSObject result = new JSObject();
            result.put("base64", Base64.encodeToString(bytes, Base64.NO_WRAP));
            result.put("mimeType", "audio/mp4");
            result.put("fileName", "audio.m4a");
            result.put("size", bytes.length);
            result.put("duration", Math.max(1d, durationMs / 1000d));
            call.resolve(result);
        } catch (Exception e) {
            cleanupRecorder(false);
            call.reject("Falha ao finalizar gravador nativo: " + safeMessage(e), e);
        } finally {
            try { if (finishedFile.exists()) finishedFile.delete(); } catch (Exception ignored) {}
            startedAt = 0L;
        }
    }

    @PluginMethod
    public void cancelRecording(PluginCall call) {
        cleanupRecorder(true);
        JSObject result = new JSObject();
        result.put("cancelled", true);
        call.resolve(result);
    }

    @Override
    protected void handleOnDestroy() {
        cleanupRecorder(true);
        super.handleOnDestroy();
    }

    private void cleanupRecorder(boolean deleteFile) {
        if (recorder != null) {
            try { recorder.stop(); } catch (Exception ignored) {}
            try { recorder.reset(); } catch (Exception ignored) {}
            try { recorder.release(); } catch (Exception ignored) {}
            recorder = null;
        }
        if (deleteFile && outputFile != null) {
            try { if (outputFile.exists()) outputFile.delete(); } catch (Exception ignored) {}
        }
        outputFile = null;
        startedAt = 0L;
    }

    private String safeMessage(Exception e) {
        String message = e.getMessage();
        return message == null || message.trim().isEmpty() ? e.getClass().getSimpleName() : message;
    }
}
