using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Web.Script.Serialization;
using System.Windows.Automation;

internal static class MeetingDetector {
  delegate bool WindowCallback(IntPtr window, IntPtr state);
  [DllImport("user32.dll")] static extern bool EnumWindows(WindowCallback callback, IntPtr state);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr window);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window,out uint pid);
  [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr window,StringBuilder text,int size);
  [MTAThread] static void Main() {
    var rows=new List<object>();var windows=new List<string>();
    EnumWindows(delegate(IntPtr window,IntPtr state){
      uint pid;GetWindowThreadProcessId(window,out pid);
      try {using(var process=Process.GetProcessById((int)pid)) {
        string name=process.ProcessName.ToLowerInvariant();
        bool browser=name=="chrome"||name=="msedge"||name=="brave"||name=="opera";
        if(!browser&&name!="teams"&&name!="ms-teams"&&name!="zoom"&&name!="whatsapp")return true;
        string key=window.ToInt64().ToString();windows.Add(key);
        if(!IsWindowVisible(window))return true;
        var title=new StringBuilder(512);GetWindowText(window,title,512);
        if(browser&&!Regex.IsMatch(title.ToString(),"meet|teams|zoom|whatsapp",RegexOptions.IgnoreCase))return true;
        var root=AutomationElement.FromHandle(window);var controls=root.FindAll(TreeScope.Descendants,new OrCondition(new PropertyCondition(AutomationElement.ControlTypeProperty,ControlType.Button),new PropertyCondition(AutomationElement.ControlTypeProperty,ControlType.Edit)));
        string url="";var buttons=new List<string>();
        foreach(AutomationElement element in controls){try {
          if(element.Current.IsOffscreen||!element.Current.IsEnabled)continue;
          if(element.Current.ControlType==ControlType.Button){var label=element.Current.Name;if(label.Length<160)buttons.Add(label);}
          else if(browser){object pattern;if(element.TryGetCurrentPattern(ValuePattern.Pattern,out pattern)){string value=((ValuePattern)pattern).Current.Value;if(Regex.IsMatch(value,"^(https://)?(meet\\.google\\.com|teams\\.microsoft\\.com|teams\\.live\\.com|[a-z0-9.-]*zoom\\.us|web\\.whatsapp\\.com)/",RegexOptions.IgnoreCase))url=value;}}
        }catch{}}
        rows.Add(new {window=key,pid=(int)pid,process=name,title=title.ToString(),url=url,buttons=buttons});
      }}catch{}return true;
    },IntPtr.Zero);
    Console.WriteLine(new JavaScriptSerializer().Serialize(new {windows=windows,candidates=rows}));
  }
}
