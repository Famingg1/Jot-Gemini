using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Automation;

internal static class JotNativeHelper
{
    private const int WH_KEYBOARD_LL = 13;
    private const int WM_KEYDOWN = 0x0100;
    private const int WM_KEYUP = 0x0101;
    private const int WM_SYSKEYDOWN = 0x0104;
    private const int WM_SYSKEYUP = 0x0105;
    private const uint LLKHF_INJECTED = 0x10;
    private const uint INPUT_KEYBOARD = 1;
    private const uint KEYEVENTF_KEYUP = 0x0002;
    private const uint KEYEVENTF_UNICODE = 0x0004;
    private const int VK_ESCAPE = 0x1B;
    private const int VK_SPACE = 0x20;
    private const int EM_GETPASSWORDCHAR = 0x00D2;
    private static readonly ShortcutState shortcuts = new ShortcutState();
    private static readonly ShortcutState noteShortcuts = new ShortcutState();
    private static readonly object shortcutGate = new object();
    private static bool hotkeyDown;
    private static volatile bool dictating;
    private static IntPtr hook = IntPtr.Zero;
    private static LowLevelKeyboardProc callback = HookCallback;

    [STAThread]
    private static void Main(string[] args)
    {
        if (args.Length > 0) shortcuts.Configure(args[0]);
        noteShortcuts.Configure(args.Length > 1 ? args[1] : "-");
        hook = SetHook(callback);
        if (hook == IntPtr.Zero)
        {
            Emit("error", "hook", "Unable to install the Windows keyboard hook.", 0);
            Environment.Exit(2);
        }

        Thread commands = new Thread(ReadCommands);
        commands.IsBackground = true;
        commands.Start();
        Emit("ready", "", "", 0);

        MSG message;
        while (GetMessage(out message, IntPtr.Zero, 0, 0) > 0)
        {
            TranslateMessage(ref message);
            DispatchMessage(ref message);
        }
        UnhookWindowsHookEx(hook);
    }

    private static IntPtr SetHook(LowLevelKeyboardProc proc)
    {
        using (Process current = Process.GetCurrentProcess())
        using (ProcessModule module = current.MainModule)
        {
            return SetWindowsHookEx(WH_KEYBOARD_LL, proc, GetModuleHandle(module.ModuleName), 0);
        }
    }

    private static IntPtr HookCallback(int code, IntPtr wParam, IntPtr lParam)
    {
        if (code >= 0)
        {
            KBDLLHOOKSTRUCT data = (KBDLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(KBDLLHOOKSTRUCT));
            if ((data.flags & LLKHF_INJECTED) == 0)
            {
                bool down = wParam == (IntPtr)WM_KEYDOWN || wParam == (IntPtr)WM_SYSKEYDOWN;
                bool up = wParam == (IntPtr)WM_KEYUP || wParam == (IntPtr)WM_SYSKEYUP;
                int key = (int)data.vkCode;

                bool swallow;
                string transition;
                bool noteSwallow;string noteTransition;
                lock(shortcutGate) { transition=shortcuts.Step(key, down, out swallow);noteTransition=noteShortcuts.Step(key,down,out noteSwallow); }
                if(noteTransition=="down")EmitForeground("note");
                swallow=swallow||noteSwallow;
                if (transition != null)
                {
                    if (transition == "down")
                    {
                        if (IsSecureField())
                        {
                            EmitForeground("secure");
                        }
                        else
                        {
                            hotkeyDown = true;
                            EmitForeground("down");
                        }
                    }
                    else if (transition == "up" && hotkeyDown)
                    {
                        hotkeyDown = false;
                        EmitForeground("up");
                    }
                }
                if (swallow) return (IntPtr)1;
                if (key == VK_ESCAPE)
                {
                    if (down) EmitForeground("escape");
                    // While TakkieAI is recording, Escape belongs to the dictation only.
                    if (dictating) return (IntPtr)1;
                }
                if (down && key == VK_SPACE && hotkeyDown)
                {
                    EmitForeground("lock");
                    return (IntPtr)1;
                }
            }
        }
        return CallNextHookEx(hook, code, wParam, lParam);
    }

