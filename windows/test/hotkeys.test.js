'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const api=require('../src/renderer/hotkeys');
test('custom bindings migrate legacy choices, serialize and reject overlapping or unsafe chords',()=>{
  assert.deepEqual(api.fromSettings({hotkey:'f8'}),[['F8']]);
  assert.equal(api.serialize([['KeyK','ControlLeft'],['F8']]),'162+75;119');
  assert.throws(()=>api.validate([['KeyK']]));
  assert.throws(()=>api.validate([['ControlLeft'],['ControlLeft','KeyK']]));
  assert.throws(()=>api.validate([['AltLeft','F4']]));
  assert.throws(()=>api.validate([['Oops']]));
});
test('real native shortcut matcher handles multiple chords, repeats, release order and suspension',{skip:process.platform!=='win32'},()=>{
  const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'takkie-shortcut-test-'));
  const source=path.join(dir,'Test.cs'),exe=path.join(dir,'Test.exe');
  fs.writeFileSync(source,`using System; class Test {static void Check(bool b){if(!b)throw new Exception("Shortcut assertion");}static void Main(){var s=new ShortcutState();bool eat;s.Configure("162+75;119");Check(s.Step(162,true,out eat)==null&&!eat);Check(s.Step(75,true,out eat)=="down"&&eat);Check(s.Step(75,true,out eat)==null&&eat);Check(s.Step(162,false,out eat)=="up"&&!eat);Check(s.Step(75,false,out eat)==null&&eat);Check(s.Step(119,true,out eat)=="down");Check(s.Step(119,false,out eat)=="up"&&eat);s.Configure("-");Check(s.Step(119,true,out eat)==null&&!eat);s.Step(119,false,out eat);s.Configure("163");Check(s.Step(163,true,out eat)=="down"&&eat);Check(s.Step(163,false,out eat)=="up"&&eat);Console.WriteLine("native matcher passed");}}`);
  try {
    const build=spawnSync('C:/Windows/Microsoft.NET/Framework64/v4.0.30319/csc.exe',['/nologo','/out:'+exe,path.resolve('native/ShortcutState.cs'),source],{encoding:'utf8',windowsHide:true});
    assert.equal(build.status,0,build.stdout+build.stderr);
    const run=spawnSync(exe,[],{encoding:'utf8',windowsHide:true});assert.equal(run.status,0,run.stdout+run.stderr);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
