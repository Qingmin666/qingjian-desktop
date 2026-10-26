param([Parameter(Mandatory=$true)][string]$OutputDir)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition '
using System;
using System.IO;
using System.Drawing;
using System.Drawing.Imaging;
using System.Drawing.Drawing2D;
using System.Collections.Generic;
public static class QingJianIconsV3 {
 static byte[] Render(int size){
  using(var high=new Bitmap(size*4,size*4,PixelFormat.Format32bppArgb)){
   using(var g=Graphics.FromImage(high)){
    g.Clear(Color.Transparent);g.SmoothingMode=SmoothingMode.AntiAlias;g.PixelOffsetMode=PixelOffsetMode.HighQuality;g.ScaleTransform(size*4f/256,size*4f/256);
    using(var brush=new SolidBrush(Color.FromArgb(31,255,122,36)))g.FillEllipse(brush,8,8,240,240);
    using(var p=new GraphicsPath()){
     p.StartFigure();p.AddLine(68,37,156,37);p.AddLine(156,37,199,80);p.AddLine(199,80,199,206);p.AddArc(171,192,28,28,0,90);p.AddLine(185,220,68,220);p.AddArc(54,192,28,28,90,90);p.AddLine(54,206,54,51);p.AddArc(54,37,28,28,180,90);p.CloseFigure();
     using(var brush=new SolidBrush(Color.FromArgb(194,232,172,127)))g.FillPath(brush,p);
    }
    using(var p=new GraphicsPath()){
     p.AddLine(156,37,156,68);p.AddBezier(156,68,156,75,161,80,168,80);p.AddLine(168,80,199,80);p.CloseFigure();using(var brush=new SolidBrush(Color.FromArgb(173,255,242,230)))g.FillPath(brush,p);
    }
    using(var pen=new Pen(Color.FromArgb(209,117,71,46),11)){pen.StartCap=LineCap.Round;pen.EndCap=LineCap.Round;g.DrawLine(pen,84,111,166,111);g.DrawLine(pen,84,143,166,143);g.DrawLine(pen,84,175,136,175);}
   }
   using(var result=new Bitmap(size,size,PixelFormat.Format32bppArgb)){
    using(var g=Graphics.FromImage(result)){g.CompositingMode=CompositingMode.SourceCopy;g.InterpolationMode=InterpolationMode.HighQualityBicubic;g.PixelOffsetMode=PixelOffsetMode.HighQuality;g.DrawImage(high,new Rectangle(0,0,size,size),0,0,high.Width,high.Height,GraphicsUnit.Pixel);}
    using(var stream=new MemoryStream()){result.Save(stream,ImageFormat.Png);return stream.ToArray();}
   }
  }
 }
 public static void Save(string directory){
  Directory.CreateDirectory(directory);File.WriteAllBytes(Path.Combine(directory,"icon.png"),Render(256));
  int[] sizes={16,20,24,32,40,48,64,128,256};var images=new List<byte[]>();foreach(int n in sizes)images.Add(Render(n));
  using(var writer=new BinaryWriter(File.Create(Path.Combine(directory,"icon.ico")))){
   writer.Write((ushort)0);writer.Write((ushort)1);writer.Write((ushort)sizes.Length);uint offset=(uint)(6+16*sizes.Length);
   for(int i=0;i<sizes.Length;i++){writer.Write((byte)(sizes[i]==256?0:sizes[i]));writer.Write((byte)(sizes[i]==256?0:sizes[i]));writer.Write((byte)0);writer.Write((byte)0);writer.Write((ushort)1);writer.Write((ushort)32);writer.Write((uint)images[i].Length);writer.Write(offset);offset+=(uint)images[i].Length;}
   foreach(var bytes in images)writer.Write(bytes);
  }
 }
}
' -ReferencedAssemblies System.Drawing
[QingJianIconsV3]::Save([IO.Path]::GetFullPath($OutputDir))
