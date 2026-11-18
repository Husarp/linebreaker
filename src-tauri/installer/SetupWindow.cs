using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Text;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;

internal sealed class SetupWindow : Form
{
    private readonly Installation installation;
    private readonly bool automatic;
    private readonly PrivateFontCollection fonts = new PrivateFontCollection();
    private readonly System.Collections.Generic.List<IntPtr> fontBuffers = new System.Collections.Generic.List<IntPtr>();
    private readonly TableLayoutPanel layout = new TableLayoutPanel();
    private readonly Label heading = new Label();
    private readonly Label message = new Label();
    private readonly ProgressBar progress = new ProgressBar();
    private readonly TextBox log = new TextBox();
    private readonly Button details = new Button();
    private readonly CheckBox option = new CheckBox();
    private readonly FlowLayoutPanel actions = new FlowLayoutPanel();
    private readonly Button primary = new Button();
    private readonly Button cancel = new Button();
    private readonly Button remove = new Button();
    private int handoffPid;
    private bool uninstall;
    private bool deleteData;
    private bool working;
    private bool attempted;

    internal int Result { get; private set; }

    [DllImport("dwmapi.dll")]
    private static extern int DwmSetWindowAttribute(IntPtr window, int attribute, ref int value, int size);
    [DllImport("uxtheme.dll", CharSet = CharSet.Unicode)]
    private static extern int SetWindowTheme(IntPtr window, string app, string list);
    [DllImport("user32.dll")]
    private static extern IntPtr SendMessage(IntPtr window, int message, IntPtr wParam, IntPtr lParam);

