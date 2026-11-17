import { execFileSync } from 'node:child_process';

export async function captureAndroid(page, canvasOnly = false) {
  const serial = process.env.MECHSCOPE_ADB_SERIAL;
  if (!serial) throw new Error('Set MECHSCOPE_ADB_SERIAL to the explicitly selected test device');
  const viewport = await page.evaluate(() => {
    const r = document.querySelector('#viewport canvas').getBoundingClientRect();
    const header = document.querySelector('.app-header'), h = header.getBoundingClientRect();
    return { width: document.documentElement.getBoundingClientRect().width, left: r.left, top: r.top, right: r.right, bottom: r.bottom, headerTop: h.top, headerVisible: header.checkVisibility(), headerColor: getComputedStyle(header).backgroundColor.match(/\d+/g).slice(0, 3).map(Number) };
  });
  return execFileSync('python', ['-c', `
import subprocess, io, json, sys
from PIL import Image
adb=['C:/Android/Sdk/platform-tools/adb.exe','-s',sys.argv[3]]
state=subprocess.check_output(adb+['shell','dumpsys','window'],text=True,encoding='utf-8',errors='replace')
assert any('mCurrentFocus=' in line and 'dev.f7.mechscope/' in line for line in state.splitlines()), 'MechScope must be foreground'
im=Image.open(io.BytesIO(subprocess.check_output(adb+['exec-out','screencap','-p'])))
assert im.size==(1080,2400), 'Capture bounds require the verified Redmi portrait layout'
r=json.loads(sys.argv[1]); bounds=(0,126,1080,2270)
scale=1080/r['width']
assert r['headerVisible'], 'A visible app header is required for overlay-safe capture'
for x in [270,540,810]:
 pixel=im.convert('RGB').getpixel((x,126+round((r['headerTop']+3)*scale)))
 assert max(abs(a-b) for a,b in zip(pixel,r['headerColor']))<=6, 'System overlay obscures the app; screenshot was not saved'
if sys.argv[2]=='canvas':
 bounds=(round(r['left']*scale),126+round(r['top']*scale),round(r['right']*scale),126+round(r['bottom']*scale))
 assert 0<=bounds[0]<bounds[2]<=1080 and 126<=bounds[1]<bounds[3]<=2270, 'Canvas must stay inside app bounds'
im.crop(bounds).save(sys.stdout.buffer,format='PNG')
`, JSON.stringify(viewport), canvasOnly ? 'canvas' : 'app', serial], { maxBuffer: 12 * 1024 * 1024, windowsHide: true });
}
