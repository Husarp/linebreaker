package com.husarp.linebreaker;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.os.SystemClock;
import android.provider.Settings;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import androidx.core.content.pm.PackageInfoCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;

@CapacitorPlugin(name = "AppUpdate")
public final class AppUpdatePlugin extends Plugin {
    private final AtomicBoolean busy = new AtomicBoolean();

    private File cache() {
        return new File(getContext().getCacheDir(), "apk-updates");
    }

    private File cachedApk() {
        return new File(cache(), BuildConfig.VERSION_CODE + "-update.apk");
    }

    @Override
    public void load() {
        File[] files = cache().listFiles();
        if (files == null) return;
        for (File file : files) {
            if (!file.equals(cachedApk())) file.delete();
        }
    }

    @PluginMethod
    public void getInfo(PluginCall call) {
        JSObject result = new JSObject();
        result.put("version", BuildConfig.VERSION_NAME);
        result.put("repo", BuildConfig.UPDATE_REPO);
        call.resolve(result);
    }

    @PluginMethod
    public void openReleases(PluginCall call) {
        if (BuildConfig.UPDATE_REPO.isEmpty()) {
            call.reject("This build has no GitHub release repository configured.");
            return;
        }
        getActivity().runOnUiThread(() -> {
            try {
                getActivity().startActivity(new Intent(Intent.ACTION_VIEW,
                    Uri.parse("https://github.com/" + BuildConfig.UPDATE_REPO + "/releases")));
                call.resolve();
            } catch (RuntimeException error) {
                call.reject("No app could open the GitHub releases page.");
            }
        });
    }

    private URL releaseUrl(PluginCall call) throws IOException {
        URL url = new URL(call.getString("url", ""));
        List<String> parts = Uri.parse(url.toString()).getPathSegments();
        String version = call.getString("version", "");
        if (!"github.com".equalsIgnoreCase(url.getHost()) || parts.size() != 6
                || !(parts.get(0) + "/" + parts.get(1)).equalsIgnoreCase(BuildConfig.UPDATE_REPO)
                || !"releases".equals(parts.get(2)) || !"download".equals(parts.get(3))
                || !version.equals(parts.get(4).replaceFirst("^[vV]", ""))
                || !parts.get(5).toLowerCase(Locale.ROOT).endsWith(".apk")) {
            throw new IOException("GitHub did not return a valid Android release file.");
        }
        return url;
    }

    private HttpURLConnection connect(URL url) throws IOException {
        for (int redirects = 0; redirects <= 5; redirects++) {
            String host = url.getHost().toLowerCase(Locale.ROOT);
            if (!"https".equals(url.getProtocol()) || url.getUserInfo() != null
                    || (url.getPort() != -1 && url.getPort() != 443)
                    || !(host.equals("github.com") || host.equals("release-assets.githubusercontent.com")
                        || host.equals("objects.githubusercontent.com"))) {
                throw new IOException("GitHub redirected to an unexpected download location.");
            }
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(15_000);
            connection.setReadTimeout(30_000);
            try {
                int response = connection.getResponseCode();
                if (response == HttpURLConnection.HTTP_OK) return connection;
                String location = connection.getHeaderField("Location");
                if (response < 300 || response >= 400 || location == null) {
                    throw new IOException("GitHub could not provide the APK (HTTP " + response + ").");
                }
                url = new URL(url, location);
            } catch (IOException error) {
                connection.disconnect();
                throw error;
            }
            connection.disconnect();
        }
        throw new IOException("GitHub redirected the download too many times.");
    }

    private boolean matches(File file, PluginCall call) {
        long size = call.getData().optLong("size");
        if (!file.isFile() || size <= 0 || file.length() != size) return false;
        PackageInfo apk = getContext().getPackageManager().getPackageArchiveInfo(file.getPath(), 0);
        return apk != null && getContext().getPackageName().equals(apk.packageName)
            && call.getString("version", "").equals(apk.versionName)
            && PackageInfoCompat.getLongVersionCode(apk) > BuildConfig.VERSION_CODE;
    }

    private void progress(long done, long total) {
        JSObject event = new JSObject();
        event.put("done", done);
        event.put("total", total);
        getBridge().execute(() -> notifyListeners("downloadProgress", event));
    }