    [STAThread]
    private static int Main(string[] args)
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(true);
        try
        {
            var fromSetup = args.Length >= 2 && args[0] == "--setup";
            var flags = fromSetup ? args.Skip(2).ToArray() : args;
            var remove = !fromSetup || flags.Contains("--uninstall");
            var automatic = fromSetup && !remove && flags.Any(flag => flag == "--update" || String.Equals(flag, "/UPDATE", StringComparison.OrdinalIgnoreCase));
            var updateIndex = Array.IndexOf(flags, "--update");
            var waitPid = 0;
            if (updateIndex >= 0 && updateIndex + 1 < flags.Length) Int32.TryParse(flags[updateIndex + 1], out waitPid);
            var install = new Installation(fromSetup ? args[1] : null);
            if (!fromSetup && !install.IsInstalled) return 0;
            using (var mutex = new Mutex(false, @"Local\LinebreakerSetup"))
            {
                try
                {
                    if (!mutex.WaitOne(0))
                    {
                        MessageBox.Show("Linebreaker Setup is already open.", "Linebreaker Setup");
                        return 1;
                    }
                }
                catch (AbandonedMutexException) { }
                try
                {
                    using (var window = new SetupWindow(install, remove, automatic, waitPid))
                    {
                        Application.Run(window);
                        return window.Result;
                    }
                }
                finally { mutex.ReleaseMutex(); }
            }
        }
        catch (Exception error)
        {
            MessageBox.Show(error.Message, "Linebreaker Setup", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
    }

    private SetupWindow(Installation install, bool removeApp, bool update, int waitPid)
    {
        installation = install;
        uninstall = removeApp;
        automatic = update;
        handoffPid = waitPid;
        Text = "Linebreaker Setup";
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        AutoScaleDimensions = new SizeF(96, 96);
        AutoScaleMode = AutoScaleMode.Dpi;
        AutoSize = true;
        AutoSizeMode = AutoSizeMode.GrowAndShrink;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        StartPosition = FormStartPosition.CenterScreen;
        MaximizeBox = false;
        BackColor = SetupTheme.Surface;
        ForeColor = SetupTheme.Text;
        Font = ReadFont("Inter.ttf", 10);

        layout.Dock = DockStyle.Fill;
        layout.AutoSize = true;
        layout.ColumnCount = 1;
        layout.Padding = new Padding(24);
        Controls.Add(layout);

        var brand = new Label { Text = "LINEBREAKER", Font = ReadFont("Orbitron.ttf", 17), ForeColor = SetupTheme.Accent, AutoSize = true };
        var logo = new PictureBox { Image = Icon.ToBitmap(), SizeMode = PictureBoxSizeMode.Zoom, Size = new Size(32, 32) };
        var title = new FlowLayoutPanel { AutoSize = true, WrapContents = false, BackColor = SetupTheme.Surface };
        title.Controls.Add(logo);
        title.Controls.Add(brand);
        layout.Controls.Add(title);
        heading.Font = ReadFont("Orbitron.ttf", 13);
        heading.Margin = new Padding(3, 20, 3, 6);
        heading.AutoSize = true;
        message.MaximumSize = new Size(470, 0);
        message.MinimumSize = new Size(470, 36);
        message.ForeColor = SetupTheme.Muted;
        message.AutoSize = true;
        layout.Controls.Add(heading);
        layout.Controls.Add(message);

        progress.Dock = DockStyle.Fill;
        progress.Margin = new Padding(3, 8, 3, 8);
        progress.Style = ProgressBarStyle.Continuous;
        progress.HandleCreated += (sender, eventArgs) =>
        {
            SetWindowTheme(progress.Handle, "", "");
            SendMessage(progress.Handle, 0x0409, IntPtr.Zero, new IntPtr(ColorTranslator.ToWin32(SetupTheme.Accent)));
            SendMessage(progress.Handle, 0x2001, IntPtr.Zero, new IntPtr(ColorTranslator.ToWin32(SetupTheme.Button)));
        };
        layout.Controls.Add(progress);
        ThemeButton(details, false);
        details.Text = "Show details";
        details.Click += (sender, eventArgs) => ShowDetails(!log.Visible);
        layout.Controls.Add(details);
        log.Multiline = log.ReadOnly = true;
        log.ScrollBars = ScrollBars.Vertical;
        log.Height = 138;
        log.Dock = DockStyle.Fill;
        log.BackColor = SetupTheme.Button;
        log.ForeColor = SetupTheme.Text;
        layout.Controls.Add(log);
        option.AutoSize = true;
        layout.Controls.Add(option);

        actions.AutoSize = true;
        actions.FlowDirection = FlowDirection.LeftToRight;
        actions.WrapContents = false;
        actions.Margin = new Padding(0, 12, 0, 0);
        foreach (var button in new[] { primary, remove, cancel })
        {
            ThemeButton(button, button == primary);
            actions.Controls.Add(button);
        }
        layout.Controls.Add(actions);
        AcceptButton = primary;
        cancel.Click += (sender, eventArgs) => Close();
        cancel.DialogResult = DialogResult.Cancel;
        CancelButton = cancel;
        primary.Click += async (sender, eventArgs) => await Start();
        remove.Text = "Uninstall";
        remove.Click += (sender, eventArgs) => { uninstall = true; Welcome(); };
        FormClosing += (sender, eventArgs) => { if (working) eventArgs.Cancel = true; };
        HandleCreated += (sender, eventArgs) =>
        {
            var dark = 1;
            if (DwmSetWindowAttribute(Handle, 20, ref dark, sizeof(int)) != 0) DwmSetWindowAttribute(Handle, 19, ref dark, sizeof(int));
        };
        if (automatic)
        {
            ProgressPage();
            Shown += async (sender, eventArgs) => await Start();
        }
        else Welcome();
    }

    private Font ReadFont(string resource, float size)
    {
        using (var stream = typeof(SetupWindow).Assembly.GetManifestResourceStream(resource))
        {
            if (stream == null) throw new IOException(resource + " is missing from setup.");
            var bytes = new BinaryReader(stream).ReadBytes(checked((int)stream.Length));
            var buffer = Marshal.AllocCoTaskMem(bytes.Length);
            fontBuffers.Add(buffer);
            Marshal.Copy(bytes, 0, buffer, bytes.Length);
            var before = fonts.Families.Select(family => family.Name).ToArray();
            fonts.AddMemoryFont(buffer, bytes.Length);
            var added = fonts.Families.FirstOrDefault(family => !before.Contains(family.Name));
            var name = Path.GetFileNameWithoutExtension(resource);
            var match = added ?? fonts.Families.FirstOrDefault(family => family.Name.StartsWith(name, StringComparison.OrdinalIgnoreCase));
            return match == null ? new Font("Segoe UI", size) : new Font(match, size);
        }
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (!disposing) return;
        fonts.Dispose();
        foreach (var buffer in fontBuffers) Marshal.FreeCoTaskMem(buffer);
        fontBuffers.Clear();
    }

    private static void ThemeButton(Button button, bool main)
    {
        button.FlatStyle = FlatStyle.Flat;
        button.BackColor = main ? SetupTheme.Accent : SetupTheme.Button;
        button.ForeColor = main ? SetupTheme.Ink : SetupTheme.Text;
        button.FlatAppearance.BorderColor = main ? SetupTheme.Accent : SetupTheme.Border;
        button.AutoSize = true;
        button.Padding = new Padding(10, 3, 10, 3);
    }

    private void Welcome()
    {
        progress.Visible = details.Visible = false;
        ShowDetails(false);
        option.Visible = uninstall;
        option.Text = "Also delete my data";
        option.Checked = false;
        heading.Text = uninstall ? "Uninstall Linebreaker" : installation.IsInstalled ?
            "Update " + installation.PreviousVersion + " → " + installation.Version : "Install " + installation.Version;
        message.Text = uninstall ? "Remove Linebreaker from this computer. Your player data is kept unless you choose to delete it." :
            "Setup installs Linebreaker for your Windows account. Your saves are kept separately.";
        primary.Text = uninstall ? "Uninstall" : installation.IsInstalled ? "Update" : "Install";
        remove.Visible = installation.IsInstalled && !uninstall;
        cancel.Text = "Cancel";
    }

    private void ShowDetails(bool show)
    {
        details.Text = show ? "Hide details" : "Show details";
        log.Visible = show;
    }

    private void ProgressPage()
    {
        heading.Text = uninstall ? "Uninstalling Linebreaker" : installation.IsInstalled ? "Updating Linebreaker" : "Installing Linebreaker";
        message.Text = "Preparing setup…";
        progress.Visible = details.Visible = true;
        progress.Value = 0;
        log.Clear();
        ShowDetails(false);
        option.Visible = remove.Visible = primary.Visible = cancel.Visible = false;
    }

    private async Task Start()
    {
        if (working) return;
        if (primary.Text == "Finish")
        {
            try { if (option.Visible && option.Checked) installation.Run(); }
            catch (Exception error)
            {
                MessageBox.Show(this, "Linebreaker is installed but could not be started: " + error.Message, Text, MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }
            Close();
            return;
        }
        working = true;
        try
        {
            var close = automatic && attempted;
            if (!automatic && await Task.Run(() => installation.IsRunning()))
            {
                var next = uninstall ? "uninstall it." : "update it, then started again.";
                if (MessageBox.Show(this, "Linebreaker is running. It will be closed to " + next, Text,
                    MessageBoxButtons.OKCancel, MessageBoxIcon.Information) != DialogResult.OK) return;
                close = true;
            }
            if (!attempted) deleteData = uninstall && option.Checked;
            attempted = true;
            ProgressPage();
            var reporter = new Progress<Tuple<int, string>>(step =>
            {
                if (step.Item1 >= 0)
                {
                    message.Text = step.Item2.StartsWith("Setup failed:") ? "Setup could not finish." : step.Item2;
                    progress.Value = Math.Min(100, step.Item1);
                }
                log.AppendText(step.Item2 + Environment.NewLine);
            });
            await Task.Run(() => installation.Apply(uninstall, deleteData, automatic, close, handoffPid,
                (percent, text) => ((IProgress<Tuple<int, string>>)reporter).Report(Tuple.Create(percent, text))));
            Result = 0;
            if (automatic)
            {
                await Task.Delay(1100);
                working = false;
                Close();
            }
            else
            {
                heading.Text = uninstall ? "Linebreaker was uninstalled" : "Linebreaker " + installation.Version + " is installed";
                message.Text = uninstall ? (deleteData ? "Player data was removed." : "Player data was kept.") : "Setup is complete.";
                progress.Visible = false;
                option.Text = "Run Linebreaker now";
                option.Checked = option.Visible = !uninstall;
                primary.Text = "Finish";
                primary.Visible = true;
                primary.Focus();
            }
        }
        catch (Exception error)
        {
            Result = 1;
            heading.Text = "Setup could not finish";
            message.Text = error.Message;
            details.Visible = true;
            ShowDetails(true);
            primary.Text = "TRY AGAIN";
            primary.Visible = cancel.Visible = true;
            cancel.Text = "Close";
            primary.Focus();
        }
        finally { working = false; }
    }
}
