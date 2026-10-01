'use strict';
/* 测试入口：加载 tests/cases/*.test.js 并按文件名顺序执行。
   用法：
     node tests/run.js             # 跑全部用例
     node tests/run.js --quiet     # 只打印失败与汇总
     node tests/coverage.js        # 跑用例并统计覆盖率 */
const path = require('path');
const fs = require('fs');
const { run } = require('./runner');

const dir = path.join(__dirname, 'cases');
fs.readdirSync(dir)
  .filter((f) => f.endsWith('.test.js'))
  .sort()
  .forEach((f) => require(path.join(dir, f)));

const verbose = process.argv.indexOf('--quiet') < 0;
const res = run({ verbose });
process.exitCode = res.fail ? 1 : 0;
