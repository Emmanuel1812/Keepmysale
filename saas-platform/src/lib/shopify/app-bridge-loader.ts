/**
 * Inline script for <head>: load Shopify App Bridge ONLY when the page is framed (inside Shopify admin).
 *
 * App Bridge sends a top-level page to the Shopify admin once it knows the shop, which made the
 * standalone site (keepmysale.com) bounce into Shopify and made its own login unusable. Framed pages
 * still get App Bridge synchronously (document.write keeps it a blocking script, as Shopify requires).
 */
export const APP_BRIDGE_SRC = "https://cdn.shopify.com/shopifycloud/app-bridge.js";

export const APP_BRIDGE_LOADER = `(function(){try{if(window.self!==window.top){document.write('<scr'+'ipt src="${APP_BRIDGE_SRC}"></scr'+'ipt>');}}catch(e){}})();`;
