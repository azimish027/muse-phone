# Widget 生成说明

本文件同时包含前端维护的 Widget HTML DSL v1 基础约定，以及当前闪应用专属的 Widget 生成说明。
基础约定必须保留；应用专属区域由生成 Agent 在需要 Widget 能力时填写，并随闪应用源码一起发布，供首次注册和后续动态刷新读取。

## Widget HTML DSL v1 基础约定（必须保留）

Widget HTML DSL 由前端 Widget View 定义和维护。
生成 Agent 负责遵循协议并只生成纯展示内容。

### 文档结构

- `content` 必须是 UTF-8 HTML 字符串。
- 必须有且只有一个顶层元素：`<div data-widget-root>...</div>`；根起始标签必须准确写成 `<div data-widget-root>`。
- `data-widget-root` 必须写成无值属性，不能写成带值属性。
- 根节点前后只能有空白字符，不能有其他顶层文本或节点。
- 不能嵌套第二个 `data-widget-root`，也不能在根节点内部继续使用 `div`。
- Widget 不描述样式，最终样式由 Widget View 统一渲染。

### 标签白名单

只允许使用以下小写标签：

```text
div（仅用于唯一根节点）、p、ul、ol、li、strong、em、small、time、span、br
```

不得使用任何其他标签。

### 属性白名单

- 唯一根 `div` 必须包含 `data-widget-root`。
- `time` 可以包含 `datetime`。
- 不得使用其他属性或未经约定的 `data-*` 属性。

### 禁止内容

- 禁止 `style`、`class`、`id` 和 CSS。
- 禁止任何 `on*` 内联事件属性，例如 `onclick`。
- 禁止 `script`、`style`、`iframe`、`object`、`embed`。
- 禁止 `a`、`img`、`video`、`audio`。
- 禁止 JavaScript、模板变量、模板表达式以及自定义标签。
- 禁止把 HTTP 方法、请求头、请求体、凭证或直接后端调用写进 HTML DSL。

### 文本与数据

- 生成的 HTML 必须已经完成数据绑定，不能遗留占位符或模板表达式。
- 所有动态文本在插入 HTML 前必须完成 HTML 转义。
- 内容应紧凑地展示当前最重要的状态和下一步；复杂交互留在完整闪应用中完成。

纯展示示例：

```html
<div data-widget-root><p><small>今日进度</small></p><p><strong>3 项已完成</strong></p><p>还有 1 项待处理</p></div>
```

## 当前闪应用专属 Widget 生成说明

<!-- APP_WIDGET_SPEC_TODO_START -->

如果当前生成的是需要 Widget 能力的服务化闪应用，请将本段替换为当前闪应用专属的 Widget 生成说明，并删除这段提示和两个 TODO 标记。

应用专属说明至少需要写清：

- Widget 面向用户展示的目标和最重要的信息。
- 为获得当前数据可以调用哪些服务化 operation，以及需要哪些参数。
- 正常、空数据、加载失败和其他关键业务状态分别如何呈现。
- 信息优先级、建议尺寸，以及哪些复杂操作应留在完整闪应用中完成。
- 明确最终只生成符合上述标签和属性白名单的纯展示 Widget。
- 如何根据以上约定生成首次注册使用的 `widget/initial-content.html`。

`widget/initial-content.html` 必须是已经完成数据绑定、可以立即展示的纯展示 Widget HTML DSL，不能只写生成说明或占位内容。

<!-- APP_WIDGET_SPEC_TODO_END -->
