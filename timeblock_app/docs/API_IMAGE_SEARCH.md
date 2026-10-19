# 开发阶段图片搜索

需要真实人物、地点、机构、商品或事件的已有图片时，使用当前提供的 `CapabilityCall` 搜索素材。
这不是浏览器运行时接口，不存在 `window.lingguang.imageSearch`。

```text
CapabilityCall(mode="help", capability="asset.image_search", arguments={})
CapabilityCall(mode="invoke", capability="asset.image_search", arguments={"query":"杭州西湖断桥","limit":1})
```

`query` 是实体明确的关键词；`limit` 默认为 1，范围 1–10。
其余布局、用途、裁切和资源命名由应用代码处理，不作为 capability 参数。
按实际返回的图片 URL、本地路径和元数据检查素材并接入，不虚构下载路径。
本地图片通过 import 引用；公开数据检索 schema 不等于图搜入口，不假设它会额外返回可用的图片资源。

虚构角色或风格化插画使用生成阶段 `asset.image_generate`；用户在应用内主动生图使用 [ImageGen](API_IMAGEGEN.md)。
搜索结果不可用时如实处理素材缺项；AI 插画不能被标成真实照片、真实外观或事实证据。
