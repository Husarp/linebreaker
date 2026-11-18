using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Threading;
using Microsoft.Win32;

internal sealed class Installation
{
    private const string AppExe = "linebreaker.exe";
    private const string Uninstaller = "uninstall.exe";
    private const string RegistryPath = @"Software\Microsoft\Windows\CurrentVersion\Uninstall\Linebreaker";
    private const string WebViewPath = @"SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}";
    private const string DataId = "com.husarp.linebreaker";
    private readonly string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
    private readonly string roaming = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
    private readonly string startMenu = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "Linebreaker.lnk");
    private readonly string desktop = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), "Linebreaker.lnk");
    private readonly string setupPath = System.Reflection.Assembly.GetExecutingAssembly().Location;
    private readonly string target;
    internal readonly string Version;
    internal readonly string PreviousVersion;

    internal Installation(string version)
    {
        Version = version;
        string location = null;
        using (var key = Registry.CurrentUser.OpenSubKey(RegistryPath))
        {
            if (key != null)
            {
                PreviousVersion = key.GetValue("DisplayVersion") as string;
                location = key.GetValue("InstallLocation") as string;
            }
        }
        target = String.IsNullOrEmpty(location) ? Path.Combine(local, "Linebreaker") : Path.GetFullPath(location.Trim('"'));
        if (Path.GetPathRoot(target) == target || String.Equals(target, local, StringComparison.OrdinalIgnoreCase) ||
            String.Equals(target, roaming, StringComparison.OrdinalIgnoreCase) || IsReparsePoint(target))
            throw new InvalidOperationException("The registered Linebreaker install folder is not safe to replace.");
    }

    internal bool IsInstalled { get { return !String.IsNullOrEmpty(PreviousVersion); } }
    private string Game { get { return Path.Combine(target, AppExe); } }

    internal bool IsRunning()
    {
        var processes = FindGame();
        foreach (var process in processes) process.Dispose();
        return processes.Count > 0;
    }

    private List<Process> FindGame()
    {
        var found = new List<Process>();
        foreach (var process in Process.GetProcessesByName(Path.GetFileNameWithoutExtension(AppExe)))
        {
            try
            {
                if (String.Equals(process.MainModule.FileName, Game, StringComparison.OrdinalIgnoreCase))
                {
                    found.Add(process);
                    continue;
                }
            }
            catch (InvalidOperationException) { }
            catch (System.ComponentModel.Win32Exception) { }
            process.Dispose();
        }
        return found;
    }

    private void StopGame(bool close, int handoffPid)
    {
        if (handoffPid > 0)
        {
            try
            {
                using (var parent = Process.GetProcessById(handoffPid))
                {
                    if (String.Equals(parent.MainModule.FileName, Game, StringComparison.OrdinalIgnoreCase) && !parent.WaitForExit(15000))
                        throw new IOException("Linebreaker did not exit. Close it, then try again.");
                }
            }
            catch (ArgumentException) { }
            catch (InvalidOperationException) { }
        }
        var processes = FindGame();
        try
        {
            foreach (var process in processes)
            {
                if (close && !process.HasExited) process.CloseMainWindow();
                if (!process.WaitForExit(15000)) throw new IOException("Linebreaker is still running. Close it, then try again.");
            }
        }
        finally { foreach (var process in processes) process.Dispose(); }
    }

    internal void Run()
    {
        using (Process.Start(new ProcessStartInfo(Game) { WorkingDirectory = target, UseShellExecute = false })) { }
    }

    internal void Apply(bool uninstall, bool deleteData, bool auto, bool close, int handoffPid, Action<int, string> report)
    {
        var undo = new Stack<Action>();
        var extra = new List<string>();
        var progress = 0;
        var total = 1;
        Action<string> step = text => report(progress++ * 100 / total, text);
        var hadGame = File.Exists(Game);
        try
        {
            if (Directory.Exists(target) && !hadGame)
                throw new IOException("The installation folder contains no Linebreaker executable. Move the folder out of the way before trying again.");
            System.Version previous, next;
            if (!uninstall && System.Version.TryParse(PreviousVersion, out previous) && System.Version.TryParse(Version, out next) && next < previous)
                throw new InvalidOperationException("A newer version is already installed. Uninstall it before installing an older version.");

            var payload = Path.Combine(Path.GetDirectoryName(setupPath), "payload");
            var files = uninstall ? new string[0] : Directory.GetFiles(payload, "*", SearchOption.AllDirectories);
            total = uninstall ? 5 : files.Length + 6;
            step("Closing Linebreaker");
            StopGame(close, handoffPid);
            if (!uninstall)
            {
                step("Checking the Microsoft Edge WebView2 Runtime");
                EnsureWebView();
                var staged = target + ".setup-" + Guid.NewGuid().ToString("N");
                extra.Add(staged);
                Directory.CreateDirectory(staged);
                foreach (var file in files)
                {
                    var relative = file.Substring(payload.Length + 1);
                    step("Copying " + relative);
                    var destination = Path.Combine(staged, relative);
                    Directory.CreateDirectory(Path.GetDirectoryName(destination));
                    File.Copy(file, destination);
                }
                if (!File.Exists(Path.Combine(staged, AppExe))) throw new IOException("The setup payload is missing " + AppExe + ".");
                if (!File.Exists(Path.Combine(staged, Uninstaller))) throw new IOException("The setup payload is missing the uninstaller.");
                step("Replacing program files");
                MoveAside(target, undo, extra);
                Directory.Move(staged, target);
                undo.Push(() => Directory.Move(target, staged));
            }
            else
            {
                step("Removing program files");
                MoveAside(target, undo, extra);
            }

            step(uninstall ? "Removing Windows registration" : "Registering Linebreaker with Windows");
            ChangeRegistration(uninstall, undo);
            step(uninstall ? "Removing shortcuts" : "Creating the Start menu shortcut");
            MoveAside(startMenu, undo, extra);
            if (uninstall) MoveAside(desktop, undo, extra);
            else
            {
                undo.Push(() => File.Delete(startMenu));
                CreateShortcut(startMenu);
            }

            if (uninstall)
            {
                step(deleteData ? "Removing player data" : "Keeping player data");
                if (deleteData)
                {
                    MoveAside(Path.Combine(roaming, DataId), undo, extra);
                    if (!String.Equals(local, roaming, StringComparison.OrdinalIgnoreCase)) MoveAside(Path.Combine(local, DataId), undo, extra);
                }
            }
            else
            {
                step(auto ? "Starting Linebreaker" : "Finishing setup");
                if (auto) Run();
            }
        }
        catch (Exception error)
        {
            var failures = new List<string>();
            report(progress * 100 / total, "Setup failed: " + error);
            while (undo.Count > 0)
            {
                try { undo.Pop()(); }
                catch (Exception rollback) { failures.Add(rollback.Message); }
            }
            if (failures.Count == 0) Cleanup(extra, report);
            if (hadGame && File.Exists(Game) && !IsRunning())
            {
                try { Run(); report(0, "Started the previous version of Linebreaker."); }
                catch (Exception restart) { failures.Add(restart.Message); }
            }
            if (failures.Count > 0)
                throw new IOException(error.Message + " Recovery needs attention: " + String.Join("; ", failures) +
                    ". Any remaining backup folders are next to their original paths.", error);
            throw;
        }
        Cleanup(extra, report);
        report(100, uninstall ? "Linebreaker was uninstalled" : "Installation complete");
    }

    private static bool IsReparsePoint(string path)
    {
        return Directory.Exists(path) && (File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0;
    }

    private static void MoveAside(string path, Stack<Action> undo, List<string> extra)
    {
        var backup = path + ".backup-" + Guid.NewGuid().ToString("N");
        if (Directory.Exists(path))
        {
            if (IsReparsePoint(path)) throw new IOException("Setup cannot move a redirected folder: " + path);
            Directory.Move(path, backup);
            undo.Push(() => Directory.Move(backup, path));
        }
        else if (File.Exists(path))
        {
            File.Move(path, backup);
            undo.Push(() => File.Move(backup, path));
        }
        else return;
        extra.Add(backup);
    }

    private static void Cleanup(IEnumerable<string> paths, Action<int, string> report)
    {
        foreach (var path in paths)
        {
            try
            {
                if (Directory.Exists(path)) Directory.Delete(path, true);
                else File.Delete(path);
            }
            catch (Exception error) { report(-1, "Could not remove " + path + ": " + error.Message); }
        }
    }

    private void ChangeRegistration(bool uninstall, Stack<Action> undo)
    {
        var original = new Dictionary<string, Tuple<object, RegistryValueKind>>();
        bool existed;
        using (var key = Registry.CurrentUser.OpenSubKey(RegistryPath))
        {
            existed = key != null;
            if (existed)
                foreach (var name in key.GetValueNames())
                    original[name] = Tuple.Create(key.GetValue(name, null, RegistryValueOptions.DoNotExpandEnvironmentNames), key.GetValueKind(name));
        }
        undo.Push(() =>
        {
            Registry.CurrentUser.DeleteSubKey(RegistryPath, false);
            if (existed)
                using (var key = Registry.CurrentUser.CreateSubKey(RegistryPath))
                    foreach (var entry in original) key.SetValue(entry.Key, entry.Value.Item1, entry.Value.Item2);
        });
        if (uninstall) Registry.CurrentUser.DeleteSubKey(RegistryPath, false);
        else using (var key = Registry.CurrentUser.CreateSubKey(RegistryPath))
        {
            key.SetValue("DisplayName", "Linebreaker");
            key.SetValue("DisplayVersion", Version);
            key.SetValue("InstallLocation", target);
            key.SetValue("DisplayIcon", Quote(Game));
            key.SetValue("UninstallString", Quote(Path.Combine(target, Uninstaller)) + " --uninstall");
            key.DeleteValue("QuietUninstallString", false);
            key.SetValue("NoModify", 1);
            key.SetValue("NoRepair", 1);
        }
    }

    private void CreateShortcut(string path)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path));
        var shell = Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell", true));
        dynamic shortcut = null;
        try
        {
            shortcut = ((dynamic)shell).CreateShortcut(path);
            shortcut.TargetPath = Game;
            shortcut.WorkingDirectory = target;
            shortcut.Save();
        }
        finally
        {
            if ((object)shortcut != null) System.Runtime.InteropServices.Marshal.FinalReleaseComObject((object)shortcut);
            System.Runtime.InteropServices.Marshal.FinalReleaseComObject(shell);
        }
    }

    private static bool HasWebView()
    {
        foreach (var hive in new[] { RegistryHive.LocalMachine, RegistryHive.CurrentUser })
            foreach (var view in new[] { RegistryView.Registry32, RegistryView.Registry64 })
                using (var root = RegistryKey.OpenBaseKey(hive, view))
                using (var key = root.OpenSubKey(WebViewPath))
                {
                    System.Version installed;
                    if (key != null && System.Version.TryParse(key.GetValue("pv") as string, out installed) && installed.Major > 0) return true;
                }
        return false;
    }

    private void EnsureWebView()
    {
        if (HasWebView()) return;
        var info = new ProcessStartInfo(Path.Combine(Path.GetDirectoryName(setupPath), "WebView2Setup.exe"), "/silent /install") { UseShellExecute = false };
        using (var process = Process.Start(info))
        {
            if (!process.WaitForExit(300000)) throw new IOException("WebView2 setup took too long. Check your connection and try again.");
            if (!HasWebView()) throw new IOException("WebView2 could not be installed. Check your connection and try again (exit code " + process.ExitCode + ").");
        }
    }

    internal static string Quote(string value) { return "\"" + value + "\""; }
}
