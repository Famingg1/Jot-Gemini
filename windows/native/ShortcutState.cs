using System;
using System.Collections.Generic;

internal sealed class ShortcutState
{
    private int[][] bindings = new int[][] { new int[] { 163 } };
    private readonly HashSet<int> pressed = new HashSet<int>();
    private readonly HashSet<int> swallowed = new HashSet<int>();
    private int[] active;
    public bool Active { get { return active != null; } }
    public void Configure(string value)
    {
        List<int[]> next = new List<int[]>();
        if (value != "-") foreach (string chord in value.Split(';')) {
            string[] parts = chord.Split('+');
            if (parts.Length > 4 || next.Count >= 8) throw new ArgumentException("Invalid shortcut count");
            int[] codes = new int[parts.Length];
            for (int i=0;i<parts.Length;i++) if (!int.TryParse(parts[i], out codes[i]) || codes[i]<1 || codes[i]>254) throw new ArgumentException("Invalid key");
            next.Add(codes);
        }
        bindings=next.ToArray(); pressed.Clear(); active=null;
        // Retain swallowed key-ups so changing configuration cannot leak an orphan key-up.
    }
    public string Step(int key, bool down, out bool swallow)
    {
        swallow=swallowed.Contains(key);
        bool fresh=down ? pressed.Add(key) : pressed.Remove(key);
        if (!down) {
            swallowed.Remove(key);
            if(active!=null && Array.IndexOf(active,key)>=0) { active=null; return "up"; }
            return null;
        }
        if(!fresh || active!=null || swallow)return null;
        foreach(int[] chord in bindings) {
            bool match=Array.IndexOf(chord,key)>=0;
            foreach(int part in chord)if(!pressed.Contains(part))match=false;
            if(match) {active=chord;swallowed.Add(key);swallow=true;return "down";}
        }
        return null;
    }
}