    private static void ReadCommands()
    {
        string line;
        while ((line = Console.ReadLine()) != null)
        {
            try
            {
                string[] parts = line.Split(new[] { ' ' }, 3);
                string command = parts[0].ToUpperInvariant();
                if (command == "CONFIG" && parts.Length > 1)
                {
                    lock(shortcutGate) { shortcuts.Configure(parts[1]); hotkeyDown = false; }
                }
                else if(command=="NOTE"&&parts.Length>1){lock(shortcutGate){noteShortcuts.Configure(parts[1]);}}
                else if (command == "ACTIVE" && parts.Length > 1)
                {
                    dictating = parts[1] == "1";
                }
                else if (command == "TYPE" && parts.Length > 1)
                {
                    // Always insert into whatever currently has focus.
                    string text = Encoding.UTF8.GetString(Convert.FromBase64String(parts[1]));
                    long foreground = GetForegroundWindow().ToInt64();
                    bool ok = SendUnicode(text);
                    Emit("insert", ok ? "ok" : "failed", "", foreground);
                }
                else if (command == "PASTE")
                {
                    // Always paste into whatever currently has focus.
                    long foreground = GetForegroundWindow().ToInt64();
                    bool ok = SendChord(0x11, 0x56); // Ctrl+V
                    Emit("insert", ok ? "ok" : "failed", "", foreground);
                }
                else if (command == "QUIT")
                {
                    PostQuitMessage(0);
                    return;
                }
            }
            catch (Exception ex)
            {
                Emit("error", "command", ex.Message, 0);
            }
        }
    }

    private static bool SendUnicode(string text)
    {
        foreach (char character in text)
        {
            INPUT[] inputs = new INPUT[2];
            inputs[0].type = INPUT_KEYBOARD;
            inputs[0].data.ki.wScan = character;
            inputs[0].data.ki.dwFlags = KEYEVENTF_UNICODE;
            inputs[1].type = INPUT_KEYBOARD;
            inputs[1].data.ki.wScan = character;
            inputs[1].data.ki.dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP;
            if (SendInput(2, inputs, Marshal.SizeOf(typeof(INPUT))) != 2) return false;
        }
        return true;
    }

    private static bool IsSecureField()
    {
        GUITHREADINFO info = new GUITHREADINFO();
        info.cbSize = Marshal.SizeOf(typeof(GUITHREADINFO));
        if (!GetGUIThreadInfo(0, ref info) || info.hwndFocus == IntPtr.Zero) return false;
        try
        {
            AutomationElement element = AutomationElement.FromHandle(info.hwndFocus);
            if (element != null && element.Current.IsPassword) return true;
        }
        catch { }
        try
        {
            return SendMessage(info.hwndFocus, EM_GETPASSWORDCHAR, IntPtr.Zero, IntPtr.Zero) != IntPtr.Zero;
        }
        catch { return false; }
    }

    private static bool SendChord(ushort modifier, ushort key)
    {
        INPUT[] inputs = new INPUT[4];
        inputs[0].type = INPUT_KEYBOARD; inputs[0].data.ki.wVk = modifier;
        inputs[1].type = INPUT_KEYBOARD; inputs[1].data.ki.wVk = key;
        inputs[2].type = INPUT_KEYBOARD; inputs[2].data.ki.wVk = key; inputs[2].data.ki.dwFlags = KEYEVENTF_KEYUP;
        inputs[3].type = INPUT_KEYBOARD; inputs[3].data.ki.wVk = modifier; inputs[3].data.ki.dwFlags = KEYEVENTF_KEYUP;
        return SendInput(4, inputs, Marshal.SizeOf(typeof(INPUT))) == 4;
    }

