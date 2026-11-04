// Session-only token storage: survives refresh in this tab, not persistent login.
(function(root){
 const key='daily-plate-google-session-v1';
 function clear(storage){try{storage.removeItem(key);}catch{}}
 function save(storage,config,token,expires){try{storage.setItem(key,JSON.stringify({clientId:config.clientId,spreadsheetId:config.spreadsheetId,token,expires}));return true;}catch{return false;}}
 function restore(storage,config,now=Date.now()){
  try{const s=JSON.parse(storage.getItem(key)||'null');if(s&&s.clientId===config.clientId&&s.spreadsheetId===config.spreadsheetId&&typeof s.token==='string'&&s.token&&Number.isFinite(s.expires)&&s.expires>now)return s;}catch{}
  clear(storage);return null;
 }
 const api={clear,save,restore};if(typeof module!=='undefined')module.exports=api;else root.GoogleSession=api;
})(globalThis);
