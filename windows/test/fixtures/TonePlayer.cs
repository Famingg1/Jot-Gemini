using System;using System.Media;using System.Threading;
class TonePlayer{static void Main(string[] args){using(var player=new SoundPlayer(args[0])){player.PlayLooping();Console.WriteLine("ready");Thread.Sleep(30000);}}}