    private static void EmitForeground(string type)
    {
        IntPtr window = GetForegroundWindow();
        uint processId;
        GetWindowThreadProcessId(window, out processId);
        string name = "";
        string title = "";
        try { name = Process.GetProcessById((int)processId).ProcessName; } catch { }
        StringBuilder builder = new StringBuilder(512);
        GetWindowText(window, builder, builder.Capacity);
        title = builder.ToString();
        Emit(type, name, title, window.ToInt64());
    }

    private static void Emit(string type, string app, string message, long hwnd)
    {
        Console.WriteLine("{\"type\":\"" + Escape(type) + "\",\"app\":\"" + Escape(app) + "\",\"title\":\"" + Escape(message) + "\",\"hwnd\":" + hwnd + "}");
        Console.Out.Flush();
    }

    private static string Escape(string value)
    {
        return (value ?? "").Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\r", "\\r").Replace("\n", "\\n");
    }

    private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    private struct KBDLLHOOKSTRUCT { public uint vkCode, scanCode, flags, time; public IntPtr extraInfo; }
    [StructLayout(LayoutKind.Sequential)]
    private struct MSG { public IntPtr hwnd; public uint message; public UIntPtr wParam; public IntPtr lParam; public uint time; public POINT pt; }
    [StructLayout(LayoutKind.Sequential)]
    private struct POINT { public int x, y; }
    [StructLayout(LayoutKind.Sequential)]
    private struct INPUT { public uint type; public INPUTUNION data; }
    [StructLayout(LayoutKind.Explicit)]
    private struct INPUTUNION
    {
        [FieldOffset(0)] public MOUSEINPUT mi;
        [FieldOffset(0)] public KEYBDINPUT ki;
        [FieldOffset(0)] public HARDWAREINPUT hi;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct KEYBDINPUT { public ushort wVk, wScan; public uint dwFlags, time; public UIntPtr dwExtraInfo; }
    [StructLayout(LayoutKind.Sequential)]
    private struct MOUSEINPUT { public int dx, dy; public uint mouseData, dwFlags, time; public UIntPtr dwExtraInfo; }
    [StructLayout(LayoutKind.Sequential)]
    private struct HARDWAREINPUT { public uint uMsg; public ushort wParamL, wParamH; }
    [StructLayout(LayoutKind.Sequential)]
    private struct GUITHREADINFO
    {
        public int cbSize;
        public uint flags;
        public IntPtr hwndActive, hwndFocus, hwndCapture, hwndMenuOwner, hwndMoveSize, hwndCaret;
        public RECT rcCaret;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct RECT { public int left, top, right, bottom; }

    [DllImport("user32.dll", SetLastError = true)] private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint threadId);
    [DllImport("user32.dll", SetLastError = true)] private static extern bool UnhookWindowsHookEx(IntPtr hook);
    [DllImport("user32.dll")] private static extern IntPtr CallNextHookEx(IntPtr hook, int code, IntPtr wParam, IntPtr lParam);
    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)] private static extern IntPtr GetModuleHandle(string moduleName);
    [DllImport("user32.dll")] private static extern sbyte GetMessage(out MSG msg, IntPtr hwnd, uint min, uint max);
    [DllImport("user32.dll")] private static extern bool TranslateMessage(ref MSG msg);
    [DllImport("user32.dll")] private static extern IntPtr DispatchMessage(ref MSG msg);
    [DllImport("user32.dll")] private static extern void PostQuitMessage(int exitCode);
    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hwnd, out uint processId);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetWindowText(IntPtr hwnd, StringBuilder text, int count);
    [DllImport("user32.dll", SetLastError = true)] private static extern uint SendInput(uint count, INPUT[] inputs, int size);
    [DllImport("user32.dll")] private static extern bool GetGUIThreadInfo(uint threadId, ref GUITHREADINFO info);
    [DllImport("user32.dll", CharSet = CharSet.Auto)] private static extern IntPtr SendMessage(IntPtr hwnd, int message, IntPtr wParam, IntPtr lParam);
}
