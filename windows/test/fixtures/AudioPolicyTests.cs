using System;using System.Collections.Generic;
class AudioPolicyTests {
 static void Main(){var rows=new Dictionary<uint,AudioSources.ProcessInfo>();
 Action<uint,uint,string> add=(id,parent,name)=>rows[id]=new AudioSources.ProcessInfo{id=id,parent=parent,name=name};
 add(1,0,"explorer.exe");add(2,1,"spotify.exe");add(3,2,"helper.exe");add(4,1,"applemusic.exe");add(5,1,"music.ui.exe");add(6,1,"music.exe");
 add(10,1,"msedge.exe");add(11,10,"msedge.exe");add(12,1,"opera.exe");add(13,1,"brave.exe");add(14,1,"meeting-app.exe");add(20,1,"takkieai.exe");add(21,20,"helper.exe");
 var result=AudioSources.Select(rows,new HashSet<uint>{1,2,3,4,5,6,11,14,21});
 if(!result.SetEquals(new uint[]{10,12,13,14}))throw new Exception("Music/descendant exclusion or browser dedup failed");
 add(30,14,"spotify.exe");result=AudioSources.Select(rows,new HashSet<uint>{14});if(result.Contains(14))throw new Exception("Do not include a parent that would reintroduce music");
 Console.WriteLine("Music policy passed");
 }
}
