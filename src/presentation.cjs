// Visibility is not the same as presentation: DWM may cloak a WS_VISIBLE window.
function presentationReason({exists=true,visible=true,minimized=false,cloaked=0,alpha=255,onScreen=true}){
  if(!exists)return'destroyed';
  if(!visible)return'hidden';
  if(minimized)return'minimized';
  if(cloaked)return'cloaked';
  if(alpha===0)return'transparent';
  if(!onScreen)return'offscreen';
  return null;
}
module.exports={presentationReason};
