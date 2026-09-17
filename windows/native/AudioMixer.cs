using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;

// Windows SDK COM contracts; method order follows mmdeviceapi.h / audiopolicy.h.
[ComImport,Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface DeviceEnumerator {
 [PreserveSig]int Endpoints(int flow,uint state,out DeviceCollection devices);
}
[ComImport,Guid("0BD7A1BE-7A1A-44DB-8397-CC5392387B5E"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface DeviceCollection {
 [PreserveSig]int Count(out uint count); [PreserveSig]int Item(uint index,out AudioDevice device);
}
[ComImport,Guid("D666063F-1587-4E43-81F1-B948E807363F"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface AudioDevice {
 [PreserveSig]int Activate(ref Guid iid,uint context,IntPtr parameters,[MarshalAs(UnmanagedType.IUnknown)]out object result);
}
[ComImport,Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface SessionManager {
 [PreserveSig]int Control(IntPtr id,uint flags,out IntPtr result); [PreserveSig]int Volume(IntPtr id,uint flags,out IntPtr result);
 [PreserveSig]int Enumerate(out SessionEnumerator result);
}
[ComImport,Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface SessionEnumerator {
 [PreserveSig]int Count(out int count);[PreserveSig]int Item(int index,[MarshalAs(UnmanagedType.IUnknown)]out object result);
}
[ComImport,Guid("BFB7FF88-7239-4FC9-8FA2-07C950BE9C6D"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] interface AudioSession {
 [PreserveSig]int State(out int state);
 [PreserveSig]int Name(out IntPtr name);[PreserveSig]int SetName(IntPtr name,IntPtr context);
 [PreserveSig]int Icon(out IntPtr icon);[PreserveSig]int SetIcon(IntPtr icon,IntPtr context);
 [PreserveSig]int Group(out Guid group);[PreserveSig]int SetGroup(IntPtr group,IntPtr context);
 [PreserveSig]int Register(IntPtr events);[PreserveSig]int Unregister(IntPtr events);
 [PreserveSig]int Identifier(out IntPtr identifier);[PreserveSig]int Instance(out IntPtr identifier);
 [PreserveSig]int Pid(out uint pid);
}

static class AudioSources {
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] struct Entry {public uint size,usage,pid;public IntPtr heap;public uint module,threads,parent;public int priority;public uint flags;[MarshalAs(UnmanagedType.ByValTStr,SizeConst=260)]public string exe;}
 [DllImport("kernel32.dll",SetLastError=true)]static extern IntPtr CreateToolhelp32Snapshot(uint flags,uint pid);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode)]static extern bool Process32FirstW(IntPtr snapshot,ref Entry entry);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode)]static extern bool Process32NextW(IntPtr snapshot,ref Entry entry);
 [DllImport("kernel32.dll")]static extern bool CloseHandle(IntPtr handle);
 internal class ProcessInfo {public uint id,parent;public string name;}
 internal static Dictionary<uint,ProcessInfo> Snapshot(){var rows=new Dictionary<uint,ProcessInfo>();IntPtr handle=CreateToolhelp32Snapshot(2,0);if(handle==new IntPtr(-1))throw new Exception("Process snapshot unavailable");try{var e=new Entry{size=(uint)Marshal.SizeOf(typeof(Entry))};if(Process32FirstW(handle,ref e))do{rows[e.pid]=new ProcessInfo{id=e.pid,parent=e.parent,name=(e.exe??"").ToLowerInvariant()};}while(Process32NextW(handle,ref e));}finally{CloseHandle(handle);}return rows;}
 internal static bool Music(string name){return name=="spotify.exe"||name=="applemusic.exe"||name=="music.exe"||name=="music.ui.exe"||name=="itunes.exe";}
 static bool Own(string name){return name=="takkieai.exe"||name=="takkieprocessaudio.exe"||name=="electron.exe";}
 internal static bool Descends(uint id,uint ancestor,Dictionary<uint,ProcessInfo> rows){for(int n=0;n<100&&id!=0;n++){if(id==ancestor)return true;ProcessInfo p;if(!rows.TryGetValue(id,out p)||p.parent==id)break;id=p.parent;}return false;}
 internal static HashSet<uint> Sessions(){var ids=new HashSet<uint>();DeviceEnumerator devices=null;DeviceCollection list=null;try{
   devices=(DeviceEnumerator)Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")));
   Marshal.ThrowExceptionForHR(devices.Endpoints(0,1,out list));uint count;Marshal.ThrowExceptionForHR(list.Count(out count));
   for(uint n=0;n<count;n++){AudioDevice device=null;object managerObject=null;SessionEnumerator sessions=null;try{Marshal.ThrowExceptionForHR(list.Item(n,out device));Guid guid=typeof(SessionManager).GUID;Marshal.ThrowExceptionForHR(device.Activate(ref guid,23,IntPtr.Zero,out managerObject));var manager=(SessionManager)managerObject;Marshal.ThrowExceptionForHR(manager.Enumerate(out sessions));int total;Marshal.ThrowExceptionForHR(sessions.Count(out total));for(int i=0;i<total;i++){object item=null;try{Marshal.ThrowExceptionForHR(sessions.Item(i,out item));var session=(AudioSession)item;uint pid;int state;Marshal.ThrowExceptionForHR(session.Pid(out pid));Marshal.ThrowExceptionForHR(session.State(out state));if(pid!=0&&state!=2)ids.Add(pid);}finally{Release(item);}}}finally{Release(sessions);Release(managerObject);Release(device);}}
 }finally{Release(list);Release(devices);}return ids;}
 internal static void Release(object value){if(value!=null&&Marshal.IsComObject(value))Marshal.ReleaseComObject(value);}
 internal static HashSet<uint> Select(Dictionary<uint,ProcessInfo> rows,HashSet<uint> sessions){
   var blocked=new List<uint>();foreach(var p in rows.Values)if(Music(p.name)||Own(p.name))blocked.Add(p.id);
   // Arm browsers before their first sound, so starting a call does not wait for session discovery.
   foreach(var p in rows.Values)if(p.name=="chrome.exe"||p.name=="msedge.exe"||p.name=="opera.exe"||p.name=="brave.exe"||p.name=="firefox.exe"||p.name=="ms-teams.exe"||p.name=="teams.exe"||p.name=="zoom.exe")sessions.Add(p.id);
   var allowed=new HashSet<uint>();foreach(uint pid in sessions){if(!rows.ContainsKey(pid))continue;bool reject=false;foreach(uint excluded in blocked){if(Descends(pid,excluded,rows)||Descends(excluded,pid,rows)){reject=true;break;}}if(!reject)allowed.Add(pid);}
   var roots=new HashSet<uint>(allowed);foreach(uint pid in allowed)foreach(uint ancestor in allowed)if(pid!=ancestor&&Descends(pid,ancestor,rows)){roots.Remove(pid);break;}return roots;
 }
}

static class DesktopMixer {
 const int Rate=16000, Capacity=Rate*2, Block=160;
 static readonly object gate=new object();static readonly int[] ring=new int[Capacity];
 static long origin,read,written;static volatile bool stopped,paused;static volatile string command;static Exception failure;
 sealed class Worker {public volatile bool stop;public Thread thread;}
 static long Qpc(){return (long)(Stopwatch.GetTimestamp()*(10000000.0/Stopwatch.Frequency));}
 static void Add(byte[] pcm,ulong stamp){long offset=(long)Math.Round(((long)stamp-origin)*(Rate/10000000.0));lock(gate){for(int n=0;n<pcm.Length/2;n++){long at=offset+n;if(at<read)continue;if(at>=read+Capacity)throw new Exception("Audio clock exceeded bounded buffer");ring[(int)(at%Capacity)]+=BitConverter.ToInt16(pcm,n*2);written=Math.Max(written,at+1);}}}
 static void Emit(long end,bool output){while(read<end){int count=(int)Math.Min(Block,end-read);var pcm=new byte[count*2];lock(gate){for(int n=0;n<count;n++){int index=(int)(read%Capacity),value=Math.Max(short.MinValue,Math.Min(short.MaxValue,ring[index]));ring[index]=0;read++;pcm[n*2]=(byte)(value&255);pcm[n*2+1]=(byte)((value>>8)&255);}}if(output)Console.WriteLine("{\"type\":\"pcm\",\"data\":\""+Convert.ToBase64String(pcm)+"\"}");}}
 internal static void Run(){
   var workers=new Dictionary<uint,Worker>();origin=Qpc();read=0;
   Action scan=()=>{var snapshot=AudioSources.Snapshot();var wanted=AudioSources.Select(snapshot,AudioSources.Sessions());
     foreach(var entry in new List<KeyValuePair<uint,Worker>>(workers))if(!wanted.Contains(entry.Key)){entry.Value.stop=true;entry.Value.thread.Join(500);workers.Remove(entry.Key);}
     foreach(uint pid in wanted)if(!workers.ContainsKey(pid)){if(workers.Count>=64)throw new Exception("Too many audio processes");var worker=new Worker();uint target=pid;worker.thread=new Thread(()=>{try{ProcessAudio.CaptureProcess(target,Add,()=>worker.stop||stopped,()=>{});}catch(Exception e){lock(gate){if(!worker.stop&&!stopped&&AudioSources.Snapshot().ContainsKey(target)){failure=e;stopped=true;}}}});worker.thread.IsBackground=true;worker.thread.SetApartmentState(ApartmentState.MTA);workers[pid]=worker;worker.thread.Start();}
   };
   try{scan();Console.WriteLine("{\"type\":\"ready\"}");
     var commands=new Thread(()=>{string line;while((line=Console.ReadLine())!=null){if(line=="PAUSE"||line=="RESUME")command=line;else if(line=="STOP")break;}command="STOP";});commands.IsBackground=true;commands.Start();
     var watcher=new Thread(()=>{while(!stopped){try{scan();}catch(Exception e){failure=e;stopped=true;break;}Thread.Sleep(250);}});watcher.IsBackground=true;watcher.SetApartmentState(ApartmentState.MTA);watcher.Start();
     while(!stopped){string action=command;
       if(action=="PAUSE"||action=="STOP"){command=null;Thread.Sleep(30);long end;lock(gate){end=Math.Max(read,written);}Emit(end,!paused);paused=true;Console.WriteLine(action=="STOP"?"{\"type\":\"stopped\"}":"{\"type\":\"paused\"}");if(action=="STOP"){stopped=true;break;}}
       else if(action=="RESUME"){command=null;long end;lock(gate){end=Math.Max(read,written);}Emit(end,false);paused=false;Console.WriteLine("{\"type\":\"resumed\"}");}
       long available=(long)((Qpc()-origin)*Rate/10000000.0)-Rate/5;
       if(available>read)Emit(read+((available-read)/Block)*Block,!paused);
       Thread.Sleep(5);
     }
     watcher.Join(1500);if(failure!=null)throw failure;
   }finally{stopped=true;foreach(var worker in workers.Values)worker.stop=true;foreach(var worker in workers.Values)worker.thread.Join(500);}
 }
}
