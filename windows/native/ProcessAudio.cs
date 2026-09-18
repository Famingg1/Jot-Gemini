using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Diagnostics;
using System.Collections.Generic;
[ComVisible(true),Guid("41D949AB-9862-444A-80F6-C261334DA5EB"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] public interface Completion { [PreserveSig]int ActivateCompleted(Operation op); }
[ComVisible(true),Guid("94EA2B94-E9CC-49E0-C0FF-EE64CA8F5B90"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] public interface Agile {}
[ComImport,Guid("72A22D78-CDE4-431D-B8CC-843A71199B6D"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)] public interface Operation { [PreserveSig]int GetActivateResult(out int result,[MarshalAs(UnmanagedType.IUnknown)]out object client); }
[StructLayout(LayoutKind.Sequential,Pack=2)]public struct Format {public ushort tag,channels;public uint rate,bytes;public ushort align,bits,extra;}
[StructLayout(LayoutKind.Explicit,Size=24)]public struct Variant {[FieldOffset(0)]public ushort type;[FieldOffset(8)]public uint size;[FieldOffset(16)]public IntPtr data;}
[ComImport,Guid("1CB9AD4C-DBFA-4C32-B178-C2F568A703B2"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]public interface Client {
[PreserveSig]int Initialize(int mode,uint flags,long duration,long period,ref Format format,IntPtr session);
[PreserveSig]int GetBufferSize(out uint frames);[PreserveSig]int GetStreamLatency(out long latency);[PreserveSig]int GetCurrentPadding(out uint frames);
[PreserveSig]int IsFormatSupported(int mode,IntPtr format,out IntPtr closest);[PreserveSig]int GetMixFormat(out IntPtr format);[PreserveSig]int GetDevicePeriod(out long normal,out long minimum);
[PreserveSig]int Start();[PreserveSig]int Stop();[PreserveSig]int Reset();[PreserveSig]int SetEventHandle(IntPtr handle);[PreserveSig]int GetService(ref Guid id,[MarshalAs(UnmanagedType.IUnknown)]out object service);
}
[ComImport,Guid("C8ADBD64-E71E-48A0-A4DE-185C395CD317"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]public interface Capture {
[PreserveSig]int GetBuffer(out IntPtr data,out uint frames,out uint flags,out ulong position,out ulong qpc);[PreserveSig]int ReleaseBuffer(uint frames);[PreserveSig]int GetNextPacketSize(out uint frames);
}
[ComVisible(true),ClassInterface(ClassInterfaceType.None)]public class Activation:Completion,Agile {
public AutoResetEvent ready=new AutoResetEvent(false);public Client client;public int hr;
public int ActivateCompleted(Operation op){try{object value;int call=op.GetActivateResult(out hr,out value);if(call<0)hr=call;if(hr>=0)client=(Client)value;}catch(Exception e){hr=Marshal.GetHRForException(e);}finally{ready.Set();}return 0;}
}
class ProcessAudio {
[DllImport("Mmdevapi.dll",CharSet=CharSet.Unicode)]static extern int ActivateAudioInterfaceAsync(string path,ref Guid iid,ref Variant parameters,Completion completion,out Operation operation);
static volatile bool quit=false;
static volatile bool paused=false;
static void Check(int hr){Marshal.ThrowExceptionForHR(hr);}
[MTAThread]static void Main(string[] args){try{if(args[0]=="--list"){ListApps();return;}if(args[0]=="--desktop-filtered"){DesktopMixer.Run();return;}Run(uint.Parse(args[0]));}catch(Exception e){Console.Error.WriteLine(e.Message);Environment.ExitCode=1;}}
static void ListApps(){var rows=new List<string>();foreach(var p in Process.GetProcesses()){try{string n=p.ProcessName.ToLowerInvariant();string kind=n=="chrome"?"chrome":n=="msedge"?"edge":n=="brave"?"brave":n=="opera"?"opera":n=="whatsapp"?"whatsapp":(n=="ms-teams"||n=="teams")?"teams":n=="zoom"?"zoom":null;if(kind!=null&&p.MainWindowHandle!=IntPtr.Zero)rows.Add("{\"pid\":"+p.Id+",\"app\":\""+kind+"\"}");}catch{}finally{p.Dispose();}}Console.WriteLine("["+String.Join(",",rows.ToArray())+"]");}
static void Run(uint pid){
var commands=new Thread(()=>{string line;while((line=Console.ReadLine())!=null){if(line=="PAUSE"){paused=true;Console.WriteLine("{\"type\":\"paused\"}");}else if(line=="RESUME"){paused=false;Console.WriteLine("{\"type\":\"resumed\"}");}else if(line=="STOP")break;}quit=true;});commands.IsBackground=true;commands.Start();
CaptureProcess(pid,(pcm,qpc)=>{if(!paused)Console.WriteLine("{\"type\":\"pcm\",\"data\":\""+Convert.ToBase64String(pcm)+"\"}");},()=>quit,()=>Console.WriteLine("{\"type\":\"ready\"}"));Console.WriteLine("{\"type\":\"stopped\"}");
}
internal static void CaptureProcess(uint pid,Action<byte[],ulong> onAudio,Func<bool> stop,Action ready){
IntPtr data=Marshal.AllocHGlobal(12);Client client=null;Capture capture=null;Operation operation=null;var completion=new Activation();bool started=false;
try{Marshal.WriteInt32(data,0,1);Marshal.WriteInt32(data,4,(int)pid);Marshal.WriteInt32(data,8,0);
var parameters=new Variant{type=65,size=12,data=data};Guid iid=typeof(Client).GUID;
Check(ActivateAudioInterfaceAsync("VAD\\Process_Loopback",ref iid,ref parameters,completion,out operation));if(!completion.ready.WaitOne(10000))throw new Exception("Activation timed out");Check(completion.hr);
client=completion.client;var format=new Format{tag=1,channels=1,rate=16000,bytes=32000,align=2,bits=16,extra=0};
Check(client.Initialize(0,0x80060000,0,0,ref format,IntPtr.Zero));object service;Guid captureId=typeof(Capture).GUID;Check(client.GetService(ref captureId,out service));capture=(Capture)service;
using(var samples=new AutoResetEvent(false)){Check(client.SetEventHandle(samples.SafeWaitHandle.DangerousGetHandle()));Check(client.Start());started=true;ready();
while(!stop()){samples.WaitOne(100);uint frames;Check(capture.GetNextPacketSize(out frames));while(frames>0){IntPtr pointer;uint flags;ulong pos,qpc;Check(capture.GetBuffer(out pointer,out frames,out flags,out pos,out qpc));var pcm=new byte[frames*2];try{if((flags&2)==0)Marshal.Copy(pointer,pcm,0,pcm.Length);}finally{Check(capture.ReleaseBuffer(frames));}
if((flags&4)!=0)qpc=(ulong)(Stopwatch.GetTimestamp()*(10000000.0/Stopwatch.Frequency)-frames*10000000.0/16000);
onAudio(pcm,qpc);Check(capture.GetNextPacketSize(out frames));}}
}}
finally{if(started&&client!=null)client.Stop();if(capture!=null)Marshal.ReleaseComObject(capture);if(client!=null)Marshal.ReleaseComObject(client);if(operation!=null)Marshal.ReleaseComObject(operation);Marshal.FreeHGlobal(data);GC.KeepAlive(completion);}
}
}
