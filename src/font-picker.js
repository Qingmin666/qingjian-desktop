(()=>{
  'use strict';
  const fallback='"Microsoft YaHei UI", "Microsoft YaHei", "Segoe UI", sans-serif';
  function create({getSelected,onSelect}){
    const select=document.querySelector('#font-family'),search=document.querySelector('#font-search'),status=document.querySelector('#font-status'),refresh=document.querySelector('#font-refresh');
    let fonts=[],loaded=false,loading=false,error='',renderKey='',revision=0;
    const find=value=>fonts.some(font=>font.family===value);
    function apply(){const selected=getSelected()||'';const available=!loaded||find(selected);document.documentElement.style.setProperty('--font',selected&&available?JSON.stringify(selected)+', '+fallback:fallback);}
    function render(){
      apply();const selected=getSelected()||'',query=search.value.trim().toLocaleLowerCase(),key=JSON.stringify([selected,query,revision,loading,error]);
      if(key===renderKey){select.value=selected;return;}renderKey=key;
      const matches=fonts.filter(font=>[font.family,...font.aliases].some(name=>name.toLocaleLowerCase().includes(query)));
      const option=(value,text)=>new Option(text,value);
      const options=[option('','系统默认字体')];
      if(selected&&!matches.some(font=>font.family===selected)) options.push(option(selected,selected+(loaded&&!find(selected)?'（本机不可用）':'')));
      options.push(...matches.map(font=>option(font.family,font.family)));
      select.replaceChildren(...options);select.value=selected;
      select.disabled=loading&&!loaded;refresh.disabled=loading;
      status.textContent=loading?'正在加载本机字体…':error||(selected&&loaded&&!find(selected)?'所选字体不可用，使用系统默认字体。':query?matches.length+' 种匹配字体':fonts.length+' 种本机字体');
    }
    async function load(force=false){
      if(loading)return;loading=true;error='';render();
      try{fonts=await window.todo.listFonts(force);loaded=true;revision++;}
      catch(e){error=e.message;}
      finally{loading=false;render();}
    }
    search.oninput=render;
    select.onchange=()=>onSelect(select.value).catch(()=>render());
    document.querySelector('#font-family-reset').onclick=()=>{search.value='';onSelect('').catch(()=>render());};
    refresh.onclick=()=>load(true);
    return{render,load};
  }
  window.TodoFonts={create,familyStack:(family,fonts=null)=>family&&(!fonts||fonts.some(font=>font.family===family))?JSON.stringify(family)+', '+fallback:fallback};
})();
