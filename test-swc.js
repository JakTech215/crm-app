try {
  require('./node_modules/@next/swc-win32-arm64-msvc/next-swc.win32-arm64-msvc.node');
  console.log('SWC loaded OK');
} catch(e) {
  console.log('SWC failed:', e.message);
}
