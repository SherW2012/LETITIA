export const DEFAULT_DESTINATION='https://scholar.google.com/';
export function destination(value){
  const text=String(value??'').trim();
  let url;
  try{url=new URL(text||DEFAULT_DESTINATION);}catch{throw new Error('请输入完整网址，例如 https://scholar.google.com/');}
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password)throw new Error('只支持不含账号密码的 http:// 或 https:// 网页地址。');
  return url.href;
}
