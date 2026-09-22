using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;

// Lowers every other app's playback session while TakkieAI listens, and puts the original
// levels back afterwards. Compiled into JotNativeHelper.exe; the Windows SDK COM contracts
// below follow mmdeviceapi.h / audiopolicy.h method order.
[ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface DuckDeviceEnumerator { [PreserveSig] int Endpoints(int flow, uint state, out DuckDeviceCollection devices); }
[ComImport, Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface DuckDeviceCollection { [PreserveSig] int Count(out uint count); [PreserveSig] int Item(uint index, out DuckDevice device); }
[ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface DuckDevice { [PreserveSig] int Activate(ref Guid iid, uint context, IntPtr parameters, [MarshalAs(UnmanagedType.IUnknown)] out object result); }
[ComImport, Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface DuckSessionManager {
    [PreserveSig] int Control(IntPtr id, uint flags, out IntPtr result); [PreserveSig] int Volume(IntPtr id, uint flags, out IntPtr result);
    [PreserveSig] int Enumerate(out DuckSessionEnumerator result);
}
[ComImport, Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface DuckSessionEnumerator { [PreserveSig] int Count(out int count); [PreserveSig] int Item(int index, [MarshalAs(UnmanagedType.IUnknown)] out object result); }
[ComImport, Guid("BFB7FF88-7239-4FC9-8FA2-07C950BE9C6D"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface DuckSession {
    [PreserveSig] int State(out int state);
    [PreserveSig] int Name(out IntPtr name); [PreserveSig] int SetName(IntPtr name, IntPtr context);
    [PreserveSig] int Icon(out IntPtr icon); [PreserveSig] int SetIcon(IntPtr icon, IntPtr context);
    [PreserveSig] int Group(out Guid group); [PreserveSig] int SetGroup(IntPtr group, IntPtr context);
    [PreserveSig] int Register(IntPtr events); [PreserveSig] int Unregister(IntPtr events);
    [PreserveSig] int Identifier(out IntPtr identifier); [PreserveSig] int Instance(out IntPtr identifier);
    [PreserveSig] int Pid(out uint pid);
}
[ComImport, Guid("87CE5498-68D6-44E5-9215-6DA47EF883D8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface DuckVolume {
    [PreserveSig] int SetMasterVolume(float level, ref Guid context); [PreserveSig] int GetMasterVolume(out float level);
    [PreserveSig] int SetMute(bool mute, ref Guid context); [PreserveSig] int GetMute(out bool mute);
}

internal static class AudioDuck
{
    private static readonly object gate = new object();
    // Sessions we lowered, with the level they had before. Kept alive so restore reaches the same session.
    private static readonly List<KeyValuePair<DuckVolume, float>> lowered = new List<KeyValuePair<DuckVolume, float>>();
    private static int activeLevel = -1;

    // Percentage 0..100 lowers everything that is not TakkieAI; -1 restores.
    internal static int Apply(int level)
    {
        lock (gate)
        {
            if (level < 0) return Restore();
            if (activeLevel == level) return lowered.Count;
            if (activeLevel >= 0) Restore();
            activeLevel = level;
            float target = Math.Max(0f, Math.Min(1f, level / 100f));
            Guid context = Guid.Empty;
            foreach (object item in Sessions())
            {
                DuckVolume volume = null;
                try
                {
                    volume = (DuckVolume)item;
                    float current;
                    if (volume.GetMasterVolume(out current) != 0 || current <= target) { Release(item); continue; }
                    if (volume.SetMasterVolume(target, ref context) != 0) { Release(item); continue; }
                    lowered.Add(new KeyValuePair<DuckVolume, float>(volume, current));
                }
                catch { Release(item); }
            }
            return lowered.Count;
        }
    }

    private static int Restore()
    {
        int count = lowered.Count;
        Guid context = Guid.Empty;
        foreach (KeyValuePair<DuckVolume, float> entry in lowered)
        {
            try { entry.Key.SetMasterVolume(entry.Value, ref context); } catch { }
            Release(entry.Key);
        }
        lowered.Clear();
        activeLevel = -1;
        return count;
    }

    private static bool Own(uint pid)
    {
        if (pid == 0) return true;
        try { using (Process process = Process.GetProcessById((int)pid)) { string name = process.ProcessName.ToLowerInvariant(); return name == "takkieai" || name == "electron" || name == "jotnativehelper"; } }
        catch { return true; }
    }

    // Active playback sessions of other apps on every active render endpoint.
    private static List<object> Sessions()
    {
        var found = new List<object>();
        DuckDeviceEnumerator devices = null; DuckDeviceCollection list = null;
        try
        {
            devices = (DuckDeviceEnumerator)Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")));
            if (devices.Endpoints(0, 1, out list) != 0) return found;
            uint count; if (list.Count(out count) != 0) return found;
            for (uint n = 0; n < count; n++)
            {
                DuckDevice device = null; object managerObject = null; DuckSessionEnumerator sessions = null;
                try
                {
                    if (list.Item(n, out device) != 0) continue;
                    Guid guid = typeof(DuckSessionManager).GUID;
                    if (device.Activate(ref guid, 23, IntPtr.Zero, out managerObject) != 0) continue;
                    var manager = (DuckSessionManager)managerObject;
                    if (manager.Enumerate(out sessions) != 0) continue;
                    int total; if (sessions.Count(out total) != 0) continue;
                    for (int i = 0; i < total; i++)
                    {
                        object item = null;
                        try
                        {
                            if (sessions.Item(i, out item) != 0) continue;
                            var session = (DuckSession)item;
                            uint pid; int state;
                            if (session.Pid(out pid) != 0 || session.State(out state) != 0 || state != 1 || Own(pid)) { Release(item); continue; }
                            found.Add(item);
                        }
                        catch { Release(item); }
                    }
                }
                catch { }
                finally { Release(sessions); Release(managerObject); Release(device); }
            }
        }
        catch { }
        finally { Release(list); Release(devices); }
        return found;
    }

    private static void Release(object value) { if (value != null && Marshal.IsComObject(value)) Marshal.ReleaseComObject(value); }
}
