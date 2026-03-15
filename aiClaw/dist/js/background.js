/******/ (() => { // webpackBootstrap
/*!****************************************!*\
  !*** ./src/service_work/background.ts ***!
  \****************************************/
/**
 * background.ts - aiClaw Background Service Worker
 *
 * 此脚本在浏览器扩展后台运行。
 * 当前任务：打印一条日志，证明 service worker 已启动。
 */
console.log('%c[aiClaw] 🚀 Background service worker started.', 'color: #60a5fa; font-weight: bold; font-size: 13px;');
// 扩展安装或更新时触发
chrome.runtime.onInstalled.addListener(() => {
    console.log('[aiClaw] Extension installed or updated.');
});

/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoianMvYmFja2dyb3VuZC5qcyIsIm1hcHBpbmdzIjoiOzs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsaUZBQWlGLG1CQUFtQixnQkFBZ0I7QUFDcEg7QUFDQTtBQUNBO0FBQ0EsQ0FBQyIsInNvdXJjZXMiOlsid2VicGFjazovL2FpQ2xhdy8uL3NyYy9zZXJ2aWNlX3dvcmsvYmFja2dyb3VuZC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIGJhY2tncm91bmQudHMgLSBhaUNsYXcgQmFja2dyb3VuZCBTZXJ2aWNlIFdvcmtlclxuICpcbiAqIOatpOiEmuacrOWcqOa1j+iniOWZqOaJqeWxleWQjuWPsOi/kOihjOOAglxuICog5b2T5YmN5Lu75Yqh77ya5omT5Y2w5LiA5p2h5pel5b+X77yM6K+B5piOIHNlcnZpY2Ugd29ya2VyIOW3suWQr+WKqOOAglxuICovXG5jb25zb2xlLmxvZygnJWNbYWlDbGF3XSDwn5qAIEJhY2tncm91bmQgc2VydmljZSB3b3JrZXIgc3RhcnRlZC4nLCAnY29sb3I6ICM2MGE1ZmE7IGZvbnQtd2VpZ2h0OiBib2xkOyBmb250LXNpemU6IDEzcHg7Jyk7XG4vLyDmianlsZXlronoo4XmiJbmm7TmlrDml7bop6blj5FcbmNocm9tZS5ydW50aW1lLm9uSW5zdGFsbGVkLmFkZExpc3RlbmVyKCgpID0+IHtcbiAgICBjb25zb2xlLmxvZygnW2FpQ2xhd10gRXh0ZW5zaW9uIGluc3RhbGxlZCBvciB1cGRhdGVkLicpO1xufSk7XG4iXSwibmFtZXMiOltdLCJzb3VyY2VSb290IjoiIn0=