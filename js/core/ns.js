/* 全局命名空间引导：所有文件都挂载到 window.Game 上。
   单独一个文件加载在最前面，保证后续脚本可用 `Game.xxx = ...`。 */
window.Game = window.Game || {};
Game.version = '2.2.0';
Game.title = '人生模拟 · Life Sim';
