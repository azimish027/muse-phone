/**
 * 每日面板任务 → 时间轴画布 的跨组件拖拽状态。
 * 用 pointer 事件实现（移动端可靠），不依赖 HTML5 drag/drop。
 * 拖拽中由面板写入，画布消费后在 drop 时复位。
 */
export const scheduleDrag: { title: string; active: boolean } = { title: '', active: false };