const fs = require('node:fs');
const path = require('node:path');

const dataDir = path.join(__dirname, '..', 'data');
for (const f of ['finance.db', 'finance.db-wal', 'finance.db-shm']) {
  const p = path.join(dataDir, f);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}
console.log('演示数据已重置，重新启动服务将自动初始化演示账套。');
