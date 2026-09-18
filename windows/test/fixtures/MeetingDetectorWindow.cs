using System;
using System.Windows.Forms;
class MeetingDetectorWindow {
 [STAThread] static void Main(string[] args){var window=new Form();window.Text="Google Meet detector fixture";window.Width=450;window.Height=200;var url=new TextBox();url.Text="https://meet.google.com/abc-defg-hij";url.Dock=DockStyle.Top;window.Controls.Add(url);var leave=new Button();leave.Text=args.Length>0?"Join now":"Leave call";leave.Dock=DockStyle.Bottom;window.Controls.Add(leave);var mic=new Button();mic.Text="Turn off microphone";mic.Dock=DockStyle.Top;window.Controls.Add(mic);Application.Run(window);}
}