    private void saveApk(URL url, File partial, long total) throws IOException {
        HttpURLConnection connection = connect(url);
        try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(partial)) {
            byte[] buffer = new byte[65_536];
            long done = 0;
            long lastReport = 0;
            int count;
            while ((count = input.read(buffer)) != -1) {
                done += count;
                if (done > total) throw new IOException("The APK is larger than GitHub reported.");
                output.write(buffer, 0, count);
                long now = SystemClock.elapsedRealtime();
                if (now - lastReport >= 200 || done == total) {
                    progress(done, total);
                    lastReport = now;
                }
            }
        } finally {
            connection.disconnect();
        }
    }

    @PluginMethod
    public void download(PluginCall call) {
        if (!busy.compareAndSet(false, true)) {
            call.reject("Another update operation is already running.");
            return;
        }
        new Thread(() -> {
            File partial = new File(cache(), "partial.apk");
            String failure = null;
            try {
                URL url = releaseUrl(call);
                if (!matches(cachedApk(), call)) {
                    long size = call.getData().optLong("size");
                    if (size <= 0) throw new IOException("GitHub did not report the APK size.");
                    if (!cache().isDirectory() && !cache().mkdirs()) {
                        throw new IOException("Could not open the app's update cache.");
                    }
                    saveApk(url, partial, size);
                    if (!matches(partial, call)) {
                        throw new IOException("The APK is incomplete or does not match this Linebreaker update.");
                    }
                    if (!partial.renameTo(cachedApk())) throw new IOException("Could not save the update in the app's cache.");
                }
            } catch (IOException | RuntimeException error) {
                failure = error instanceof IOException && error.getMessage() != null
                    ? error.getMessage() : "Could not download the update. Check your connection and free space.";
            } finally {
                partial.delete();
                busy.set(false);
            }
            if (failure == null) call.resolve();
            else call.reject(failure);
        }, "Linebreaker APK download").start();
    }

    private boolean canInstall() {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.O || getContext().getPackageManager().canRequestPackageInstalls();
    }

    private void failInstall(PluginCall call, String message) {
        busy.set(false);
        if (call != null) call.reject(message);
    }

    private void installState(String phase) {
        JSObject event = new JSObject();
        event.put("phase", phase);
        getBridge().execute(() -> notifyListeners("installState", event));
    }

    @PluginMethod
    public void install(PluginCall call) {
        if (!busy.compareAndSet(false, true)) {
            call.reject("Another update operation is already running.");
            return;
        }
        try {
            if (!matches(cachedApk(), call)) {
                failInstall(call, "The cached update is missing or incomplete. Download it again.");
                return;
            }
        } catch (RuntimeException error) {
            failInstall(call, "Could not read the cached update. Download it again.");
            return;
        }
        getActivity().runOnUiThread(() -> {
            if (canInstall()) {
                openInstaller(call);
                return;
            }
            try {
                installState("permission");
                Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getContext().getPackageName()));
                startActivityForResult(call, settings, "permissionReturned");
            } catch (RuntimeException error) {
                failInstall(call, "Could not open Android's install permission settings.");
            }
        });
    }

    @ActivityCallback
    private void permissionReturned(PluginCall call, ActivityResult result) {
        if (call == null || !canInstall()) {
            failInstall(call, "Allow Linebreaker to install unknown apps, then try again.");
            return;
        }
        openInstaller(call);
    }

    private void openInstaller(PluginCall call) {
        try {
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".updates", cachedApk());
            Intent installer = new Intent(Intent.ACTION_INSTALL_PACKAGE, uri);
            installer.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            installer.putExtra(Intent.EXTRA_RETURN_RESULT, true);
            installState("installer");
            startActivityForResult(call, installer, "installerReturned");
        } catch (RuntimeException error) {
            failInstall(call, "Could not open Android's installer.");
        }
    }

    @ActivityCallback
    private void installerReturned(PluginCall call, ActivityResult result) {
        busy.set(false);
        if (call == null) return;
        if (result.getResultCode() == Activity.RESULT_OK) call.resolve();
        else call.reject("The update was canceled or Android could not install it.");
    }
}
