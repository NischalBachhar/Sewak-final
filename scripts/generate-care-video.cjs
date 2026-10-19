// Generates an original quiet motion backdrop from the Sewak-owned illustration.
// Optional FFmpeg dependency: if not installed, the CSS/illustration fallback stays usable.
// Never render or redistribute Care.com imagery or the user's reference screen recording.
const {spawnSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=path.join(root,'public/images/care-for-every-generation.webp');
const destination=path.join(root,'public/videos/sewak-care-hero.mp4');
if(process.env.REACT_APP_SEWAK_HERO_VIDEO_URL){process.stdout.write('Using configured licensed hero video.\n');process.exit(0);}
if(fs.existsSync(destination) && fs.statSync(destination).size>2048){
 console.log('Using existing Sewak hero clip: '+path.relative(root,destination));process.exit(0);
}
if(!fs.existsSync(source)){console.warn('Sewak hero illustration not found; using static fallback.');process.exit(0);}
fs.mkdirSync(path.dirname(destination),{recursive:true});
const args=[
 '-hide_banner','-loglevel','error','-nostdin','-y',
 '-loop','1','-framerate','24','-i',source,
 '-vf',"scale=1100:620:force_original_aspect_ratio=increase,crop=1100:620,zoompan=z='min(zoom+0.0004,1.08)':x='iw/2-iw/zoom/2':y='ih/2-ih/zoom/2':d=1:s=960x540:fps=24,eq=brightness=-0.05:saturation=0.85,format=yuv420p",
 '-t','6','-an','-c:v','libx264','-preset','veryfast','-crf','31',
 '-movflags','+faststart',destination,
];
const result=spawnSync(process.env.SEWAK_FFMPEG_PATH || 'ffmpeg',args,{stdio:'pipe',timeout:120000,encoding:'utf8'});
if(result.error||result.status!==0){
 try{fs.unlinkSync(destination);}catch{}
 console.warn('Video generation unavailable; using static fallback:',result.error?.code||String(result.stderr||'FFmpeg error').slice(0,300));
 process.exit(0);
}
console.log('Created original motion hero ('+fs.statSync(destination).size+' bytes): '+path.relative(root,destination));
