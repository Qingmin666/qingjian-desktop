param([Parameter(Mandatory=$true)][string]$ExePath,[Parameter(Mandatory=$true)][string]$IconPath)
$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Text;
using System.Collections.Generic;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class QingJianBrand {
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr BeginUpdateResource(string file,bool deleteExisting);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool UpdateResource(IntPtr update,IntPtr type,IntPtr name,ushort language,byte[] data,uint size);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool EndUpdateResource(IntPtr update,bool discard);
 static void Align(MemoryStream s){while(s.Position%4!=0)s.WriteByte(0);}
 static byte[] Text(string value){return Encoding.Unicode.GetBytes(value+"\0");}
 static byte[] Block(string key,ushort type,byte[] value,params byte[][] children){
  using(var s=new MemoryStream())using(var w=new BinaryWriter(s)){
   w.Write((ushort)0);w.Write((ushort)(type==1?value.Length/2:value.Length));w.Write(type);w.Write(Text(key));Align(s);w.Write(value);
   foreach(var child in children){Align(s);w.Write(child);}var bytes=s.ToArray();BitConverter.GetBytes((ushort)bytes.Length).CopyTo(bytes,0);return bytes;
  }
 }
 static byte[] Version(){
  byte[] fixedInfo;using(var s=new MemoryStream())using(var w=new BinaryWriter(s)){foreach(uint n in new uint[]{0xFEEF04BD,0x00010000,0x00020001,2,0x00020001,2,0x3f,0,0x00040004,1,0,0,0})w.Write(n);fixedInfo=s.ToArray();}
  var values=new List<byte[]>();
  foreach(var pair in new string[][]{new[]{"FileDescription","轻笺"},new[]{"ProductName","轻笺 QingJian"},new[]{"InternalName","QingJian"},new[]{"OriginalFilename","QingJian.exe"},new[]{"FileVersion","2.1.0.2"},new[]{"ProductVersion","2.1.0-beta.2"},new[]{"Comments","Based on TodoDuo 1.5.0; private customization"}})values.Add(Block(pair[0],1,Text(pair[1])));
  var strings=Block("StringFileInfo",1,new byte[0],Block("040904B0",1,new byte[0],values.ToArray()));
  var vars=Block("VarFileInfo",1,new byte[0],Block("Translation",0,new byte[]{9,4,176,4}));
  return Block("VS_VERSION_INFO",0,fixedInfo,strings,vars);
 }
 static void Put(IntPtr h,int type,int id,byte[] bytes){if(!UpdateResource(h,(IntPtr)type,(IntPtr)id,1033,bytes,(uint)bytes.Length))throw new Win32Exception(Marshal.GetLastWin32Error());}
 public static void Apply(string exe,string icon){
  byte[] ico=File.ReadAllBytes(icon);ushort count=BitConverter.ToUInt16(ico,4);if(count==0)throw new Exception("Empty icon");
  IntPtr h=BeginUpdateResource(exe,false);if(h==IntPtr.Zero)throw new Win32Exception(Marshal.GetLastWin32Error());bool success=false;
  try{byte[] group=new byte[6+count*14];Array.Copy(ico,group,6);
   for(int i=0;i<count;i++){int p=6+i*16;uint size=BitConverter.ToUInt32(ico,p+8),offset=BitConverter.ToUInt32(ico,p+12);byte[] image=new byte[size];Array.Copy(ico,offset,image,0,size);Put(h,3,i+1,image);Array.Copy(ico,p,group,6+i*14,12);BitConverter.GetBytes((ushort)(i+1)).CopyTo(group,6+i*14+12);}
   Put(h,14,1,group);Put(h,16,1,Version());success=true;
  }finally{if(!EndUpdateResource(h,!success))throw new Win32Exception(Marshal.GetLastWin32Error());}
 }
}
'@
[QingJianBrand]::Apply([IO.Path]::GetFullPath($ExePath),[IO.Path]::GetFullPath($IconPath))
